import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';

// 读取 SQL 文件
const sqlPath = path.join(process.cwd(), 'init_database.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

// 连接 MySQL（不指定数据库）
const connection = await mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '',
  multipleStatements: true,
});

try {
  console.log('Connected to MySQL, executing init script...');

  // 执行 SQL 脚本
  await connection.query(sql);

  console.log('Database initialized successfully!');
  console.log('- Database: voice_daily');
  console.log('- Tables: users, records, feishu_sync_log, feishu_config');
} catch (error) {
  console.error('Failed to initialize database:', error.message);
  process.exit(1);
} finally {
  await connection.end();
}
