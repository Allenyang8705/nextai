import { Request, Response } from 'express';
import { query, queryOne, insert } from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';
import {
  testFeishuConnection,
  appendToFeishuDoc,
  formatRecordForFeishu,
  clearTokenCache,
  type FeishuConfig,
} from '../services/feishu.js';

// 保存飞书配置
export async function saveConfig(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const { documentId, appId, appSecret, isEnabled } = req.body;

    // 验证必填字段
    if (!documentId || !appId || !appSecret) {
      throw new AppError(400, '请填写完整的飞书配置信息');
    }

    // 检查是否已存在配置
    const existing = await queryOne<any>(
      'SELECT user_id FROM feishu_config WHERE user_id = ?',
      [userId]
    );

    if (existing) {
      // 更新
      await queryOne(
        `UPDATE feishu_config
         SET document_id = ?, app_id = ?, app_secret = ?, is_enabled = ?, updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ?`,
        [documentId, appId, appSecret, isEnabled ? 1 : 0, userId]
      );
    } else {
      // 插入
      await insert(
        `INSERT INTO feishu_config (user_id, document_id, app_id, app_secret, is_enabled)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, documentId, appId, appSecret, isEnabled ? 1 : 0]
      );
    }

    // 清除 token 缓存（因为配置可能已更改）
    clearTokenCache();

    logger.info('Feishu config saved', { userId });

    res.json({
      success: true,
      message: '配置保存成功',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Save feishu config error', { error: (error as Error).message });
    throw new AppError(500, '保存配置失败');
  }
}

// 获取飞书配置
export async function getConfig(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const config = await queryOne<any>(
      `SELECT document_id, app_id, app_secret, is_enabled, last_sync_at
       FROM feishu_config
       WHERE user_id = ?`,
      [userId]
    );

    if (!config) {
      res.json({
        success: true,
        data: {
          configured: false,
          config: null,
        },
      });
      return;
    }

    res.json({
      success: true,
      data: {
        configured: true,
        config: {
          documentId: config.document_id,
          appId: config.app_id,
          appSecret: '***', // 隐藏敏感信息
          isEnabled: config.is_enabled === 1,
          lastSyncAt: config.last_sync_at,
        },
      },
    });
  } catch (error) {
    logger.error('Get feishu config error', { error: (error as Error).message });
    throw new AppError(500, '获取配置失败');
  }
}

// 测试连接
export async function testConnection(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    const config = await queryOne<any>(
      'SELECT document_id, app_id, app_secret FROM feishu_config WHERE user_id = ?',
      [userId]
    );

    if (!config) {
      throw new AppError(404, '请先保存飞书配置');
    }

    const result = await testFeishuConnection({
      appId: config.app_id,
      appSecret: config.app_secret,
      documentId: config.document_id,
    });

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Test feishu connection error', { error: (error as Error).message });
    throw new AppError(500, '测试连接失败');
  }
}

// 手动同步单条记录
export async function syncRecord(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const recordId = parseInt(req.params.id);

    if (!recordId) {
      throw new AppError(400, '无效的记录ID');
    }

    // 获取飞书配置
    const feishuConfig = await queryOne<any>(
      'SELECT * FROM feishu_config WHERE user_id = ? AND is_enabled = 1',
      [userId]
    );

    if (!feishuConfig) {
      throw new AppError(400, '请先配置并启用飞书同步');
    }

    // 获取记录
    const record = await queryOne<any>(
      'SELECT * FROM records WHERE id = ? AND user_id = ?',
      [recordId, userId]
    );

    if (!record) {
      throw new AppError(404, '记录不存在');
    }

    // 格式化内容
    const content = formatRecordForFeishu(record);

    // 同步到飞书
    const result = await appendToFeishuDoc(
      {
        appId: feishuConfig.app_id,
        appSecret: feishuConfig.app_secret,
        documentId: feishuConfig.document_id,
      },
      content
    );

    // 记录同步日志
    if (result.success) {
      // 更新最后同步时间
      await queryOne(
        'UPDATE feishu_config SET last_sync_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [userId]
      );

      // 插入同步日志
      await insert(
        `INSERT INTO feishu_sync_log (record_id, sync_status, synced_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`,
        [recordId, 'success']
      );
    } else {
      // 插入失败日志
      await insert(
        `INSERT INTO feishu_sync_log (record_id, sync_status, error_message)
         VALUES (?, ?, ?)`,
        [recordId, 'failed', result.message]
      );
    }

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Sync record error', { error: (error as Error).message });
    throw new AppError(500, '同步失败');
  }
}

// 获取同步状态
export async function getSyncStatus(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const recordId = parseInt(req.params.id);

    if (!recordId) {
      throw new AppError(400, '无效的记录ID');
    }

    // 验证记录属于当前用户
    const record = await queryOne<any>(
      'SELECT id FROM records WHERE id = ? AND user_id = ?',
      [recordId, userId]
    );

    if (!record) {
      throw new AppError(404, '记录不存在');
    }

    // 获取最新的同步日志
    const syncLog = await queryOne<any>(
      `SELECT id, sync_status, error_message, synced_at, created_at
       FROM feishu_sync_log
       WHERE record_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [recordId]
    );

    res.json({
      success: true,
      data: {
        synced: syncLog?.sync_status === 'success',
        status: syncLog?.sync_status || 'none',
        errorMessage: syncLog?.error_message,
        syncedAt: syncLog?.synced_at,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Get sync status error', { error: (error as Error).message });
    throw new AppError(500, '获取同步状态失败');
  }
}
