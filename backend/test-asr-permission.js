/**
 * 腾讯云 ASR 权限测试脚本
 * 使用方法：node test-asr-permission.js
 */

const tencentcloud = require('tencentcloud-sdk-nodejs-asr');

// 从 .env 文件读取配置
require('dotenv').config();

const { TENCENT_SECRET_ID, TENCENT_SECRET_KEY, TENCENT_REGION } = process.env;

async function testASRPermission() {
  console.log('='.repeat(60));
  console.log('腾讯云 ASR 权限测试');
  console.log('='.repeat(60));

  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
    console.error('❌ 错误：未配置腾讯云密钥');
    console.log('请在 .env 文件中设置 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY');
    process.exit(1);
  }

  console.log('\n📋 配置信息：');
  console.log(`  Secret ID: ${TENCENT_SECRET_ID.substring(0, 10)}...`);
  console.log(`  Secret Key: ${TENCENT_SECRET_KEY.substring(0, 10)}...`);
  console.log(`  Region: ${TENCENT_REGION || 'ap-guangzhou'}`);

  try {
    // 1. 创建客户端
    console.log('\n1️⃣ 创建 ASR 客户端...');
    const AsrClient = tencentcloud.asr.v20190614.Client;

    const clientConfig = {
      credential: {
        secretId: TENCENT_SECRET_ID,
        secretKey: TENCENT_SECRET_KEY,
      },
      region: TENCENT_REGION || 'ap-guangzhou',
      profile: {
        httpProfile: {
          endpoint: 'asr.tencentcloudapi.com',
        },
      },
    };

    const client = new AsrClient(clientConfig);
    console.log('✅ 客户端创建成功');

    // 2. 测试创建任务权限（使用一个小的测试音频数据）
    console.log('\n2️⃣ 测试 CreateRecTask 权限...');

    // 创建一个最小的测试音频数据（空音频，仅用于测试权限）
    // 实际使用时应该是真实的音频数据
    const testAudioBase64 = Buffer.from('test').toString('base64');

    const createParams = {
      EngineModelType: '16k_zh',
      ChannelNum: 1,
      ResTextFormat: 0,
      SourceType: 1,
      Data: testAudioBase64,
      DataLen: 4,
    };

    try {
      const createResult = await client.CreateRecTask(createParams);

      if (createResult.Response?.Error) {
        const error = createResult.Response.Error;

        // 检查是否是权限错误
        if (error.Code === 'AuthFailure' || error.Code === 'UnauthorizedOperation') {
          console.log('❌ CreateRecTask 权限不足');
          console.log(`   错误代码: ${error.Code}`);
          console.log(`   错误信息: ${error.Message}`);
          console.log('\n💡 解决方案：');
          console.log('   1. 访问腾讯云控制台：https://console.cloud.tencent.com/cam');
          console.log('   2. 检查该密钥对应的用户是否有 ASR 服务权限');
          console.log('   3. 或使用主账号密钥进行测试');
        } else {
          console.log(`⚠️  其他错误: ${error.Message}`);
          console.log(`   错误代码: ${error.Code}`);
        }
      } else {
        console.log('✅ CreateRecTask 权限正常');
        console.log(`   任务 ID: ${createResult.Response?.Data?.TaskId}`);
      }
    } catch (err) {
      console.log('❌ CreateRecTask 请求失败');
      console.log(`   错误: ${err.message}`);

      if (err.code === 'AuthFailure.InvalidAuthorization') {
        console.log('\n💡 可能的原因：');
        console.log('   1. 密钥错误（Secret ID 或 Secret Key 不正确）');
        console.log('   2. 密钥已删除或禁用');
        console.log('   3. 网络连接问题');
      }
    }

    // 3. 检查服务是否开通
    console.log('\n3️⃣ 检查 ASR 服务状态...');

    // 尝试获取服务概览信息
    // 注意：如果没有专门的 API，可以通过错误信息判断
    console.log('💡 提示：访问 https://console.cloud.tencent.com/asr 确认服务是否已开通');

  } catch (error) {
    console.error('\n❌ 测试过程出错：');
    console.error(error.message);
    console.error('\n堆栈信息：');
    console.error(error.stack);
  }

  console.log('\n' + '='.repeat(60));
  console.log('测试完成');
  console.log('='.repeat(60));
  console.log('\n📖 相关文档：');
  console.log('  - ASR 控制台: https://console.cloud.tencent.com/asr');
  console.log('  - CAM 访问管理: https://console.cloud.tencent.com/cam');
  console.log('  - API 密钥管理: https://console.cloud.tencent.com/cam/capi');
  console.log('  - 权限策略语法: https://cloud.tencent.com/document/product/1093/48423');
}

// 运行测试
testASRPermission().catch(error => {
  console.error('未捕获的错误：', error);
  process.exit(1);
});
