# 语音记录小程序 - 配置说明

## 项目结构

```
miniprogram/
├── pages/
│   ├── index/              # 首页（录音列表）
│   ├── login/              # 登录/注册页
│   ├── settings/           # 设置页
│   └── settings-feishu/    # 飞书设置页
├── utils/
│   ├── request.ts          # 网络请求封装
│   └── util.ts             # 工具函数
├── app.ts                  # 小程序入口
├── app.json                # 小程序配置
├── app.wxss                # 全局样式
└── project.config.json     # 项目配置
```

## 配置步骤

### 1. 打开项目

使用微信开发者工具打开 `miniprogram` 目录。

### 2. 配置 AppID

在 `project.config.json` 中，将 `appid` 修改为你自己的小程序 AppID：

```json
{
  "appid": "你的AppID"
}
```

### 3. 配置后端 API 地址

在 `app.ts` 中，修改 `apiBase` 为实际的后端地址：

```typescript
globalData: {
  apiBase: 'http://localhost:3000/api', // 开发环境
  // apiBase: 'https://your-domain.com/api', // 生产环境
}
```

### 4. 配置服务器域名

在微信公众平台（小程序后台）配置服务器域名：

**开发环境**：微信开发者工具中勾选「不校验合法域名」选项。

**生产环境**：需要在 `开发 > 开发管理 > 开发设置 > 服务器域名` 中添加：
- request 合法域名：`https://your-domain.com`
- uploadFile 合法域名：`https://your-domain.com`

### 5. 本地开发调试

1. 启动后端服务：`cd backend && npm run dev`
2. 确保后端运行在 `http://localhost:3000`
3. 微信开发者工具中：
   - 点击右上角「详情」
   - 勾选「不校验合法域名、web-view（业务域名）、TLS 版本以及 HTTPS 证书」

## 页面功能

### 首页 (index)
- 长按录音按钮进行录音（1-60秒）
- 上滑取消录音
- 显示语音记录列表
- 点击播放录音
- 下拉刷新列表
- 操作菜单：重新转写、同步飞书、删除

### 登录页 (login)
- 手机号/邮箱登录
- 新用户注册
- 记住密码功能

### 设置页 (settings)
- 账号管理（修改密码、退出登录）
- 飞书配置入口
- 语音质量设置
- 播放模式设置
- 缓存管理

### 飞书设置页 (settings-feishu)
- 配置飞书文档 ID
- 配置飞书应用 App ID 和 App Secret
- 测试连接
- 同步开关

## API 交互

### 认证相关
- `POST /api/auth/register` - 注册
- `POST /api/auth/login` - 登录
- `GET /api/auth/me` - 获取用户信息
- `POST /api/auth/change-password` - 修改密码

### 语音相关
- `POST /api/audio/upload` - 上传语音
- `GET /api/audio/list` - 获取语音列表
- `GET /api/audio/:id` - 获取语音详情
- `DELETE /api/audio/:id` - 删除语音
- `POST /api/audio/:id/retry-transcription` - 重新转写

### 飞书相关
- `GET /api/feishu/config` - 获取飞书配置
- `POST /api/feishu/config` - 保存飞书配置
- `POST /api/feishu/test` - 测试连接
- `POST /api/feishu/sync/:id` - 同步单条记录

## 常见问题

### Q: 无法连接后端服务？
A: 检查后端服务是否启动，确认 `app.ts` 中的 `apiBase` 地址正确。

### Q: 上传语音失败？
A: 检查后端上传目录权限，确认文件大小未超过限制（默认 10MB）。

### Q: 录音权限被拒绝？
A: 在手机设置中开启小程序的麦克风权限。

### Q: 转写一直 pending？
A: 需要配置阿里云 ASR 凭证，或在后端代码中使用 mock 模式。
