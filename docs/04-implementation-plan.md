# 实施计划

## 阶段划分

### Phase 1: 项目骨架 + 用户认证 ✅ 进行中
**目标：** 前后端项目跑起来，能注册、登录、记住密码

| 任务 | 文件 | 状态 |
|------|------|------|
| 1.1 项目目录结构 | 全局 | ✅ |
| 1.2 后端配置文件 | server/package.json, tsconfig.json | ✅ |
| 1.3 数据库初始化 | server/src/db.ts | ✅ |
| 1.4 JWT 中间件 | server/src/middleware/auth.ts | ✅ |
| 1.5 认证路由 | server/src/routes/auth.ts | ✅ |
| 1.6 WebSocket 服务 | server/src/ws.ts | 🔲 |
| 1.7 后端入口 | server/src/index.ts | 🔲 |
| 1.8 前端配置文件 | client/package.json, vite.config.ts 等 | ✅ |
| 1.9 全局样式 | client/src/index.css | 🔲 |
| 1.10 认证状态管理 | client/src/store/authStore.ts | 🔲 |
| 1.11 API 服务层 | client/src/services/api.ts | 🔲 |
| 1.12 登录/注册页面 | client/src/pages/Login.tsx | 🔲 |
| 1.13 App + 路由 | client/src/App.tsx, main.tsx | 🔲 |
| 1.14 安装依赖 + 验证 | 全局 | 🔲 |

### Phase 2: 传输界面 + 实时消息
**目标：** 聊天界面，能发文字，实时同步

### Phase 3: 文件传输
**目标：** 上传/下载文件，P2P 大文件

### Phase 4: 端到端加密
**目标：** ECDH 密钥交换 + AES-256-GCM 加解密

### Phase 5: 传输记录 + 设备管理
**目标：** 历史记录、设备列表、设置页

### Phase 6: 部署
**目标：** Vercel + Render 上线

## 开发原则
1. **一个文件写完验证通过再写下一个** — 不堆砌未测试的代码
2. **每完成一个 Phase 做一次端到端验证** — 确保前后端能对接
3. **先跑通核心流程，再完善细节** — 避免过早优化
4. **代码即文档** — 变量和函数命名清晰，减少注释依赖
