import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { queryOne, insert } from '../config/database.js';
import { config } from '../config/env.js';
import { AppError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';
import { validateEmail, validatePhone } from '../middleware/validate.js';
import { uploadToOSS } from '../services/aliyun.js';
import path from 'path';

// 生成 JWT Token
function generateToken(userId: number, phone?: string, email?: string): string {
  return jwt.sign(
    {
      id: userId,
      phone,
      email,
    },
    config.jwt.secret,
    {
      expiresIn: config.jwt.expiresIn,
    }
  );
}

// 用户注册
export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { phone, email, password } = req.body;

    // 检查手机号是否已存在
    if (phone) {
      const existingUser = await queryOne<any>(
        'SELECT id FROM users WHERE phone = ?',
        [phone]
      );
      if (existingUser) {
        throw new AppError(400, '该手机号已被注册');
      }
    }

    // 检查邮箱是否已存在
    if (email) {
      const existingUser = await queryOne<any>(
        'SELECT id FROM users WHERE email = ?',
        [email]
      );
      if (existingUser) {
        throw new AppError(400, '该邮箱已被注册');
      }
    }

    // 加密密码
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建用户
    const userId = await insert(
      'INSERT INTO users (phone, email, password_hash) VALUES (?, ?, ?)',
      [phone || null, email || null, passwordHash]
    );

    logger.info('User registered successfully', { userId, phone, email });

    // 生成 Token
    const token = generateToken(userId, phone || undefined, email || undefined);

    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: userId,
          phone,
          email,
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Register error', { error: (error as Error).message });
    throw new AppError(500, '注册失败');
  }
}

// 用户登录
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { account, password } = req.body;

    // 判断是手机号还是邮箱
    const isPhone = validatePhone(account);
    const isEmail = validateEmail(account);

    if (!isPhone && !isEmail) {
      throw new AppError(400, '请输入有效的手机号或邮箱');
    }

    // 查找用户
    const user = await queryOne<any>(
      isPhone
        ? 'SELECT id, phone, email, password_hash FROM users WHERE phone = ?'
        : 'SELECT id, phone, email, password_hash FROM users WHERE email = ?',
      [account]
    );

    if (!user) {
      throw new AppError(401, '账号或密码错误');
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError(401, '账号或密码错误');
    }

    logger.info('User logged in successfully', { userId: user.id });

    // 生成 Token
    const token = generateToken(user.id, user.phone, user.email);

    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
        },
        token,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Login error', { error: (error as Error).message });
    throw new AppError(500, '登录失败');
  }
}

// 修改密码
export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user!.id;

    // 获取用户信息
    const user = await queryOne<any>(
      'SELECT password_hash FROM users WHERE id = ?',
      [userId]
    );

    if (!user) {
      throw new AppError(404, '用户不存在');
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isPasswordValid) {
      throw new AppError(401, '原密码错误');
    }

    // 检查新密码是否与旧密码相同
    if (oldPassword === newPassword) {
      throw new AppError(400, '新密码不能与原密码相同');
    }

    // 加密新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await queryOne(
      'UPDATE users SET password_hash = ? WHERE id = ?',
      [newPasswordHash, userId]
    );

    logger.info('Password changed successfully', { userId });

    res.json({
      success: true,
      message: '密码修改成功，请重新登录',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Change password error', { error: (error as Error).message });
    throw new AppError(500, '修改密码失败');
  }
}

// 处理头像URL - 将OSS路径转换为HTTP URL
function processAvatarUrl(avatarUrl: string | null): string | null {
  if (!avatarUrl) {
    return null;
  }

  // 如果已经是完整的HTTP URL，直接返回
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl;
  }

  // 如果是 OSS 路径格式，转换为 HTTP URL
  if (avatarUrl.startsWith('oss://')) {
    // 提取路径部分: oss://avatars/2/xxx.jpg -> avatars/2/xxx.jpg
    const pathPart = avatarUrl.replace('oss://', '');
    const serverUrl = process.env.SERVER_URL || `http://localhost:${config.port}`;
    return `${serverUrl}/uploads/${pathPart}`;
  }

  // 其他情况，假设是相对路径
  const serverUrl = process.env.SERVER_URL || `http://localhost:${config.port}`;
  return `${serverUrl}/uploads/${avatarUrl}`;
}

// 获取当前用户信息
export async function getCurrentUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    logger.info('Getting current user', { userId });

    const user = await queryOne<any>(
      'SELECT id, phone, email, avatar_url, created_at FROM users WHERE id = ?',
      [userId]
    );

    logger.info('User query result', { userFound: !!user, userId });

    if (!user) {
      throw new AppError(404, '用户不存在');
    }

    // 处理头像URL
    const processedAvatarUrl = processAvatarUrl(user.avatar_url);

    logger.info('Processed avatar URL', {
      original: user.avatar_url,
      processed: processedAvatarUrl
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          phone: user.phone,
          email: user.email,
          avatarUrl: processedAvatarUrl,
          createdAt: user.created_at,
        },
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Get current user error', { error: (error as Error).message, stack: (error as Error).stack });
    throw new AppError(500, '获取用户信息失败');
  }
}

// 上传头像
export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const file = (req as any).file;

    if (!file) {
      throw new AppError(400, '请选择要上传的头像文件');
    }

    // 生成文件名
    const ext = path.extname(file.originalname) || '.jpg';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 11);
    const fileName = `avatars/${userId}/${timestamp}-${random}${ext}`;

    logger.info('Uploading avatar', { userId, fileName, size: file.size });

    // 本地保存
    const fs = await import('fs/promises');
    // Windows路径处理
    const __filename = new URL(import.meta.url).pathname;
    // 移除开头的 / (Windows路径问题)
    const cleanPath = __filename.replace(/^\//, '').replace(/\//g, '\\');
    const __dirname = path.dirname(cleanPath);
    const uploadDir = path.join(__dirname, '../../uploads');
    const fullPath = path.join(uploadDir, fileName);

    logger.info('Saving avatar locally', { fullPath, uploadDir });

    // 确保目录存在
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // 写入文件
    await fs.writeFile(fullPath, file.buffer);

    const serverUrl = process.env.SERVER_URL || `http://localhost:${config.port}`;
    const avatarUrl = `${serverUrl}/uploads/${fileName}`;

    logger.info('Avatar saved successfully', { avatarUrl });

    // 更新用户头像
    await queryOne(
      'UPDATE users SET avatar_url = ? WHERE id = ?',
      [avatarUrl, userId]
    );

    logger.info('Avatar uploaded successfully', { userId, avatarUrl });

    res.json({
      success: true,
      message: '头像上传成功',
      data: {
        avatarUrl,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Upload avatar error', { error: (error as Error).message, stack: (error as Error).stack });
    throw new AppError(500, '上传头像失败');
  }
}
