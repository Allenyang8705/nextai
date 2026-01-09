import axios from 'axios';
import { logger } from '../utils/logger.js';

// 飞书配置接口
export interface FeishuConfig {
  appId: string;
  appSecret: string;
  documentId: string;
}

// 同步结果
export interface SyncResult {
  success: boolean;
  message?: string;
}

// 缓存 tenant_access_token
let tokenCache: {
  token: string;
  expireAt: number;
} | null = null;

// 获取 tenant_access_token
export async function getTenantAccessToken(config: FeishuConfig): Promise<string> {
  // 检查缓存
  if (tokenCache && tokenCache.expireAt > Date.now()) {
    return tokenCache.token;
  }

  try {
    logger.info('Requesting feishu token', { appId: config.appId });

    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: config.appId,
        app_secret: config.appSecret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    const { code, tenant_access_token, expire, msg } = response.data;

    logger.info('Feishu token API response', {
      code,
      expire,
      msg,
    });

    if (code !== 0) {
      const errorMsg = `获取飞书 token 失败: code=${code}${msg ? `, msg=${msg}` : ''}`;
      logger.error('Feishu token API returned error', { code, msg });
      throw new Error(errorMsg);
    }

    // 缓存 token（提前5分钟过期）
    tokenCache = {
      token: tenant_access_token,
      expireAt: Date.now() + (expire - 300) * 1000,
    };

    logger.info('Feishu token obtained and cached');

    return tenant_access_token;
  } catch (error: any) {
    // 详细记录错误
    if (error.response) {
      logger.error('Get feishu token error', {
        status: error.response.status,
        data: error.response.data,
        message: error.message,
      });
    } else {
      logger.error('Get feishu token error', { error: (error as Error).message });
    }
    throw new Error(`获取飞书凭证失败: ${(error as Error).message}`);
  }
}

// 格式化语音记录为飞书文档格式
export function formatRecordForFeishu(record: {
  duration: number;
  created_at: Date;
  transcription: string;
  audio_url: string;
}): string {
  const date = new Date(record.created_at);

  // 格式化为：2025年12月31日 23:58
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');

  const dateTimeStr = `${year}年${month}月${day}日 ${hour}:${minute}`;

  // 飞书文档格式（段落形式）
  return `**${dateTimeStr}**
${record.transcription || '（转写中...）'}

---

`;
}

// 追加内容到飞书文档
export async function appendToFeishuDoc(
  config: FeishuConfig,
  content: string
): Promise<SyncResult> {
  try {
    logger.info('Appending content to feishu doc', { documentId: config.documentId, contentLength: content.length });

    const token = await getTenantAccessToken(config);

    // 1. 获取文档的块列表，找到最后一个块
    let blocksResponse;
    try {
      blocksResponse = await axios.get(
        `https://open.feishu.cn/open-apis/docx/v1/documents/${config.documentId}/blocks`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          params: {
            page_size: 50,
          },
        }
      );
      logger.info('Blocks retrieved', {
        code: blocksResponse.data.code,
        itemsCount: blocksResponse.data.data?.items?.length || 0,
      });
    } catch (error: any) {
      logger.error('Failed to get blocks', {
        error: error.message,
        response: error.response?.data,
      });
      throw error;
    }

    if (blocksResponse.data.code !== 0) {
      const errorMsg = `获取文档结构失败: code=${blocksResponse.data.code}, msg=${blocksResponse.data.msg || '无'}`;
      logger.error('Get blocks failed', {
        code: blocksResponse.data.code,
        msg: blocksResponse.data.msg,
      });
      throw new Error(errorMsg);
    }

    const items = blocksResponse.data.data?.items || [];
    const lastBlockId = items.length > 0 ? items[items.length - 1].block_id : null;

    logger.info('Last block ID', { blockId: lastBlockId, hasItems: items.length > 0 });

    // 2. 创建文本块并追加到文档
    let appendResponse;
    try {
      // 使用正确的 API 格式创建文本块
      const blockData = {
        children: [
          {
            block_type: 2, // 文本块
            text: {
              elements: [
                {
                  text_run: {
                    content: content,
                  }
                }
              ]
            }
          }
        ],
        index: -1
      };

      // 使用文档 ID 作为父块 ID
      const endpoint = `https://open.feishu.cn/open-apis/docx/v1/documents/${config.documentId}/blocks/${config.documentId}/children`;

      appendResponse = await axios.post(
        endpoint,
        blockData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );
      logger.info('Append response', {
        endpoint,
        status: appendResponse.status,
        code: appendResponse.data.code,
        msg: appendResponse.data.msg,
      });
    } catch (error: any) {
      logger.error('Failed to append content', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      throw error;
    }

    if (appendResponse.data.code !== 0) {
      const errorMsg = `追加内容失败: code=${appendResponse.data.code}, msg=${appendResponse.data.msg || '无'}`;
      logger.error('Append content failed', {
        code: appendResponse.data.code,
        msg: appendResponse.data.msg,
      });
      throw new Error(errorMsg);
    }

    logger.info('Content appended to feishu doc successfully', { documentId: config.documentId });

    return {
      success: true,
      message: '同步成功',
    };
  } catch (error) {
    logger.error('Append to feishu doc error', { error: (error as Error).message });
    return {
      success: false,
      message: (error as Error).message,
    };
  }
}

// 测试飞书连接
export async function testFeishuConnection(config: FeishuConfig): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    logger.info('Testing feishu connection', {
      appId: config.appId,
      documentId: config.documentId,
    });

    // 步骤1: 获取 token
    let token: string;
    try {
      token = await getTenantAccessToken(config);
      logger.info('Token obtained successfully');
    } catch (error) {
      logger.error('Failed to get token', {
        error: (error as Error).message,
        stack: (error as Error).stack,
      });
      return {
        success: false,
        message: `获取访问令牌失败: ${(error as Error).message}`,
      };
    }

    // 步骤2: 尝试获取文档信息
    let docResponse;
    try {
      docResponse = await axios.get(
        `https://open.feishu.cn/open-apis/docx/v1/documents/${config.documentId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );
      logger.info('Document API response', {
        status: docResponse.status,
        data: JSON.stringify(docResponse.data),
      });
    } catch (error: any) {
      logger.error('Document API request failed', {
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // 提取详细错误信息
      const errorData = error.response?.data;
      const errorCode = errorData?.code;
      const errorMsg = errorData?.msg;

      let errorMessage = `文档访问失败 (HTTP ${error.response?.status})`;
      if (errorCode) {
        errorMessage += `: code=${errorCode}`;
      }
      if (errorMsg) {
        errorMessage += `, msg=${errorMsg}`;
      }

      return {
        success: false,
        message: errorMessage,
      };
    }

    if (docResponse.data.code !== 0) {
      logger.error('Document API returned error code', {
        code: docResponse.data.code,
        msg: docResponse.data.msg,
      });
      return {
        success: false,
        message: `文档访问失败: code=${docResponse.data.code}, msg=${docResponse.data.msg}`,
      };
    }

    const title = docResponse.data.data?.document?.title || '未知文档';

    logger.info('Feishu connection test successful', { title });

    return {
      success: true,
      message: `连接成功，文档: ${title}`,
    };
  } catch (error) {
    logger.error('Feishu connection test unexpected error', {
      error: (error as Error).message,
      stack: (error as Error).stack,
    });
    return {
      success: false,
      message: `连接失败: ${(error as Error).message}`,
    };
  }
}

// 清除 token 缓存（用于测试）
export function clearTokenCache(): void {
  tokenCache = null;
}
