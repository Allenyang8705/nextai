import mysql from 'mysql2/promise';
import { config } from './env.js';

// 创建连接池
export const pool = mysql.createPool({
  host: config.database.host,
  port: config.database.port,
  user: config.database.user,
  password: config.database.password,
  database: config.database.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
});

// 测试数据库连接
export async function testConnection(): Promise<boolean> {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    console.log('Database connection successful');
    return true;
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// 执行查询的辅助函数
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  // pool.query 对于 LIMIT/OFFSET 等参数更兼容
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

// 执行单条查询
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// 获取插入ID
export async function insert(sql: string, params?: any[]): Promise<number> {
  const [result] = await pool.query(sql, params);
  return (result as any).insertId;
}
