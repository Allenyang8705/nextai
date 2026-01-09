import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// 自定义错误类
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// 错误处理中间件
export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  logger.error('Error occurred', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // 如果是自定义错误
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  // JWT 错误
  if (err.name === 'JsonWebTokenError') {
    res.status(401).json({
      success: false,
      message: '无效的令牌',
    });
    return;
  }

  if (err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: '令牌已过期',
    });
    return;
  }

  // 数据库错误
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: '数据验证失败',
    });
    return;
  }

  // 其他错误
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

// 404 处理中间件
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    message: `路径 ${req.method} ${req.path} 不存在`,
  });
}
