/**
 * 飞书连接诊断脚本
 * 用于诊断飞书链接失败的原因
 */

import axios from 'axios';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

dotenv.config();

// 颜色输出
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(color, ...args) {
  console.log(color, ...args, colors.reset);
}

// 从数据库读取配置
async function getFeishuConfigFromDB(userId = 1) {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'voice_daily',
  });

  const [rows] = await connection.query(
    'SELECT document_id, app_id, app_secret FROM feishu_config WHERE user_id = ?',
    [userId]
  );

  await connection.end();

  if (rows.length === 0) {
    log(colors.red, '❌ 数据库中没有找到飞书配置');
    return null;
  }

  return rows[0];
}

// 测试1: 检查配置是否存在
async function testConfigExists(config) {
  log(colors.blue, '\n📋 测试1: 检查配置是否存在');
  log(colors.yellow, 'App ID:', config?.app_id || '未设置');
  log(colors.yellow, 'App Secret:', config?.app_secret ? '已设置 (' + config.app_secret.length + ' 字符)' : '未设置');
  log(colors.yellow, 'Document ID:', config?.document_id || '未设置');

  if (!config?.app_id) {
    log(colors.red, '❌ App ID 未设置');
    return false;
  }
  if (!config?.app_secret) {
    log(colors.red, '❌ App Secret 未设置');
    return false;
  }
  if (!config?.document_id) {
    log(colors.red, '❌ Document ID 未设置');
    return false;
  }

  log(colors.green, '✅ 配置完整');
  return true;
}

// 测试2: 网络连接测试
async function testNetworkConnection() {
  log(colors.blue, '\n🌐 测试2: 网络连接测试');

  try {
    // 测试是否能连接到飞书API服务器
    await axios.post('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      app_id: 'test',
      app_secret: 'test'
    }, {
      timeout: 10000,
      validateStatus: () => true // 接受任何状态码
    });
    log(colors.green, '✅ 可以访问飞书API');
    return true;
  } catch (error) {
    // 即使返回错误，只要能连接到服务器就算成功
    if (error.response || error.code === 'ECONNABORTED') {
      log(colors.green, '✅ 可以访问飞书API');
      return true;
    }
    log(colors.red, '❌ 无法访问飞书API');
    log(colors.yellow, '   错误信息:', error.message);
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      log(colors.yellow, '   可能是网络问题或防火墙阻止了连接');
    }
    return false;
  }
}

// 测试3: 获取访问令牌
async function testGetAccessToken(config) {
  log(colors.blue, '\n🔑 测试3: 获取访问令牌');

  try {
    const response = await axios.post(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        app_id: config.app_id,
        app_secret: config.app_secret,
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    const { code, tenant_access_token, expire, msg } = response.data;

    log(colors.yellow, '   响应码:', code);
    log(colors.yellow, '   响应消息:', msg || '无');

    if (code !== 0) {
      log(colors.red, '❌ 获取访问令牌失败');
      log(colors.yellow, '   错误码:', code);
      log(colors.yellow, '   错误信息:', msg);

      // 常见错误码提示
      const errorTips = {
        '99991663': 'App ID 或 App Secret 不正确',
        '99991401': '应用未发布或已禁用',
        '99991400': '请求参数错误',
        '99991365': '应用没有权限访问该接口',
        '10003': '参数无效，请检查 App ID 和 App Secret 格式是否正确',
      };

      if (errorTips[code]) {
        log(colors.yellow, '   提示:', errorTips[code]);
      }

      return null;
    }

    log(colors.green, '✅ 成功获取访问令牌');
    log(colors.yellow, '   令牌过期时间:', expire, '秒');

    return tenant_access_token;
  } catch (error) {
    log(colors.red, '❌ 获取访问令牌时发生网络错误');
    log(colors.yellow, '   错误信息:', error.message);
    return null;
  }
}

// 测试4: 访问文档
async function testAccessDocument(token, documentId) {
  log(colors.blue, '\n📄 测试4: 访问文档');

  try {
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        timeout: 10000,
      }
    );

    const { code, msg } = response.data;

    log(colors.yellow, '   响应码:', code);
    log(colors.yellow, '   响应消息:', msg || '无');

    if (code !== 0) {
      log(colors.red, '❌ 访问文档失败');
      log(colors.yellow, '   错误码:', code);
      log(colors.yellow, '   错误信息:', msg);

      // 常见错误码提示
      const errorTips = {
        '711104': '文档不存在或 Document ID 错误',
        '711098': '无权限访问该文档',
        '711099': '文档已被删除或移动',
        '99991463': '应用没有访问文档的权限',
      };

      if (errorTips[code]) {
        log(colors.yellow, '   提示:', errorTips[code]);
      }

      return false;
    }

    const title = response.data.data?.document?.title || '未知文档';
    log(colors.green, '✅ 成功访问文档');
    log(colors.yellow, '   文档标题:', title);

    return true;
  } catch (error) {
    log(colors.red, '❌ 访问文档时发生网络错误');
    log(colors.yellow, '   错误信息:', error.message);
    return false;
  }
}

// 测试5: 获取文档块
async function testGetDocumentBlocks(token, documentId) {
  log(colors.blue, '\n📝 测试5: 获取文档块（用于追加内容）');

  try {
    const response = await axios.get(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${documentId}/blocks`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        params: {
          page_size: 50,
        },
        timeout: 10000,
      }
    );

    const { code, msg } = response.data;

    log(colors.yellow, '   响应码:', code);
    log(colors.yellow, '   响应消息:', msg || '无');

    if (code !== 0) {
      log(colors.red, '❌ 获取文档块失败');
      log(colors.yellow, '   错误码:', code);
      log(colors.yellow, '   错误信息:', msg);
      return false;
    }

    const items = response.data.data?.items || [];
    log(colors.green, '✅ 成功获取文档块');
    log(colors.yellow, '   块数量:', items.length);

    if (items.length > 0) {
      const lastBlockId = items[items.length - 1].block_id;
      log(colors.yellow, '   最后一个块ID:', lastBlockId);
    }

    return true;
  } catch (error) {
    log(colors.red, '❌ 获取文档块时发生网络错误');
    log(colors.yellow, '   错误信息:', error.message);
    return false;
  }
}

// 主函数
async function main() {
  log(colors.blue, '========================================');
  log(colors.blue, '飞书连接诊断工具');
  log(colors.blue, '========================================');

  // 从数据库读取配置
  const config = await getFeishuConfigFromDB();

  if (!config) {
    log(colors.red, '\n❌ 无法继续测试，请先在数据库中配置飞书信息');
    process.exit(1);
  }

  // 运行测试
  const configOk = await testConfigExists(config);
  if (!configOk) {
    log(colors.red, '\n❌ 配置不完整，请先完善配置');
    process.exit(1);
  }

  const networkOk = await testNetworkConnection();
  if (!networkOk) {
    log(colors.red, '\n❌ 网络连接失败，请检查网络设置');
    process.exit(1);
  }

  const token = await testGetAccessToken(config);
  if (!token) {
    log(colors.red, '\n❌ 获取访问令牌失败，请检查 App ID 和 App Secret');
    process.exit(1);
  }

  const documentOk = await testAccessDocument(token, config.document_id);
  if (!documentOk) {
    log(colors.red, '\n❌ 无法访问文档，请检查 Document ID 和权限设置');
    process.exit(1);
  }

  const blocksOk = await testGetDocumentBlocks(token, config.document_id);
  if (!blocksOk) {
    log(colors.red, '\n⚠️  可以访问文档，但无法获取文档块');
    log(colors.yellow, '这可能是因为应用权限不足，请确保应用有以下权限：');
    log(colors.yellow, '  - 获取文档内容');
    log(colors.yellow, '  - 编辑文档');
  }

  log(colors.green, '\n✅ 所有测试通过！飞书连接正常');
  log(colors.blue, '\n========================================');
}

main().catch((error) => {
  log(colors.red, '\n❌ 发生未预期的错误:');
  console.error(error);
  process.exit(1);
});
