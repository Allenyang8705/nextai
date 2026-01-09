import mysql from 'mysql2/promise';

async function addAvatarColumn() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'voice_daily',
  });

  try {
    console.log('连接数据库成功');

    // 检查列是否已存在
    const [columns] = await connection.query(
      `SHOW COLUMNS FROM users LIKE 'avatar_url'`
    );

    if (columns.length > 0) {
      console.log('avatar_url 列已存在，跳过添加');
    } else {
      // 添加列
      await connection.query(
        `ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) COMMENT '头像URL' AFTER email`
      );
      console.log('成功添加 avatar_url 列');
    }

    // 验证列是否添加成功
    const [verifyColumns] = await connection.query(
      `SHOW COLUMNS FROM users LIKE 'avatar_url'`
    );

    console.log('验证结果:', verifyColumns.length > 0 ? 'avatar_url 列存在' : 'avatar_url 列不存在');

  } catch (error) {
    console.error('错误:', error.message);
  } finally {
    await connection.end();
  }
}

addAvatarColumn();
