import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        phone?: string;
        email?: string;
      };
    }
  }
}

// JWT 认证中间件
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // 从 Authorization header 获取 token
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: '未提供认证令牌',
      });
      return;
    }

    const token = authHeader.substring(7); // 移除 "Bearer " 前缀

    // 验证 token
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: number;
      phone?: string;
      email?: string;
    };

    // 将用户信息附加到请求对象
    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      email: decoded.email,
    };

    next();
  } catch (error) {
    logger.warn('Authentication failed', { error: (error as Error).message });

    if ((error as Error).name === 'TokenExpiredError') {
      res.status(401).json({
        success: false,
        message: '令牌已过期',
      });
      return;
    }

    res.status(401).json({
      success: false,
      message: '无效的令牌',
    });
  }
}

// 可选认证中间件（不强制要求登录）
export function optionalAuth(req: Request, res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, config.jwt.secret) as {
      id: number;
      phone?: string;
      email?: string;
    };

    req.user = {
      id: decoded.id,
      phone: decoded.phone,
      email: decoded.email,
    };

    next();
  } catch {
    // 静默失败，继续处理请求
    next();
  }
}
