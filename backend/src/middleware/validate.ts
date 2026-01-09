import { Request, Response, NextFunction } from 'express';
import { AppError } from './error.js';

// 验证邮箱格式
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 验证手机号格式（中国大陆）
export function validatePhone(phone: string): boolean {
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

// 验证密码强度
export function validatePassword(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) {
    return { valid: false, message: '密码长度至少为8位' };
  }
  if (!/[a-zA-Z]/.test(password)) {
    return { valid: false, message: '密码必须包含字母' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, message: '密码必须包含数字' };
  }
  return { valid: true };
}

// 注册验证中间件
export function validateRegister(req: Request, res: Response, next: NextFunction): void {
  const { phone, email, password, confirmPassword } = req.body;

  // 必须提供手机号或邮箱
  if (!phone && !email) {
    throw new AppError(400, '请提供手机号或邮箱');
  }

  // 验证手机号格式
  if (phone && !validatePhone(phone)) {
    throw new AppError(400, '手机号格式不正确');
  }

  // 验证邮箱格式
  if (email && !validateEmail(email)) {
    throw new AppError(400, '邮箱格式不正确');
  }

  // 验证密码
  const passwordCheck = validatePassword(password);
  if (!passwordCheck.valid) {
    throw new AppError(400, passwordCheck.message || '密码格式不正确');
  }

  // 验证确认密码
  if (password !== confirmPassword) {
    throw new AppError(400, '两次密码不一致');
  }

  next();
}

// 登录验证中间件
export function validateLogin(req: Request, res: Response, next: NextFunction): void {
  const { account, password } = req.body;

  if (!account) {
    throw new AppError(400, '请输入手机号或邮箱');
  }

  if (!password) {
    throw new AppError(400, '请输入密码');
  }

  next();
}
