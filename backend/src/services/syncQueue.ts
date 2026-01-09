import { query, queryOne, insert } from '../config/database.js';
import { logger } from '../utils/logger.js';
import { appendToFeishuDoc, formatRecordForFeishu, type FeishuConfig } from './feishu.js';

/**
 * 飞书同步重试队列
 *
 * 处理飞书同步失败后的自动重试机制
 */
export class SyncRetryQueue {
  private maxRetry: number = 3;
  private retryInterval: number = 5 * 60 * 1000; // 5分钟
  private timer: NodeJS.Timeout | null = null;
  private isProcessing: boolean = false;

  constructor(maxRetry: number = 3, retryInterval: number = 5 * 60 * 1000) {
    this.maxRetry = maxRetry;
    this.retryInterval = retryInterval;
    this.startRetryTimer();
  }

  /**
   * 启动定时重试检查
   */
  startRetryTimer(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(async () => {
      if (this.isProcessing) {
        logger.debug('Sync retry queue is already processing, skipping');
        return;
      }

      await this.processRetryQueue();
    }, this.retryInterval);

    logger.info('Sync retry queue timer started', {
      interval: this.retryInterval,
    });
  }

  /**
   * 停止定时器
   */
  stopRetryTimer(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      logger.info('Sync retry queue timer stopped');
    }
  }

  /**
   * 处理重试队列
   */
  private async processRetryQueue(): Promise<void> {
    this.isProcessing = true;

    try {
      // 获取需要重试的记录
      const pendingRecords = await query<any>(
        `SELECT r.id, r.audio_url, r.duration, r.transcription, r.created_at,
                fs.id as sync_id, fs.retry_count, fc.app_id, fc.app_secret, fc.document_id
         FROM feishu_sync_log fs
         INNER JOIN records r ON fs.record_id = r.id
         INNER JOIN feishu_config fc ON r.user_id = fc.user_id
         WHERE fs.sync_status = 'pending'
           AND fc.is_enabled = 1
           AND fs.retry_count < ?
         ORDER BY fs.created_at ASC
         LIMIT 10`,
        [this.maxRetry]
      );

      if (pendingRecords.length === 0) {
        return;
      }

      logger.info(`Processing ${pendingRecords.length} pending sync tasks`);

      for (const record of pendingRecords) {
        await this.retryRecord(record);
      }
    } catch (error) {
      logger.error('Process retry queue error', { error: (error as Error).message });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 重试单条记录
   */
  private async retryRecord(record: any): Promise<void> {
    try {
      logger.info('Retrying sync for record', {
        recordId: record.id,
        retryCount: record.retry_count,
      });

      // 格式化内容
      const content = this.formatContent(record);

      // 同步到飞书
      const result = await appendToFeishuDoc(
        {
          appId: record.app_id,
          appSecret: record.app_secret,
          documentId: record.document_id,
        },
        content
      );

      if (result.success) {
        // 更新为成功
        await queryOne(
          `UPDATE feishu_sync_log
           SET sync_status = 'success', retry_count = retry_count + 1, synced_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [record.sync_id]
        );

        logger.info('Sync retry successful', { recordId: record.id });
      } else {
        // 增加重试次数
        await queryOne(
          `UPDATE feishu_sync_log
           SET retry_count = retry_count + 1, error_message = ?
           WHERE id = ?`,
          [result.message || 'Sync failed', record.sync_id]
        );

        // 检查是否超过最大重试次数
        if (record.retry_count + 1 >= this.maxRetry) {
          await queryOne(
            `UPDATE feishu_sync_log
             SET sync_status = 'failed'
             WHERE id = ?`,
            [record.sync_id]
          );

          logger.warn('Sync retry failed, max retries reached', {
            recordId: record.id,
            retryCount: record.retry_count + 1,
          });
        }
      }
    } catch (error) {
      logger.error('Retry record error', {
        recordId: record.id,
        error: (error as Error).message,
      });
    }
  }

  /**
   * 格式化记录内容
   */
  private formatContent(record: any): string {
    return formatRecordForFeishu({
      duration: record.duration,
      created_at: record.created_at,
      transcription: record.transcription,
      audio_url: record.audio_url,
    });
  }

  /**
   * 添加记录到重试队列
   */
  async addToQueue(recordId: number): Promise<void> {
    try {
      // 检查是否已存在
      const existing = await queryOne<any>(
        'SELECT id FROM feishu_sync_log WHERE record_id = ? AND sync_status = "pending"',
        [recordId]
      );

      if (existing) {
        logger.debug('Record already in retry queue', { recordId });
        return;
      }

      // 添加到重试队列
      await insert(
        `INSERT INTO feishu_sync_log (record_id, sync_status, retry_count)
         VALUES (?, 'pending', 0)`,
        [recordId]
      );

      logger.info('Record added to retry queue', { recordId });
    } catch (error) {
      logger.error('Add to retry queue error', {
        recordId,
        error: (error as Error).message,
      });
    }
  }

  /**
   * 获取队列状态
   */
  async getQueueStatus(): Promise<{
    pending: number;
    failed: number;
    success: number;
  }> {
    try {
      const status = await query<any>(
        `SELECT sync_status, COUNT(*) as count
         FROM feishu_sync_log
         GROUP BY sync_status`
      );

      const result = {
        pending: 0,
        failed: 0,
        success: 0,
      };

      for (const row of status) {
        if (row.sync_status === 'pending') {
          result.pending = row.count;
        } else if (row.sync_status === 'failed') {
          result.failed = row.count;
        } else if (row.sync_status === 'success') {
          result.success = row.count;
        }
      }

      return result;
    } catch (error) {
      logger.error('Get queue status error', { error: (error as Error).message });
      return { pending: 0, failed: 0, success: 0 };
    }
  }
}

// 导出单例实例
export const syncRetryQueue = new SyncRetryQueue();

/**
 * 触发自动同步（语音识别完成后调用）
 */
export async function triggerAutoSync(recordId: number): Promise<void> {
  try {
    // 获取记录信息
    const record = await queryOne<any>(
      `SELECT r.id, r.user_id, r.audio_url, r.duration, r.transcription, r.created_at,
              fc.app_id, fc.app_secret, fc.document_id
       FROM records r
       INNER JOIN feishu_config fc ON r.user_id = fc.user_id
       WHERE r.id = ? AND fc.is_enabled = 1`,
      [recordId]
    );

    if (!record) {
      logger.debug('No feishu config found for record, skipping auto sync', { recordId });
      return;
    }

    // 格式化内容
    const content = formatRecordForFeishu({
      duration: record.duration,
      created_at: record.created_at,
      transcription: record.transcription,
      audio_url: record.audio_url,
    });

    // 尝试同步
    const result = await appendToFeishuDoc(
      {
        appId: record.app_id,
        appSecret: record.app_secret,
        documentId: record.document_id,
      },
      content
    );

    // 记录同步日志
    if (result.success) {
      await insert(
        `INSERT INTO feishu_sync_log (record_id, sync_status, synced_at)
         VALUES (?, 'success', CURRENT_TIMESTAMP)`,
        [recordId]
      );

      // 更新最后同步时间
      await queryOne(
        'UPDATE feishu_config SET last_sync_at = CURRENT_TIMESTAMP WHERE user_id = ?',
        [record.user_id]
      );

      logger.info('Auto sync successful', { recordId });
    } else {
      // 同步失败，加入重试队列
      await insert(
        `INSERT INTO feishu_sync_log (record_id, sync_status, retry_count, error_message)
         VALUES (?, 'pending', 0, ?)`,
        [recordId, result.message || 'Sync failed']
      );

      logger.warn('Auto sync failed, added to retry queue', {
        recordId,
        error: result.message,
      });
    }
  } catch (error) {
    logger.error('Trigger auto sync error', {
      recordId,
      error: (error as Error).message,
    });

    // 发生错误也加入重试队列
    try {
      await insert(
        `INSERT INTO feishu_sync_log (record_id, sync_status, retry_count, error_message)
         VALUES (?, 'pending', 0, ?)`,
        [recordId, (error as Error).message]
      );
    } catch (e) {
      logger.error('Failed to add to retry queue', { error: (e as Error).message });
    }
  }
}
