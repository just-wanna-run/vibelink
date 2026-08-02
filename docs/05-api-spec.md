# API 接口规范

## 基础地址
- 开发环境：`http://localhost:3001/api`
- 生产环境：`https://<render-app>.onrender.com/api`

## 认证接口

### POST /api/auth/register
注册新用户

```
Body: {
  email?: string,
  phone?: string,
  password: string,        // 至少6位
  publicKey?: string,      // ECDH 公钥 (base64)
  encryptedPrivateKey?: string,
  deviceName?: string,
  deviceType?: string      // 'mobile' | 'desktop' | 'tablet'
}
Response: {
  token: string,
  userId: string,
  email: string | null,
  phone: string | null
}
```

### POST /api/auth/login
登录

```
Body: {
  email?: string,
  phone?: string,
  password: string,
  rememberMe?: boolean,    // 默认 false
  deviceName?: string,
  deviceType?: string
}
Response: {
  token: string,
  userId: string,
  email: string | null,
  phone: string | null,
  publicKey?: string,
  encryptedPrivateKey?: string
}
```

### POST /api/auth/verify-token
自动登录——验证本地存储的 token 是否仍然有效

```
Body: { token: string }
Response: { token, userId, email, phone, publicKey, encryptedPrivateKey }
```

### POST /api/auth/logout
退出登录

```
Body: { token: string }
Response: { message: "已退出登录" }
```

## 消息接口

所有消息接口需要 Header: `Authorization: Bearer <token>`

### POST /api/messages/send
发送消息（支持文件上传，multipart/form-data）

```
FormData: {
  type: 'text' | 'image' | 'file',
  content?: string,          // 加密后的文本 (base64)
  iv?: string,               // AES-GCM IV (base64)
  encryptedKey?: string,     // 加密后的 AES 密钥
  clientMessageId: string,   // 客户端生成的唯一 ID
  file?: File                // 文件本体
}
Response: { message: {...} }
```

### GET /api/messages/history?limit=50&before=<timestamp>
获取历史消息

```
Response: { messages: Message[] }
```

### DELETE /api/messages/:id
删除单条消息

```
Response: { message: "已删除" }
```

## 文件接口

### GET /api/files/:filename
下载文件（需要 Authorization header）
返回文件流，Content-Disposition: attachment

## WebSocket

连接: `ws://localhost:3001/ws?token=<jwt_token>`

### 服务端推送事件

```json
{
  "type": "new_message",
  "message": { ... }
}
```

```json
{
  "type": "message_deleted",
  "messageId": "..."
}
```

```json
{
  "type": "device_online",
  "device": { ... }
}
```

```json
{
  "type": "device_offline",
  "deviceId": "..."
}
```
