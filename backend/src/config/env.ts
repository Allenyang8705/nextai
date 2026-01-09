import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // 服务器配置
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // 数据库配置
  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'voice_daily',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },

  // JWT 配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your_jwt_secret_here',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  // 阿里云配置（OSS）
  aliyun: {
    accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID || '',
    accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET || '',
    ossBucket: process.env.ALIYUN_OSS_BUCKET || 'voice-daily',
    ossRegion: process.env.ALIYUN_OSS_REGION || 'oss-cn-hangzhou',
    ossEndpoint: process.env.ALIYUN_OSS_ENDPOINT || '',
  },

  // 腾讯云配置（语音转文字）
  tencent: {
    secretId: process.env.TENCENT_SECRET_ID || '',
    secretKey: process.env.TENCENT_SECRET_KEY || '',
    region: process.env.TENCENT_REGION || 'ap-guangzhou',
    appId: process.env.TENCENT_APP_ID || '',
  },

  // 小程序配置
  miniprogram: {
    appId: process.env.MINIPROGRAM_APP_ID || '',
    appSecret: process.env.MINIPROGRAM_APP_SECRET || '',
  },

  // 文件上传配置
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760', 10), // 10MB
    uploadDir: process.env.UPLOAD_DIR || './uploads',
  },
};

// 验证必要的环境变量
export function validateConfig(): void {
  const required = ['JWT_SECRET'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0 && config.nodeEnv === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}
