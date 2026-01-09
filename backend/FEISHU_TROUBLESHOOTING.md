# 飞书连接故障排除指南

## 运行诊断脚本

在 backend 目录下运行以下命令来诊断飞书连接问题：

```bash
node test-feishu.js
```

## 常见问题及解决方案

### 1. App ID 或 App Secret 错误

**错误码**: `99991663`

**解决方案**:
- 登录飞书开放平台：https://open.feishu.cn
- 进入"应用管理" -> 选择你的应用
- 在"凭证与基础信息"页面查看正确的 App ID 和 App Secret
- 确保复制时没有多余的空格

### 2. 应用未发布或已禁用

**错误码**: `99991401`

**解决方案**:
- 在飞书开放平台中，检查应用状态
- 确保应用已启用并发布
- 如果是自建应用，需要在"权限管理"中开启所需的权限

### 3. 文档不存在或 Document ID 错误

**错误码**: `711104`

**解决方案**:
- 确认 Document ID 是否正确
- 从飞书文档链接中提取 Document ID：
  - 链接格式：`https://xxx.feishu.cn/docx/xxxxxxx`
  - Document ID 就是 `/docx/` 后面的部分
- 确保文档未被删除

### 4. 无权限访问该文档

**错误码**: `711098`

**解决方案**:
- 确保应用已被添加到文档的协作者中
- 或者文档所在的空间已对应用开放访问权限
- 在飞书文档中，点击"分享" -> 添加你的应用作为协作者

### 5. 应用没有访问文档的权限

**错误码**: `99991463`

**解决方案**:
- 在飞书开放平台，进入你的应用
- 找到"权限管理"或"权限配置"
- 添加并启用以下权限：
  - `docx:document` - 获取文档信息
  - `docx:document:readonly` - 读取文档内容
  - `docx:document:write` - 编辑文档内容
- 保存并重新发布应用

### 6. 网络连接问题

**错误**: `ETIMEDOUT` 或 `ECONNREFUSED`

**解决方案**:
- 检查服务器网络连接
- 确保可以访问外网
- 检查防火墙设置
- 如果使用代理，需要配置 axios 使用代理

## 飞书应用配置完整步骤

### 1. 创建飞书应用

1. 访问 https://open.feishu.cn
2. 登录并进入"开发者后台"
3. 点击"创建应用"，选择"自建应用"
4. 填写应用名称和描述

### 2. 配置应用权限

在应用的"权限管理"页面，添加以下权限：

```
docx:document           # 文档基础权限
docx:document:readonly  # 读取文档内容
docx:document:write     # 编辑文档内容（用于追加内容）
```

### 3. 获取凭证

在"凭证与基础信息"页面：
- 复制 `App ID`
- 复制 `App Secret`

### 4. 准备文档

1. 创建一个飞书文档
2. 确保文档可以被应用访问：
   - 方式1：将应用添加为文档协作者
   - 方式2：将文档放在应用有权限访问的空间中
3. 从文档链接中提取 Document ID

### 5. 在小程序中配置

1. 打开小程序的"飞书设置"页面
2. 填写：
   - 文档链接或 Document ID
   - App ID
   - App Secret
3. 点击"测试连接"
4. 测试成功后，保存配置

## 调试技巧

### 查看详细日志

如果需要更详细的日志，可以修改后端代码，在关键位置添加 console.log：

```typescript
// 在 backend/src/services/feishu.ts 中
console.log('请求配置:', { appId, documentId });
console.log('API响应:', response.data);
```

### 使用 cURL 测试 API

可以使用 cURL 直接测试飞书 API：

```bash
# 获取访问令牌
curl -X POST 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal' \
  -H 'Content-Type: application/json' \
  -d '{
    "app_id": "你的App ID",
    "app_secret": "你的App Secret"
  }'

# 获取文档信息
curl -X GET 'https://open.feishu.cn/open-apis/docx/v1/documents/{document_id}' \
  -H 'Authorization: Bearer {access_token}'
```

### 检查数据库配置

```sql
SELECT * FROM feishu_config;
```

确保配置已正确保存到数据库。

## 联系支持

如果以上方法都无法解决问题，请提供以下信息：

1. 诊断脚本的完整输出
2. 错误码和错误信息
3. 飞书应用的类型（自建应用/商店应用）
4. 文档的访问权限设置

---

**注意**: 请妥善保管 App Secret，不要将其提交到代码仓库或在不安全的地方分享。
