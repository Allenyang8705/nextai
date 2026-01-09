import { formatRecordForFeishu } from './src/services/feishu.js';

// 测试数据
const testRecord = {
  duration: 60,
  created_at: new Date(),
  transcription: '这是一条测试语音记录',
  audio_url: 'https://example.com/audio.mp3',
};

const result = formatRecordForFeishu(testRecord);

console.log('========================================');
console.log('格式化结果：');
console.log('========================================');
console.log(result);
console.log('========================================');
console.log('内容长度:', result.length);
console.log('========================================');
