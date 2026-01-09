/**
 * 腾讯云 ASR 完整功能测试脚本
 * 测试真实的语音识别流程
 */

const tencentcloud = require('tencentcloud-sdk-nodejs-asr');
const fs = require('fs');
const path = require('path');

// 从 .env 文件读取配置
require('dotenv').config();

const { TENCENT_SECRET_ID, TENCENT_SECRET_KEY, TENCENT_REGION } = process.env;

// 创建一个简单的测试音频（1秒的静音 WAV 文件）
function createTestAudioFile() {
  const filePath = path.join(__dirname, 'test-audio.wav');

  // WAV 文件头 + 1秒静音数据 (16kHz, 16bit, mono)
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const duration = 1; // 1秒
  const byteRate = sampleRate * numChannels * bitsPerSample / 8;
  const blockAlign = numChannels * bitsPerSample / 8;
  const dataSize = sampleRate * duration * blockAlign;
  const fileSize = 36 + dataSize;

  const buffer = Buffer.alloc(fileSize);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(fileSize, 4);
  buffer.write('WAVE', 8);

  // fmt chunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // chunk size
  buffer.writeUInt16LE(1, 20); // audio format (PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);

  // data chunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  // 写入文件
  fs.writeFileSync(filePath, buffer);

  return filePath;
}

async function testASRWithRealAudio() {
  console.log('='.repeat(70));
  console.log('腾讯云 ASR 完整功能测试');
  console.log('='.repeat(70));

  if (!TENCENT_SECRET_ID || !TENCENT_SECRET_KEY) {
    console.error('❌ 错误：未配置腾讯云密钥');
    process.exit(1);
  }

  console.log('\n📋 配置信息：');
  console.log(`  Secret ID: ${TENCENT_SECRET_ID.substring(0, 15)}...`);
  console.log(`  Secret Key: ${TENCENT_SECRET_KEY.substring(0, 15)}...`);
  console.log(`  Region: ${TENCENT_REGION || 'ap-guangzhou'}`);

  let testFilePath = null;

  try {
    // 1. 创建测试音频文件
    console.log('\n1️⃣ 创建测试音频文件...');
    testFilePath = createTestAudioFile();
    const audioBuffer = fs.readFileSync(testFilePath);
    const audioBase64 = audioBuffer.toString('base64');
    console.log('✅ 测试音频文件创建成功');
    console.log(`   文件路径: ${testFilePath}`);
    console.log(`   文件大小: ${audioBuffer.length} bytes`);

    // 2. 创建 ASR 客户端
    console.log('\n2️⃣ 创建 ASR 客户端...');
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

    // 3. 调用 CreateRecTask 创建识别任务
    console.log('\n3️⃣ 调用 CreateRecTask 创建识别任务...');

    const createParams = {
      EngineModelType: '16k_zh',
      ChannelNum: 1,
      ResTextFormat: 0,
      SourceType: 1,  // base64
      Data: audioBase64,
      DataLen: audioBuffer.length,
    };

    console.log('   请求参数:');
    console.log(`   - EngineModelType: ${createParams.EngineModelType}`);
    console.log(`   - ChannelNum: ${createParams.ChannelNum}`);
    console.log(`   - ResTextFormat: ${createParams.ResTextFormat}`);
    console.log(`   - SourceType: ${createParams.SourceType}`);
    console.log(`   - DataLen: ${createParams.DataLen}`);

    const createResult = await client.CreateRecTask(createParams);

    console.log('\n   API 响应:');
    console.log(JSON.stringify(createResult, null, 2));

    // SDK 返回结构可能是: { RequestId, Data: { TaskId } }
    const taskId = createResult.TaskId || createResult.Data?.TaskId;

    if (!taskId) {
      console.log('\n❌ 未获取到任务 ID');
      console.log('   响应数据: ', createResult);
      process.exit(1);
    }

    console.log('\n✅ 任务创建成功');
    console.log(`   任务 ID: ${taskId}`);

    // 4. 轮询查询结果
    console.log('\n4️⃣ 轮询查询识别结果...');
    console.log('   注意: 静音音频可能会返回空结果或很快完成');

    const maxAttempts = 30;
    let finalStatus = null;
    let finalResult = null;

    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000));

      const queryResult = await client.DescribeTaskStatus({ TaskId: taskId });

      // SDK 返回结构: { RequestId, Data: { Status, StatusStr, Result, ErrorMsg } }
      const status = queryResult.Data?.Status;
      const statusStr = queryResult.Data?.StatusStr;

      console.log(`   [${i + 1}/${maxAttempts}] 状态: ${status} (${statusStr})`);

      if (status === 2) {
        // 识别成功
        const result = queryResult.Data?.Result || '';
        finalStatus = 'success';
        finalResult = result;

        console.log('\n✅ 识别完成');
        console.log(`   识别结果: "${result}"`);
        console.log(`   结果长度: ${result.length} 字符`);

        // 获取详细信息
        if (queryResult.Data?.ResultDetail) {
          console.log(`   详细信息: ${JSON.stringify(queryResult.Data.ResultDetail).substring(0, 200)}...`);
        }
        break;
      }

      if (status === 3 || status === 4) {
        // 失败
        finalStatus = 'failed';
        const errorMsg = queryResult.Data?.ErrorMsg || queryResult.Data?.StatusStr || '识别失败';

        console.log('\n❌ 识别失败');
        console.log(`   错误信息: ${errorMsg}`);

        if (queryResult.Data?.ErrorMsg) {
          console.log(`   错误详情: ${queryResult.Data.ErrorMsg}`);
        }
        break;
      }

      // status = 0 或 1，继续等待
      process.stdout.write('   等待中...\r');
    }

    if (!finalStatus) {
      console.log('\n⚠️  识别超时');
      console.log('   可能原因:');
      console.log('   1. 音频处理时间过长');
      console.log('   2. 系统繁忙');
    }

    // 5. 测试总结
    console.log('\n' + '='.repeat(70));
    console.log('测试总结');
    console.log('='.repeat(70));
    console.log(`✅ SDK 连接: 正常`);
    console.log(`✅ 密钥认证: 正常`);
    console.log(`✅ CreateRecTask API: 正常`);
    console.log(`✅ DescribeTaskStatus API: 正常`);

    if (finalStatus === 'success') {
      console.log(`✅ 识别流程: 成功`);
      console.log(`📝 识别结果: ${finalResult ? '(有内容)' : '(空内容 - 静音音频)'}`);
    } else if (finalStatus === 'failed') {
      console.log(`⚠️  识别流程: 失败`);
    } else {
      console.log(`⚠️  识别流程: 超时`);
    }

    console.log('\n💡 说明:');
    console.log('   - 测试音频是 1 秒静音，识别结果可能为空');
    console.log('   - 如果任务创建和查询都成功，说明 API 调用正常');
    console.log('   - 实际使用时，使用真实录音应能获得正确识别结果');

  } catch (error) {
    console.error('\n❌ 测试过程出错：');
    console.error(`   错误类型: ${error.name}`);
    console.error(`   错误信息: ${error.message}`);
    if (error.code) {
      console.error(`   错误代码: ${error.code}`);
    }
    console.error('\n堆栈信息：');
    console.error(error.stack);
  } finally {
    // 清理测试文件
    if (testFilePath && fs.existsSync(testFilePath)) {
      try {
        fs.unlinkSync(testFilePath);
        console.log(`\n🧹 清理测试文件: ${testFilePath}`);
      } catch (err) {
        console.log(`\n⚠️  清理测试文件失败: ${err.message}`);
      }
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('测试完成');
  console.log('='.repeat(70));
}

// 运行测试
testASRWithRealAudio().catch(error => {
  console.error('未捕获的错误：', error);
  process.exit(1);
});
