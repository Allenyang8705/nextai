import { testFeishuConnection } from './src/services/feishu.js';

// 从数据库读取的配置
const testConfig = {
  appId: 'cli_a9d515208f789cda',
  appSecret: 'szaS9M0Vozui9JF0i5yMAbdYTV2k0EMB',
  documentId: 'Eavuwn8GViHamFlvCiEmrDniinHh',
};

console.log('========================================');
console.log('快速测试飞书连接');
console.log('========================================');
console.log('App ID:', testConfig.appId);
console.log('Document ID:', testConfig.documentId);
console.log('');

testFeishuConnection(testConfig).then((result) => {
  console.log('========================================');
  console.log('测试结果:');
  console.log('成功:', result.success);
  console.log('消息:', result.message);
  console.log('========================================');
  process.exit(result.success ? 0 : 1);
}).catch((error) => {
  console.error('发生错误:', error);
  process.exit(1);
});
