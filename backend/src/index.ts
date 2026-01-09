import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, validateConfig } from './config/env.js';
import { testConnection } from './config/database.js';
import { logger } from './utils/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';

// 路由
import authRouter from './routes/auth.js';
import audioRouter from './routes/audio.js';
import feishuRouter from './routes/feishu.js';

// 服务
import { syncRetryQueue } from './services/syncQueue.js';

// 获取当前文件目录
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 创建 Express 应用
const app = express();

// 中间件
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务 - 用于访问本地上传的音频文件
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 请求日志
app.use((req, res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    query: req.query,
    body: req.body && req.body.password ? { ...req.body, password: '***' } : req.body,
  });
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API 路由
app.use('/api/auth', authRouter);
app.use('/api/audio', audioRouter);
app.use('/api/feishu', feishuRouter);

// 404 处理
app.use(notFoundHandler);

// 错误处理
app.use(errorHandler);

// 启动服务器
async function startServer(): Promise<void> {
  try {
    // 验证环境变量
    validateConfig();

    // 测试数据库连接
    await testConnection();

    // 启动飞书同步重试队列
    logger.info('Starting Feishu sync retry queue');
    // syncRetryQueue 已在导入时自动启动

    // 启动服务器
    app.listen(config.port, () => {
      logger.info(`Server started on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

// 优雅关闭
function gracefulShutdown(signal: string): void {
  logger.info(`${signal} received, shutting down gracefully...`);

  // 停止重试队列
  syncRetryQueue.stopRetryTimer();

  // 退出进程
  setTimeout(() => {
    process.exit(0);
  }, 1000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// 启动
startServer();
