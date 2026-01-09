import { Router } from 'express';
import * as feishuController from '../controllers/feishu.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// 所有路由都需要认证
router.use(authenticate);

// 保存飞书配置
router.post('/config', async (req, res, next) => {
  try {
    await feishuController.saveConfig(req, res);
  } catch (error) {
    next(error);
  }
});

// 获取飞书配置
router.get('/config', async (req, res, next) => {
  try {
    await feishuController.getConfig(req, res);
  } catch (error) {
    next(error);
  }
});

// 测试连接
router.post('/test', async (req, res, next) => {
  try {
    await feishuController.testConnection(req, res);
  } catch (error) {
    next(error);
  }
});

// 同步单条记录
router.post('/sync/:id', async (req, res, next) => {
  try {
    await feishuController.syncRecord(req, res);
  } catch (error) {
    next(error);
  }
});

// 获取同步状态
router.get('/status/:id', async (req, res, next) => {
  try {
    await feishuController.getSyncStatus(req, res);
  } catch (error) {
    next(error);
  }
});

export default router;
