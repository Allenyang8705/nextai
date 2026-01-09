import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';

// ==================== OSS 文件存储 ====================

// 阿里云 OSS 客户端（延迟初始化）
let ossClient: any = null;

function getOSSClient(): any {
  if (!config.aliyun.accessKeyId || !config.aliyun.accessKeySecret) {
    return null;
  }

  if (!ossClient) {
    const OSS = require('ali-oss');
    ossClient = new OSS({
      accessKeyId: config.aliyun.accessKeyId,
      accessKeySecret: config.aliyun.accessKeySecret,
      bucket: config.aliyun.ossBucket,
      region: config.aliyun.ossRegion,
      secure: true,
    });
  }

  return ossClient;
}

export function isOSSConfigured(): boolean {
  return !!(config.aliyun.accessKeyId && config.aliyun.accessKeySecret && config.aliyun.ossBucket);
}

export async function uploadToOSS(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<string | null> {
  try {
    const client = getOSSClient();
    if (!client) {
      return null;
    }

    const result = await client.put(fileName, fileBuffer, {
      headers: {
        'Content-Type': contentType,
      },
    });

    // 生成带签名的 URL（有效期1小时）
    const signedUrl = client.signatureUrl(fileName, { expires: 3600 });

    logger.info('File uploaded to OSS', { name: fileName, url: result.url });
    return signedUrl;
  } catch (error) {
    logger.error('OSS upload error', { error: (error as Error).message });
    return null;
  }
}

export async function getSignedUrl(fileName: string, expires: number = 3600): Promise<string | null> {
  try {
    const client = getOSSClient();
    if (!client) {
      return null;
    }

    const signedUrl = client.signatureUrl(fileName, { expires });
    return signedUrl;
  } catch (error) {
    logger.error('OSS get signed URL error', { error: (error as Error).message });
    return null;
  }
}

export async function deleteFromOSS(fileName: string): Promise<boolean> {
  try {
    const client = getOSSClient();
    if (!client) {
      return false;
    }

    await client.delete(fileName);
    logger.info('File deleted from OSS', { name: fileName });
    return true;
  } catch (error) {
    logger.error('OSS delete error', { error: (error as Error).message });
    return false;
  }
}

export async function deleteMultipleFromOSS(fileNames: string[]): Promise<{ success: string[]; failed: string[] }> {
  const result = { success: [] as string[], failed: [] as string[] };

  try {
    const client = getOSSClient();
    if (!client) {
      result.failed.push(...fileNames);
      return result;
    }

    await client.deleteMulti(fileNames);
    result.success.push(...fileNames);
  } catch (error) {
    logger.error('OSS batch delete error', { error: (error as Error).message });
    result.failed.push(...fileNames);
  }

  return result;
}

export function getPublicUrl(fileName: string): string | null {
  try {
    if (!config.aliyun.ossBucket || !config.aliyun.ossRegion) {
      return null;
    }

    return `https://${config.aliyun.ossBucket}.${config.aliyun.ossRegion}.aliyuncs.com/${fileName}`;
  } catch (error) {
    return null;
  }
}

// ==================== 腾讯云语音转文字 ====================

export function isASRConfigured(): boolean {
  return !!(config.tencent.secretId && config.tencent.secretKey);
}

/**
 * 使用腾讯云语音转文字（录音文件识别 API）- 使用官方 SDK
 */
async function transcribeWithTencent(audioUrl: string): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  try {
    const { secretId, secretKey, region } = config.tencent;

    if (!secretId || !secretKey) {
      return {
        success: false,
        error: '腾讯云 ASR 未配置',
      };
    }

    logger.info('Tencent ASR transcription requested', { audioUrl });

    // 1. 获取音频文件内容
    let audioBase64: string;
    let audioDataLen: number;

    if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
      // 从 URL 获取音频
      const response = await fetch(audioUrl);
      if (!response.ok) {
        return {
          success: false,
          error: `下载音频失败: ${response.statusText}`,
        };
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      audioBase64 = buffer.toString('base64');
      audioDataLen = buffer.length;
    } else {
      // 本地文件
      const audioBuffer = await fs.readFile(audioUrl);
      audioBase64 = audioBuffer.toString('base64');
      audioDataLen = audioBuffer.length;
    }

    logger.info('Audio file loaded', { size: audioDataLen });

    // 2. 导入腾讯云 ASR SDK
    const tencentcloud = require('tencentcloud-sdk-nodejs-asr');
    const AsrClient = tencentcloud.asr.v20190614.Client;

    // 3. 创建客户端
    const clientConfig = {
      credential: {
        secretId,
        secretKey,
      },
      region: region || 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'asr.tencentcloudapi.com',
        },
      },
    };

    const client = new AsrClient(clientConfig);

    // 4. 调用 CreateRecTask 接口
    const createParams = {
      EngineModelType: '16k_zh',
      ChannelNum: 1,
      ResTextFormat: 0,
      SourceType: 1,  // 1 = 音频数据(base64)
      Data: audioBase64,
      DataLen: audioDataLen,
    };

    logger.info('Creating ASR task', { audioSize: audioDataLen });

    const createResult = await client.CreateRecTask(createParams);

    // SDK 返回结构: { RequestId, TaskId } 或 { RequestId, Data: { TaskId } }
    const taskId = createResult.TaskId || createResult.Data?.TaskId;

    if (!taskId) {
      logger.error('CreateRecTask failed - no TaskId', { createResult });
      return {
        success: false,
        error: '未获取到任务ID',
      };
    }

    logger.info('Tencent ASR task created', { taskId });

    // 5. 轮询查询结果
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const queryResult = await client.DescribeTaskStatus({ TaskId: taskId });

      // SDK 返回结构: { RequestId, Data: { Status, StatusStr, Result, ErrorMsg } }
      const status = queryResult.Data?.Status;
      const statusStr = queryResult.Data?.StatusStr;

      logger.info('Tencent ASR query result', {
        attempt: i + 1,
        status,
        statusStr,
      });

      if (status === 2) {
        // 识别成功
        const text = queryResult.Data?.Result || '';
        logger.info('Tencent ASR completed', { textLength: text.length });
        return {
          success: true,
          text,
        };
      }

      if (status === 3 || status === 4) {
        // 失败
        const errorMsg = queryResult.Data?.ErrorMsg || queryResult.Data?.StatusStr || '识别失败';
        logger.error('Tencent ASR failed', { status, errorMsg });
        return {
          success: false,
          error: errorMsg,
        };
      }

      // status = 0 或 1，继续等待
      logger.info('Tencent ASR processing', { attempt: i + 1, status });
    }

    return {
      success: false,
      error: '识别超时',
    };
  } catch (error: any) {
    logger.error('Tencent ASR error', {
      message: error.message,
      code: error.code,
      stack: error.stack,
    });
    return {
      success: false,
      error: error.message || '识别失败',
    };
  }
}

/**
 * 将本地文件读取为 Buffer（用于 ASR）
 */
async function readLocalFile(filePath: string): Promise<Buffer | null> {
  try {
    return await fs.readFile(filePath);
  } catch (error) {
    logger.error('Read local file error', { error: (error as Error).message });
    return null;
  }
}

/**
 * 清理 ASR 转写结果，去除时间戳
 * 时间戳格式示例：[0:0.520,0:5.472] 或 [0:4.160,0:6.660]
 */
function cleanTranscriptionText(text: string): string {
  if (!text) return text;

  // 使用正则表达式去除所有时间戳
  // 匹配格式：[数字:数字.数字,数字:数字.数字]
  return text.replace(/\[\d+:\d+\.\d+,\d+:\d+\.\d+\]\s*/g, '');
}

/**
 * 使用腾讯云 ASR 进行语音转文字
 */
export async function transcribeAudio(audioUrl: string): Promise<{
  success: boolean;
  text?: string;
  error?: string;
}> {
  // 如果没有配置腾讯云凭证，返回提示
  if (!isASRConfigured()) {
    logger.info('Tencent ASR not configured, returning mock result');
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      success: true,
      text: '未配置腾讯云 ASR 服务。请在环境变量中配置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY。',
    };
  }

  try {
    let finalAudioUrl = audioUrl;

    // 检查是否是本地文件路径
    if (audioUrl.startsWith('/uploads/') || audioUrl.includes('localhost') || audioUrl.includes('192.168')) {
      logger.info('Local file detected for ASR', { audioUrl });

      // 提取本地文件路径
      let localPath = audioUrl;
      if (audioUrl.startsWith('http://') || audioUrl.startsWith('https://')) {
        localPath = audioUrl.replace(/^https?:\/\/[^/]+\/uploads\//, '').replace(/^\/uploads\//, '');
        localPath = `${process.cwd()}/uploads/${localPath}`;
      }

      logger.info('Reading local file', { localPath });
      const result = await transcribeWithTencent(localPath);

      // 清理转写结果，去除时间戳
      if (result.success && result.text) {
        result.text = cleanTranscriptionText(result.text);
      }

      return result;
    }

    // 远程 URL
    logger.info('Remote URL for ASR', { audioUrl });
    const result = await transcribeWithTencent(audioUrl);

    // 清理转写结果，去除时间戳
    if (result.success && result.text) {
      result.text = cleanTranscriptionText(result.text);
    }

    return result;
  } catch (error) {
    logger.error('ASR transcription error', { error: (error as Error).message });
    return {
      success: false,
      error: (error as Error).message,
    };
  }
}
