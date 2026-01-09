import { Request, Response } from 'express';
import { query, queryOne, insert } from '../config/database.js';
import { AppError } from '../middleware/error.js';
import { logger } from '../utils/logger.js';
import { uploadToOSS, transcribeAudio, getSignedUrl } from '../services/aliyun.js';
import { triggerAutoSync } from '../services/syncQueue.js';
import { config } from '../config/env.js';
import fs from 'fs/promises';
import path from 'path';

// 检查 URL 是否是 OSS URL
function isOSSUrl(url: string): boolean {
  return url.includes('.aliyuncs.com');
}

// 从 OSS URL 提取文件名
function extractFileNameFromOSSUrl(url: string): string | null {
  if (!isOSSUrl(url)) return null;

  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    // 移除开头的 /
    return pathname.startsWith('/') ? pathname.substring(1) : pathname;
  } catch {
    return null;
  }
}

// 生成唯一文件名
function generateFileName(userId: number, originalName: string): string {
  const timestamp = Date.now();
  const ext = path.extname(originalName) || '.mp3';
  return `audio/${userId}/${timestamp}-${Math.random().toString(36).substr(2, 9)}${ext}`;
}

// 保存文件到本地（备用方案，当 OSS 不可用时）
async function saveToLocal(fileName: string, buffer: Buffer): Promise<string> {
  const uploadDir = path.join(process.cwd(), 'uploads');
  const fullPath = path.join(uploadDir, fileName);

  // 确保目录存在
  await fs.mkdir(path.dirname(fullPath), { recursive: true });

  // 写入文件
  await fs.writeFile(fullPath, buffer);

  // 返回完整 URL（用于小程序访问）
  // 获取服务器地址，从环境变量或使用默认值
  const serverUrl = process.env.SERVER_URL || `http://localhost:${config.port}`;
  return `${serverUrl}/uploads/${fileName}`;
}

// 上传语音
export async function uploadAudio(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    // 获取上传的文件（通过 multer 中间件）
    const file = (req as any).file;
    if (!file) {
      throw new AppError(400, '请选择要上传的语音文件');
    }

    // 获取参数
    const duration = parseInt(req.body.duration) || 0;

    if (duration < 1 || duration > 60) {
      throw new AppError(400, '语音时长必须在1-60秒之间');
    }

    // 生成文件名
    const fileName = generateFileName(userId, file.originalname);

    // 上传到 OSS（如果配置了）或本地
    let audioUrl: string;
    const ossUrl = await uploadToOSS(fileName, file.buffer, file.mimetype);

    if (ossUrl) {
      audioUrl = ossUrl;
    } else {
      // 保存到本地
      audioUrl = await saveToLocal(fileName, file.buffer);
      logger.info('File saved locally', { fileName, localPath: audioUrl });
    }

    // 创建数据库记录
    const recordId = await insert(
      `INSERT INTO records (user_id, audio_url, duration, file_size, asr_status)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, audioUrl, duration, file.size, 'pending']
    );

    logger.info('Audio record created', { recordId, userId, duration });

    // 异步进行语音转文字
    transcribeAudio(audioUrl)
      .then(result => {
        if (result.success) {
          // 更新转写结果
          queryOne(
            `UPDATE records SET transcription = ?, asr_status = ? WHERE id = ?`,
            [result.text, 'success', recordId]
          ).then(() => {
            logger.info('ASR transcription completed', { recordId });

            // 转写成功后触发飞书自动同步
            triggerAutoSync(recordId).catch(err => {
              logger.warn('Failed to trigger auto sync', { error: err.message });
            });
          });
        } else {
          // 标记为失败
          queryOne(
            `UPDATE records SET asr_status = ? WHERE id = ?`,
            ['failed', recordId]
          ).then(() => {
            logger.error('ASR transcription failed', { recordId, error: result.error });
          });
        }
      })
      .catch(error => {
        logger.error('ASR transcription error', { recordId, error: error.message });
      });

    res.status(201).json({
      success: true,
      message: '上传成功',
      data: {
        id: recordId,
        audioUrl,
        duration,
        fileSize: file.size,
        asrStatus: 'pending',
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Upload audio error', { error: (error as Error).message });
    throw new AppError(500, '上传失败');
  }
}

// 获取语音列表
export async function getAudioList(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;

    // 分页参数
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = Math.min(parseInt(req.query.pageSize as string) || 20, 100);
    const offset = (page - 1) * pageSize;

    // 获取总数
    const countResult = await queryOne<{ total: number }>(
      'SELECT COUNT(*) as total FROM records WHERE user_id = ?',
      [userId]
    );

    // 获取列表
    const records = await query<any>(
      `SELECT id, audio_url, duration, transcription, file_size, asr_status, created_at
       FROM records
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [userId, pageSize, offset]
    );

    // 处理列表，为 OSS URL 生成签名
    const processedList = await Promise.all(
      records.map(async (r) => {
        let audioUrl = r.audio_url;

        // 如果是 OSS URL，生成签名 URL
        if (isOSSUrl(r.audio_url)) {
          const fileName = extractFileNameFromOSSUrl(r.audio_url);
          if (fileName) {
            const signedUrl = await getSignedUrl(fileName, 3600);
            if (signedUrl) {
              audioUrl = signedUrl;
            }
          }
        }

        return {
          id: r.id,
          audioUrl,
          duration: r.duration,
          transcription: r.transcription,
          fileSize: r.file_size,
          asrStatus: r.asr_status,
          createdAt: r.created_at,
        };
      })
    );

    res.json({
      success: true,
      data: {
        list: processedList,
        pagination: {
          page,
          pageSize,
          total: countResult?.total || 0,
          totalPages: Math.ceil((countResult?.total || 0) / pageSize),
        },
      },
    });
  } catch (error) {
    logger.error('Get audio list error', { error: (error as Error).message });
    throw new AppError(500, '获取列表失败');
  }
}

// 获取单条语音详情
export async function getAudioById(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const recordId = parseInt(req.params.id);

    if (!recordId) {
      throw new AppError(400, '无效的记录ID');
    }

    const record = await queryOne<any>(
      `SELECT id, audio_url, duration, transcription, file_size, asr_status, created_at
       FROM records
       WHERE id = ? AND user_id = ?`,
      [recordId, userId]
    );

    if (!record) {
      throw new AppError(404, '记录不存在');
    }

    // 处理音频 URL，为 OSS URL 生成签名
    let audioUrl = record.audio_url;
    if (isOSSUrl(record.audio_url)) {
      const fileName = extractFileNameFromOSSUrl(record.audio_url);
      if (fileName) {
        const signedUrl = await getSignedUrl(fileName, 3600);
        if (signedUrl) {
          audioUrl = signedUrl;
        }
      }
    }

    res.json({
      success: true,
      data: {
        id: record.id,
        audioUrl,
        duration: record.duration,
        transcription: record.transcription,
        fileSize: record.file_size,
        asrStatus: record.asr_status,
        createdAt: record.created_at,
      },
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Get audio by id error', { error: (error as Error).message });
    throw new AppError(500, '获取记录失败');
  }
}

// 删除语音记录
export async function deleteAudio(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const recordId = parseInt(req.params.id);

    if (!recordId) {
      throw new AppError(400, '无效的记录ID');
    }

    // 检查记录是否存在且属于当前用户
    const record = await queryOne<any>(
      'SELECT id FROM records WHERE id = ? AND user_id = ?',
      [recordId, userId]
    );

    if (!record) {
      throw new AppError(404, '记录不存在');
    }

    // 删除记录（级联删除同步日志）
    await queryOne('DELETE FROM records WHERE id = ?', [recordId]);

    logger.info('Audio record deleted', { recordId, userId });

    res.json({
      success: true,
      message: '删除成功',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Delete audio error', { error: (error as Error).message });
    throw new AppError(500, '删除失败');
  }
}

// 重新转写
export async function retryTranscription(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.user!.id;
    const recordId = parseInt(req.params.id);

    if (!recordId) {
      throw new AppError(400, '无效的记录ID');
    }

    // 获取记录
    const record = await queryOne<any>(
      'SELECT id, audio_url FROM records WHERE id = ? AND user_id = ?',
      [recordId, userId]
    );

    if (!record) {
      throw new AppError(404, '记录不存在');
    }

    // 更新状态为处理中
    await queryOne(
      'UPDATE records SET asr_status = ? WHERE id = ?',
      ['processing', recordId]
    );

    // 异步进行语音转文字
    transcribeAudio(record.audio_url)
      .then(result => {
        if (result.success) {
          queryOne(
            `UPDATE records SET transcription = ?, asr_status = ? WHERE id = ?`,
            [result.text, 'success', recordId]
          );
        } else {
          queryOne(
            `UPDATE records SET asr_status = ? WHERE id = ?`,
            ['failed', recordId]
          );
        }
      });

    res.json({
      success: true,
      message: '开始重新转写',
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Retry transcription error', { error: (error as Error).message });
    throw new AppError(500, '重新转写失败');
  }
}
