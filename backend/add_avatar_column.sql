-- 添加头像URL列到users表
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(500) COMMENT '头像URL' AFTER email;
