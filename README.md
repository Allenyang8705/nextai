# 语音记录应用

一款以语音录制和自动转文字为核心的移动端应用，支持飞书文档实时同步。

## 项目概述

- **产品定位**: 语音录制 + 自动转文字 + 飞书同步
- **技术方案**: 微信小程序 + Node.js 后端
- **文档版本**: v1.0

## 功能特性

### 核心功能
- **语音录制**: 长按录音，1-60秒，支持自动上传
- **语音转文字**: 集成阿里云 ASR，自动识别语音内容
- **语音播放**: 点击播放，显示动态波形效果
- **飞书同步**: 转写完成后自动同步到飞书文档
- **云端存储**: 语音文件永久保存在云端

### 管理功能
- **账号系统**: 注册、登录、修改密码
- **设置管理**: 语音质量、播放模式、缓存管理
- **同步配置**: 飞书应用配置、同步开关

## 项目结构

```
voice_daily/
├── backend/                      # 后端服务
│   ├── src/
│   │   ├── config/               # 配置文件
│   │   │   ├── database.ts       # 数据库连接
│   │   │   └── env.ts            # 环境变量
│   │   ├── controllers/          # 控制器
│   │   │   ├── auth.ts           # 认证控制器
│   │   │   ├── audio.ts          # 语音控制器
│   │   │   └── feishu.ts         # 飞书控制器
│   │   ├── services/             # 业务逻辑
│   │   │   ├── aliyun.ts         # 阿里云服务（OSS/ASR）
│   │   │   ├── feishu.ts         # 飞书服务
│   │   │   └── syncQueue.ts      # 同步重试队列
│   │   ├── routes/               # 路由
│   │   ├── middleware/           # 中间件（认证、错误处理）
│   │   ├── utils/                # 工具函数
│   │   └── index.ts              # 入口文件
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
│
├── miniprogram/                  # 微信小程序
│   ├── pages/
│   │   ├── index/                # 首页（录音列表）
│   │   ├── login/                # 登录/注册
│   │   ├── settings/             # 设置页面
│   │   └── settings-feishu/      # 飞书设置
│   ├── utils/                    # 工具函数
│   ├── app.ts                    # 小程序入口
│   └── project.config.json
│
├── README.md
└── voice_record_prd.md           # 产品需求文档
```

## 技术栈

### 后端
- **运行环境**: Node.js 18+
- **框架**: Express + TypeScript
- **数据库**: MySQL 8.0
- **认证**: JWT
- **日志**: Winston
- **文件存储**: 阿里云 OSS
- **语音识别**: 阿里云 ASR
- **文档同步**: 飞书 Open API

### 前端
- **平台**: 微信小程序
- **语言**: TypeScript
- **组件**: 原生小程序组件

## 快速开始

### 1. 环境准备

确保已安装以下软件：
- Node.js 18+
- MySQL 8.0+
- 微信开发者工具

### 2. 数据库初始化

```bash
cd backend
npm install
npm run db:migrate
```

### 3. 配置环境变量

```bash
cd backend
cp .env.example .env
```

编辑 `.env` 文件：

```env
# 服务器配置
PORT=3000
NODE_ENV=development

# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_NAME=voice_daily
DB_USER=root
DB_PASSWORD=your_password

# JWT 配置
JWT_SECRET=your_jwt_secret_here
JWT_EXPIRES_IN=7d

# 阿里云配置（可选）
ALIYUN_ACCESS_KEY_ID=
ALIYUN_ACCESS_KEY_SECRET=
ALIYUN_OSS_BUCKET=voice-daily
ALIYUN_OSS_REGION=oss-cn-hangzhou

# 小程序配置
MINIPROGRAM_APP_ID=
MINIPROGRAM_APP_SECRET=
```

### 4. 启动后端服务

```bash
cd backend
npm install
npm run dev
```

服务将在 `http://localhost:3000` 启动。

### 5. 配置小程序

1. 使用微信开发者工具打开 `miniprogram` 目录
2. 在 `miniprogram/app.ts` 中修改 `apiBase` 为实际后端地址
3. 在 `miniprogram/project.config.json` 中填入你的小程序 AppID

### 6. 运行小程序

使用微信开发者工具预览和调试小程序。

## API 接口

### 认证
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/auth/register | 用户注册 |
| POST | /api/auth/login | 用户登录 |
| POST | /api/auth/change-password | 修改密码 |
| GET | /api/auth/me | 获取当前用户信息 |

### 语音
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/audio/upload | 上传语音 |
| GET | /api/audio/list | 获取语音列表 |
| GET | /api/audio/:id | 获取单条语音 |
| DELETE | /api/audio/:id | 删除语音 |
| POST | /api/audio/:id/retry-transcription | 重新转写 |

### 飞书同步
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/feishu/config | 保存飞书配置 |
| GET | /api/feishu/config | 获取飞书配置 |
| POST | /api/feishu/test | 测试连接 |
| POST | /api/feishu/sync/:id | 同步单条记录 |

## 数据库表结构

### users
用户表，存储账号信息

| 字段 | 类型 | 描述 |
|------|------|------|
| id | INT | 主键 |
| phone | VARCHAR(20) | 手机号 |
| email | VARCHAR(100) | 邮箱 |
| password_hash | VARCHAR(255) | 密码哈希 |
| created_at | TIMESTAMP | 创建时间 |

### records
语音记录表

| 字段 | 类型 | 描述 |
|------|------|------|
| id | INT | 主键 |
| user_id | INT | 用户ID |
| audio_url | VARCHAR(500) | 音频文件URL |
| duration | INT | 时长（秒） |
| transcription | TEXT | 转写文字 |
| file_size | INT | 文件大小 |
| asr_status | ENUM | ASR状态 |
| created_at | TIMESTAMP | 创建时间 |

### feishu_config
飞书配置表

| 字段 | 类型 | 描述 |
|------|------|------|
| user_id | INT | 用户ID（主键） |
| document_id | VARCHAR(100) | 文档ID |
| app_id | VARCHAR(100) | 应用ID |
| app_secret | VARCHAR(255) | 应用密钥 |
| is_enabled | BOOLEAN | 是否启用 |
| last_sync_at | TIMESTAMP | 最后同步时间 |

### feishu_sync_log
飞书同步日志表

| 字段 | 类型 | 描述 |
|------|------|------|
| id | INT | 主键 |
| record_id | INT | 记录ID |
| sync_status | ENUM | 同步状态 |
| retry_count | INT | 重试次数 |
| error_message | TEXT | 错误信息 |
| synced_at | TIMESTAMP | 同步时间 |

## 第三方服务配置

### 阿里云 OSS（可选）

用于存储语音文件：

1. 登录阿里云控制台
2. 开通对象存储 OSS
3. 创建 Bucket
4. 获取 AccessKey ID 和 Secret

### 阿里云 ASR（可选）

用于语音转文字：

1. 登录阿里云控制台
2. 开通智能语音服务
3. 获取 App Key

### 飞书开放平台（可选）

用于文档同步：

1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 创建企业自建应用
3. 获取 App ID 和 App Secret
4. 添加文档编辑权限 (`docx:document`)

## 开发进度

- [x] 后端框架搭建
- [x] 数据库设计和初始化
- [x] 账号系统（注册、登录、JWT）
- [x] 语音上传和存储
- [x] 阿里云 ASR 集成
- [x] 飞书文档同步
- [x] 同步重试队列
- [x] 小程序登录页面
- [x] 小程序首页（录音和列表）
- [x] 小程序设置页面
- [x] 飞书设置子页面


## 许可证

MIT
