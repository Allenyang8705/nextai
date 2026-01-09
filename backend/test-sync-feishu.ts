import { appendToFeishuDoc, formatRecordForFeishu } from './src/services/feishu.js';

// 从数据库读取的配置
const testConfig = {
  appId: 'cli_a9d515208f789cda',
  appSecret: 'szaS9M0Vozui9JF0i5yMAbdYTV2k0EMB',
  documentId: 'Eqy0wo8GXiHqmEkCjFmcP0ijnHb',
};

// 模拟一条语音记录
const testRecord = {
  duration: 5,
  created_at: new Date(),
  transcription: '这是一条测试语音记录，用于验证飞书同步功能。',
  audio_url: 'https://voice-daily-audio.oss-cn-hangzhou.aliyuncs.com/test/audio.mp3',
};

console.log('========================================');
console.log('测试飞书文档内容追加');
console.log('========================================');
console.log('Document ID:', testConfig.documentId);
console.log('文档标题: my day');
console.log('');

// 格式化内容
const content = formatRecordForFeishu(testRecord);
console.log('要追加的内容:');
console.log('----------------------------------------');
console.log(content);
console.log('----------------------------------------');
console.log('');

// 追加到文档
appendToFeishuDoc(testConfig, content).then((result) => {
  console.log('========================================');
  console.log('同步结果:');
  console.log('成功:', result.success);
  console.log('消息:', result.message);
  console.log('========================================');

  if (result.success) {
    console.log('');
    console.log('✅ 所有权限已开通！');
    console.log('✅ 可以正常读取和编辑飞书文档');
    console.log('');
    console.log('请检查飞书文档 "my day" 查看追加的内容');
  }

  process.exit(result.success ? 0 : 1);
}).catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});
