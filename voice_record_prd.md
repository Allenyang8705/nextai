# 语音记录应用 - 产品需求文档（PRD）

## 一、项目概述

**项目名称：** 语音记录应用

**产品定位：** 一款以语音录制和自动转文字为核心的移动端应用，支持飞书文档实时同步

**技术方案：** 微信小程序（推荐）或 H5/uniapp 跨平台

**文档版本：** v1.0

**创建日期：** 2026-01-08

---

## 二、核心功能模块

### 2.1 账号管理系统

#### 2.1.1 用户注册

**功能描述：** 新用户创建账号

**页面元素：**
- 手机号/邮箱输入框
- 验证码输入框
- 密码设置框
- 确认密码框
- 用户协议和隐私政策勾选
- 注册按钮

**业务规则：**
- 密码强度要求：至少8位，包含字母和数字
- 验证码有效期：5分钟
- 同一手机号/邮箱不可重复注册
- 需阅读并同意用户协议

**异常处理：**
- 手机号/邮箱已存在提示
- 验证码错误或过期提示
- 两次密码不一致提示

---

#### 2.1.2 用户登录

**功能描述：** 已注册用户通过账号密码登录

**页面元素：**
- 账号输入框（手机号/邮箱）
- 密码输入框
- 记住密码选项
- 登录按钮
- "忘记密码"链接
- "立即注册"链接

**业务规则：**
- 连续登录失败5次，账号锁定30分钟
- 支持记住登录状态（7天免登录）

---

#### 2.1.3 忘记密码

**功能描述：** 用户通过验证找回密码

**流程：**
1. 输入注册时的手机号/邮箱
2. 获取并输入验证码
3. 设置新密码
4. 确认新密码
5. 提交修改

**业务规则：**
- 验证码发送间隔：60秒
- 同一账号24小时内最多重置密码3次

---

#### 2.1.4 修改密码

**功能描述：** 登录后用户主动修改密码

**页面元素：**
- 原密码输入框
- 新密码输入框
- 确认新密码输入框
- 确认修改按钮

**业务规则：**
- 必须验证原密码正确
- 新密码不能与原密码相同
- 修改成功后需重新登录

---

### 2.2 首页语音功能

#### 2.2.1 页面布局

```
┌─────────────────────────────────┐
│      语音记录      [设置]        │
├─────────────────────────────────┤
│                                 │
│   [语音消息 1]  15秒  14:30      │
│   今天需要完成产品需求文档...     │
│                                 │
│   [语音消息 2]  8秒   15:01      │
│   记得下午三点开会讨论...         │
│                                 │
│   [语音消息 3]  32秒  16:45      │
│   关于本地备份的问题...           │
│                                 │
│            ↓ 下拉加载更多         │
│                                 │
├─────────────────────────────────┤
│        [  按住说话  ]            │
└─────────────────────────────────┘
```

---

#### 2.2.2 语音录制

**交互方式：**
- **按钮状态：** 默认显示"按住说话"
- **录制操作：** 长按按钮开始录音，松手结束录音
- **录制中状态：** 按钮文字变更为"松开发送"，背景色变化，显示录音时长
- **取消录制：** 手指滑出按钮区域后松手，取消本次录音

**业务规则：**
- 最短录音时长：1秒（少于1秒提示"说话时间太短"）
- 最长录音时长：60秒（达到60秒自动发送）
- 录音格式：MP3格式
- 录音采样率：16kHz（语音清晰度足够）

**权限处理：**
- 首次使用需申请麦克风权限
- 权限被拒绝时，引导用户前往设置开启

---

#### 2.2.3 语音消息展示

**消息卡片包含：**
- 语音播放按钮（点击播放/暂停）
- 语音时长（如"15秒"）
- 转写文字内容（自动识别生成）
- 发送时间（如"14:30"）

**播放交互：**
- **触发方式：** 点击语音消息卡片任意位置
- **播放状态：** 显示动态波形图标，标识当前正在播放
- **播放控制：** 
  - 播放中再次点击可暂停
  - 播放完毕自动停止，图标恢复
- **听筒/扬声器切换：** 
  - 手机贴近耳朵时使用听筒播放（私密）
  - 手机远离时使用扬声器播放（公开）

**业务规则：**
- 同一时间只能播放一条语音
- 播放新语音时，自动停止当前播放

---

### 2.3 语音转文字（ASR）

#### 2.3.1 处理流程

```
录音完成 
  ↓
上传到云端
  ↓
调用阿里云ASR API
  ↓
返回识别结果（3-5秒）
  ↓
保存到数据库
  ↓
更新界面显示 + 同步飞书
```

---

#### 2.3.2 用户界面

**识别中状态：**
```
┌─────────────────────────────────┐
│ [🎤] 15秒   14:30                │
│ 🔄 正在识别中...                 │
└─────────────────────────────────┘
```

**识别完成：**
```
┌─────────────────────────────────┐
│ [🎵] 15秒   14:30       [播放]   │
│ 今天需要完成产品需求文档的编写，  │
│ 重点关注语音功能模块的设计...     │
└─────────────────────────────────┘
```

---

#### 2.3.3 技术集成

**服务商：** 阿里云智能语音

**识别准确率：** > 95%

**功能配置：**
- 自动添加标点符号
- 数字智能转换（"三百"→ "300"）
- 支持普通话和常见方言

---

### 2.4 存储架构

#### 2.4.1 存储方案

```
┌─────────────────────────────────┐
│         语音录制                 │
└────────────┬────────────────────┘
             ↓
┌─────────────────────────────────┐
│    云端服务器（主存储）           │
│  - 原始语音文件（永久保存）       │
│  - ASR转写文字                   │
│  - 元数据（时间、时长等）         │
└─────┬──────────────┬─────────────┘
      ↓              ↓
┌──────────┐   ┌─────────────────┐
│小程序缓存 │   │   飞书文档       │
│(最近50条)│   │  (实时同步)      │
└──────────┘   └─────────────────┘
```

---

#### 2.4.2 小程序本地缓存

**用途：** 仅用于临时缓存，提升使用体验

**缓存策略：**
- 自动缓存最近50条语音（约8MB）
- 超过7天自动清理
- 用户可手动清理缓存

**实现逻辑：**
```javascript
// 缓存管理
const cacheManager = {
  maxSize: 8 * 1024 * 1024,  // 8MB
  maxCount: 50,
  maxAge: 7 * 24 * 60 * 60 * 1000,  // 7天
  
  // 自动清理过期缓存
  autoClear() {
    const now = Date.now();
    const cacheList = this.getCacheList();
    
    cacheList.forEach(item => {
      if (now - item.timestamp > this.maxAge) {
        this.removeCache(item.id);
      }
    });
  }
};
```

---

### 2.5 飞书文档同步

#### 2.5.1 配置页面

```
┌─────────────────────────────────┐
│  飞书文档同步设置                │
├─────────────────────────────────┤
│                                 │
│ 同步开关                         │
│ ● 开启自动同步                   │
│ ○ 关闭同步                       │
│                                 │
│ 飞书文档链接                     │
│ ┌─────────────────────────────┐ │
│ │ https://example.feishu.cn/  │ │
│ │ docx/doxcnxxxxxxxxxxxxx     │ │
│ └─────────────────────────────┘ │
│ [如何获取文档链接？]             │
│                                 │
│ 飞书应用凭证                     │
│ ┌─────────────────────────────┐ │
│ │ App ID: cli_xxxxx          │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ App Secret: ************   │ │
│ └─────────────────────────────┘ │
│ [如何获取应用凭证？]             │
│                                 │
│ 同步状态                         │
│ ✅ 已连接  最后同步：2分钟前      │
│                                 │
│ 同步内容选项                     │
│ ☑ 录音时间                       │
│ ☑ 语音时长                       │
│ ☑ 转写文字内容                   │
│ ☑ 语音文件链接                   │
│                                 │
│     [测试连接]     [保存设置]    │
└─────────────────────────────────┘
```

---

#### 2.5.2 同步内容格式（段落形式）

飞书文档中的展示格式：

```markdown
# 语音记录

## 2026年1月

### 2026-01-08

**14:30** ⏱️ 15秒
今天需要完成产品需求文档的编写，重点关注语音功能模块的设计，包括录制、播放、存储和飞书同步功能。需要明确技术选型，确定是使用小程序还是H5方案。
[🎵 播放原始语音](https://your-domain.com/audio/20260108143025.mp3)

---

**15:01** ⏱️ 8秒
记得下午三点开会讨论技术方案，确认开发排期和资源分配。
[🎵 播放原始语音](https://your-domain.com/audio/20260108150112.mp3)

---

**16:45** ⏱️ 32秒
关于存储方案的问题，决定简化本地备份功能，只保留云端同步。小程序本地仅缓存最近50条记录供离线播放，所有数据永久保存在云端服务器，并实时同步到飞书文档。
[🎵 播放原始语音](https://your-domain.com/audio/20260108164523.mp3)

---
```

---

#### 2.5.3 同步机制

**触发时机：**
- 语音录制并识别完成后，立即同步到飞书

**同步流程：**
```javascript
async function syncToFeishu(record) {
  try {
    // 1. 格式化内容
    const content = formatContent(record);
    
    // 2. 获取飞书Access Token
    const token = await getFeishuToken();
    
    // 3. 调用飞书API追加内容
    const result = await appendToFeishuDoc({
      documentId: config.feishu.documentId,
      token: token,
      content: content
    });
    
    if (result.success) {
      // 4. 更新本地同步状态
      await updateSyncStatus(record.id, 'synced');
      console.log('同步成功');
    } else {
      throw new Error(result.message);
    }
    
  } catch (error) {
    console.error('同步失败', error);
    // 5. 加入重试队列
    await addToRetryQueue(record);
  }
}
```

---

**重试机制：**
```javascript
// 同步失败重试队列
class SyncRetryQueue {
  constructor() {
    this.queue = [];
    this.maxRetry = 3;
    this.retryInterval = 5 * 60 * 1000;  // 5分钟
    
    // 启动定时检查
    this.startRetryTimer();
  }
  
  // 添加到重试队列
  add(record) {
    this.queue.push({
      record: record,
      retryCount: 0,
      lastRetry: Date.now()
    });
  }
  
  // 定时重试
  async startRetryTimer() {
    setInterval(async () => {
      for (let item of this.queue) {
        if (item.retryCount >= this.maxRetry) {
          // 超过最大重试次数，通知用户
          this.notifyUser(item.record);
          continue;
        }
        
        // 尝试重新同步
        const result = await syncToFeishu(item.record);
        
        if (result.success) {
          // 同步成功，从队列移除
          this.remove(item);
        } else {
          // 同步失败，增加重试次数
          item.retryCount++;
          item.lastRetry = Date.now();
        }
      }
    }, this.retryInterval);
  }
}
```

---

#### 2.5.4 飞书API实现

```javascript
class FeishuAPI {
  constructor(config) {
    this.appId = config.appId;
    this.appSecret = config.appSecret;
    this.documentId = config.documentId;
  }
  
  /**
   * 获取 tenant_access_token
   */
  async getTenantAccessToken() {
    const response = await fetch(
      'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          app_id: this.appId,
          app_secret: this.appSecret
        })
      }
    );
    
    const data = await response.json();
    
    if (data.code === 0) {
      return data.tenant_access_token;
    } else {
      throw new Error(data.msg);
    }
  }
  
  /**
   * 追加内容到飞书文档
   */
  async appendContent(content) {
    const token = await this.getTenantAccessToken();
    
    // 1. 获取文档最后一个块的ID
    const blockId = await this.getLastBlockId(token);
    
    // 2. 追加内容
    const response = await fetch(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${this.documentId}/blocks/${blockId}/children`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          children: [
            {
              block_type: 'text',
              text: {
                elements: [
                  {
                    text_run: {
                      content: content
                    }
                  }
                ]
              }
            }
          ],
          index: -1  // 追加到末尾
        })
      }
    );
    
    const result = await response.json();
    
    return {
      success: result.code === 0,
      message: result.msg
    };
  }
  
  /**
   * 获取文档最后一个块ID
   */
  async getLastBlockId(token) {
    const response = await fetch(
      `https://open.feishu.cn/open-apis/docx/v1/documents/${this.documentId}/blocks`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      }
    );
    
    const data = await response.json();
    
    if (data.code === 0 && data.data.items.length > 0) {
      // 返回最后一个块的ID
      return data.data.items[data.data.items.length - 1].block_id;
    } else {
      throw new Error('无法获取文档结构');
    }
  }
}
```

---

#### 2.5.5 用户帮助文档

**如何获取飞书文档链接？**
1. 打开飞书云文档
2. 创建一个新文档（或使用现有文档）
3. 点击右上角"分享"按钮
4. 选择"复制链接"
5. 将链接粘贴到应用设置中

**如何获取飞书应用凭证？**
1. 访问 [飞书开放平台](https://open.feishu.cn/)
2. 登录并进入"开发者后台"
3. 点击"创建企业自建应用"
4. 填写应用信息并创建
5. 在应用详情页获取 App ID 和 App Secret
6. 在"权限管理"中添加以下权限：
   - `docx:document` - 查看、评论、编辑和管理云文档
7. 创建可用版本并发布
8. 将 App ID 和 App Secret 填入应用设置

---

## 三、设置页面

```
┌─────────────────────────────────┐
│          设置                    │
├─────────────────────────────────┤
│                                 │
│ 👤 账号管理                      │
│   > 修改密码                     │
│   > 退出登录                     │
│                                 │
│ 📄 飞书文档同步                  │
│   > 同步设置                     │
│   状态：✅ 已连接                │
│   最后同步：2分钟前              │
│                                 │
│ 🎵 语音设置                      │
│   > 语音质量                     │
│     ● 标准（16kHz，节省流量）    │
│     ○ 高清（48kHz）              │
│   > 播放模式                     │
│     ● 自动（距离感应）           │
│     ○ 始终扬声器                │
│     ○ 始终听筒                   │
│                                 │
│ 💾 存储管理                      │
│   > 清理缓存（当前：8.2MB）      │
│   > 查看云端存储                 │
│     已使用：1.2GB / ∞            │
│                                 │
│ ℹ️ 关于                          │
│   > 使用帮助                     │
│   > 隐私政策                     │
│   > 用户协议                     │
│   > 版本信息  v1.0.0            │
│   > 反馈建议                     │
│                                 │
└─────────────────────────────────┘
```

---

## 四、技术架构

### 4.1 整体架构图

```
┌─────────────────────────────────────────┐
│          前端（微信小程序）              │
├─────────────────────────────────────────┤
│  - 语音录制（wx.getRecorderManager）    │
│  - 语音播放（wx.createInnerAudioContext）│
│  - 本地缓存（wx.setStorage，8MB限制）   │
│  - 用户界面（WXML + WXSS）              │
└──────────────────┬──────────────────────┘
                   ↓ HTTPS
┌─────────────────────────────────────────┐
│        后端服务（Node.js + Express）     │
├─────────────────────────────────────────┤
│  API接口：                               │
│  - POST /api/auth/register  注册        │
│  - POST /api/auth/login     登录        │
│  - POST /api/audio/upload   上传语音    │
│  - GET  /api/audio/list     获取列表    │
│  - POST /api/feishu/sync    飞书同步    │
│                                         │
│  业务逻辑：                              │
│  - 用户认证（JWT）                       │
│  - 文件上传处理                          │
│  - ASR调用管理                          │
│  - 飞书API调用                          │
└──────┬─────────────┬─────────────┬──────┘
       ↓             ↓             ↓
┌──────────┐  ┌─────────────┐  ┌──────────┐
│ 数据库   │  │ 文件存储    │  │ 第三方API│
│ MySQL    │  │ 阿里云OSS   │  │          │
├──────────┤  ├─────────────┤  ├──────────┤
│- users   │  │- 语音文件   │  │- 阿里云  │
│- records │  │- 永久保存   │  │  ASR     │
│- sync_log│  │             │  │- 飞书    │
└──────────┘  └─────────────┘  │  Open API│
                               └──────────┘
```

---

### 4.2 数据库设计

#### users 表
```sql
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) UNIQUE,
  email VARCHAR(100) UNIQUE,
  password_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

#### records 表
```sql
CREATE TABLE records (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT,
  audio_url VARCHAR(500),
  duration INT,  -- 时长（秒）
  transcription TEXT,  -- 转写文字
  file_size INT,  -- 文件大小（字节）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### feishu_sync_log 表
```sql
CREATE TABLE feishu_sync_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  record_id INT,
  sync_status ENUM('pending', 'success', 'failed'),
  retry_count INT DEFAULT 0,
  error_message TEXT,
  synced_at TIMESTAMP,
  FOREIGN KEY (record_id) REFERENCES records(id)
);
```

#### feishu_config 表
```sql
CREATE TABLE feishu_config (
  user_id INT PRIMARY KEY,
  document_id VARCHAR(100),
  app_id VARCHAR(100),
  app_secret VARCHAR(255),
  is_enabled BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

## 五、开发排期

| 阶段 | 时间 | 主要任务 | 交付物 |
|-----|------|---------|--------|
| **第一阶段** | 2周 | 账号系统 + 基础框架 | 注册登录功能、数据库设计 |
| **第二阶段** | 3周 | 语音录制播放 + ASR集成 | 完整语音功能、转写功能 |
| **第三阶段** | 2周 | 飞书文档同步 | 飞书API集成、自动同步 |
| **第四阶段** | 1周 | 测试优化 | Bug修复、性能优化 |
| **第五阶段** | 1周 | 上线准备 | 小程序审核、用户文档 |

**总计：9周（约2个月）**

---

## 六、成本估算

### 6.1 开发成本
- **前端开发：** 1人 × 5周 = 5人周
- **后端开发：** 1人 × 4周 = 4人周
- **测试：** 1人 × 1周 = 1人周
- **总计：** 10人周

---

### 6.2 运营成本（月度，1000活跃用户）

| 项目 | 规格 | 费用 |
|-----|------|------|
| 阿里云ASR | 1000用户 × 10次/天 × 30秒 | ≈ 150元 |
| 阿里云OSS存储 | 50GB | ≈ 7元 |
| 阿里云OSS流量 | 100GB下载 | ≈ 50元 |
| 云服务器ECS | 2核4G | ≈ 100元 |
| 数据库RDS | 1核2G | ≈ 80元 |
| **月度总计** | | **≈ 387元** |

**说明：**
- 飞书API免费使用
- 用户量增长需相应扩容
- ASR按实际使用量计费

---

## 七、功能清单

| 功能模块 | 详细功能 | 优先级 |
|---------|---------|--------|
| **账号系统** | 注册、登录、忘记密码、修改密码 | P0 |
| **语音录制** | 长按录制，1-60秒，自动上传 | P0 |
| **语音播放** | 点击播放，显示转写文字，时长显示 | P0 |
| **语音转文字** | 阿里云ASR，自动识别，准确率>95% | P0 |
| **云端存储** | 永久保存语音和文字 | P0 |
| **飞书同步** | 实时同步完整文字到飞书文档（段落格式） | P0 |
| **小程序缓存** | 缓存最近50条供离线播放 | P1 |
| **设置管理** | 语音质量、播放模式、缓存管理 | P1 |

---

## 八、核心流程图

### 8.1 完整业务流程

```
用户打开应用
    ↓
登录/注册
    ↓
进入首页
    ↓
长按"按住说话"
    ↓
录制语音（1-60秒）
    ↓
松手发送
    ↓
上传到云端服务器
    ↓
调用阿里云ASR（异步）
    ↓
保存语音文件到OSS
    ↓
保存记录到数据库
    ↓
返回识别结果
    ↓
├─→ 更新小程序界面显示
└─→ 自动同步到飞书文档
    ↓
完成
```

---

## 九、非功能性需求

### 9.1 性能要求
- 页面加载时间 < 2秒
- 语音上传成功率 > 99%
- 语音播放延迟 < 500ms
- 支持弱网环境下的断点续传
- ASR识别响应时间 < 5秒

### 9.2 安全要求
- 密码采用加密传输（HTTPS）
- 敏感信息不明文存储
- 定期清理本地缓存的语音文件
- 防止恶意注册（图形验证码/行为验证）
- 飞书应用凭证加密存储

### 9.3 兼容性要求
- iOS 11及以上系统
- Android 6.0及以上系统
- 主流浏览器（如使用H5方案）
- 微信版本 7.0 及以上（小程序方案）

### 9.4 可用性要求
- 系统可用性 > 99.9%
- 数据备份策略（每日备份）
- 灾难恢复方案

---

## 十、异常处理

### 10.1 常见异常场景

| 异常场景 | 处理方案 |
|---------|---------|
| 网络断开 | 提示用户检查网络，语音保存到本地队列，网络恢复后自动上传 |
| ASR识别失败 | 重试3次，失败后提示用户"识别失败"，保留原始语音 |
| 飞书同步失败 | 加入重试队列，最多重试3次，失败后通知用户 |
| 存储空间不足 | 提示用户清理缓存或升级存储空间 |
| 麦克风权限被拒绝 | 引导用户前往系统设置开启权限 |
| Token过期 | 自动刷新Token，失败后提示用户重新登录 |

---

## 十一、版本规划

### v1.0（MVP版本）
- ✅ 基础账号系统
- ✅ 语音录制和播放
- ✅ 语音转文字（ASR）
- ✅ 飞书文档同步
- ✅ 基础设置功能

### v1.1（计划中）
- 语音标签分类
- 语音搜索功能
- 多设备数据同步
- 分享语音到微信好友

### v2.0（规划中）
- 支持多人协作
- 语音会议记录
- AI摘要生成
- 多语言支持

---

## 十二、附录

### 12.1 技术选型理由

**为什么选择微信小程序？**
- 无需下载，用户触达成本低
- 微信生态内天然支持语音功能
- 开发周期短，迭代速度快
- 可添加到手机桌面，类似原生APP体验

**为什么选择阿里云ASR？**
- 识别准确率行业领先（>95%）
- 支持多种方言和口音
- 性价比高
- API文档完善，技术支持好

**为什么使用飞书文档？**
- 开放API完善
- 支持富文本编辑
- 多端同步能力强
- 适合个人和团队使用

---

### 12.2 相关链接

- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [阿里云智能语音](https://www.aliyun.com/product/nls)
- [飞书开放平台](https://open.feishu.cn/)
- [阿里云OSS文档](https://help.aliyun.com/product/31815.html)

---

### 12.3 联系方式

如有问题或建议，请联系：
- 产品经理：[姓名/邮箱]
- 技术负责人：[姓名/邮箱]
- 项目管理：[姓名/邮箱]

---

**文档结束**