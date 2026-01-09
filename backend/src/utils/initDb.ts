import mysql from 'mysql2/promise';
import { config } from '../config/env.js';

// SQL 建表语句
const createTablesSQL = `
-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url VARCHAR(500) COMMENT '头像URL',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 语音记录表
CREATE TABLE IF NOT EXISTS records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  audio_url VARCHAR(500) NOT NULL,
  duration INT NOT NULL COMMENT '时长（秒）',
  transcription TEXT COMMENT '转写文字',
  file_size INT NOT NULL COMMENT '文件大小（字节）',
  asr_status ENUM('pending', 'processing', 'success', 'failed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_created_at (created_at),
  INDEX idx_asr_status (asr_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 飞书同步日志表
CREATE TABLE IF NOT EXISTS feishu_sync_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  record_id INT NOT NULL,
  sync_status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  retry_count INT DEFAULT 0,
  error_message TEXT,
  synced_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE,
  INDEX idx_record_id (record_id),
  INDEX idx_sync_status (sync_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 飞书配置表
CREATE TABLE IF NOT EXISTS feishu_config (
  user_id INT PRIMARY KEY,
  document_id VARCHAR(100),
  app_id VARCHAR(100),
  app_secret VARCHAR(255),
  is_enabled BOOLEAN DEFAULT FALSE,
  last_sync_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
`;

// 初始化数据库函数
export async function initDatabase(): Promise<void> {
  // 先连接 MySQL 服务器（不指定数据库）
  const connection = await mysql.createConnection({
    host: config.database.host,
    port: config.database.port,
    user: config.database.user,
    password: config.database.password,
    multipleStatements: true,
  });

  try {
    console.log('Connected to MySQL server');

    // 创建数据库（如果不存在）
    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${config.database.database} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    console.log(`Database "${config.database.database}" created or already exists`);

    // 切换到目标数据库
    await connection.changeUser({ database: config.database.database });

    // 创建表
    await connection.query(createTablesSQL);
    console.log('Tables created successfully');

    console.log('Database initialization completed!');
  } catch (error) {
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

// 如果直接运行此文件
if (import.meta.url === `file://${process.argv[1]}`) {
  initDatabase()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
