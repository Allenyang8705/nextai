/**
 * 调试腾讯云 ASR API 响应结构
 */

require('dotenv').config();
const tencentcloud = require('tencentcloud-sdk-nodejs-asr');
const fs = require('fs');

async function debugASRAPI() {
  console.log('='.repeat(70));
  console.log('调试腾讯云 ASR API 响应结构');
  console.log('='.repeat(70));

  const { TENCENT_SECRET_ID, TENCENT_SECRET_KEY, TENCENT_REGION } = process.env;

  // 创建测试音频
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const duration = 1;
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = sampleRate * duration * blockAlign;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(fileSize);
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  const audioBase64 = buffer.toString('base64');

  // 创建客户端
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

  // 调用 API
  const createParams = {
    EngineModelType: '16k_zh',
    ChannelNum: 1,
    ResTextFormat: 0,
    SourceType: 1,
    Data: audioBase64,
    DataLen: buffer.length,
  };

  console.log('\n📤 发送请求...');
  console.log('参数:', JSON.stringify(createParams, null, 2));

  try {
    const createResult = await client.CreateRecTask(createParams);

    console.log('\n📥 完整响应:');
    console.log(JSON.stringify(createResult, null, 2));

    console.log('\n🔍 分析响应结构:');
    console.log('- 响应键:', Object.keys(createResult));
    console.log('- RequestId:', createResult.RequestId);
    console.log('- TaskId:', createResult.TaskId);
    console.log('- Data:', createResult.Data);

    if (createResult.Data) {
      console.log('- Data.TaskId:', createResult.Data.TaskId);
      console.log('- Data 的键:', Object.keys(createResult.Data));
    }

    console.log('\n✅ 成功获取任务ID!');
    const taskId = createResult.TaskId || createResult.Data?.TaskId;
    console.log('最终任务ID:', taskId);

    // 测试查询
    if (taskId) {
      console.log('\n📝 测试查询接口...');
      const queryResult = await client.DescribeTaskStatus({ TaskId: taskId });
      console.log('查询响应:', JSON.stringify(queryResult, null, 2));
    }

  } catch (error) {
    console.error('\n❌ 错误:', error.message);
    console.error('错误详情:', error);
  }

  console.log('\n' + '='.repeat(70));
}

debugASRAPI().catch(err => {
  console.error('未捕获错误:', err);
  process.exit(1);
});
