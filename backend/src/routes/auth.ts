import { Router } from 'express';
import * as authController from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';
import { validateRegister, validateLogin } from '../middleware/validate.js';
import multer from 'multer';

// 配置 multer 用于头像上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB
  },
  fileFilter: (req, file, cb) => {
    // 允许的图片格式
    const allowedMimes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
    ];

    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 JPG、PNG、GIF 格式的图片'));
    }
  },
});

const router = Router();

// 注册
router.post('/register', validateRegister, async (req, res, next) => {
  try {
    await authController.register(req, res);
  } catch (error) {
    next(error);
  }
});

// 登录
router.post('/login', validateLogin, async (req, res, next) => {
  try {
    await authController.login(req, res);
  } catch (error) {
    next(error);
  }
});

// 修改密码（需要认证）
router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    await authController.changePassword(req, res);
  } catch (error) {
    next(error);
  }
});

// 获取当前用户信息（需要认证）
router.get('/me', authenticate, async (req, res, next) => {
  try {
    console.log('GET /api/auth/me - Authenticated user:', req.user);
    await authController.getCurrentUser(req, res);
  } catch (error) {
    console.error('GET /api/auth/me error:', error);
    next(error);
  }
});

// 上传头像（需要认证）
router.post('/avatar', authenticate, upload.single('avatar'), async (req, res, next) => {
  try {
    // 调试:检查文件是否被正确接收
    console.log('Avatar upload request received');
    console.log('File received:', (req as any).file ? 'YES' : 'NO');
    if ((req as any).file) {
      console.log('File details:', {
        originalname: (req as any).file.originalname,
        mimetype: (req as any).file.mimetype,
        size: (req as any).file.size,
      });
    }

    await authController.uploadAvatar(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
