# CLAUDE.md — VibeLink 项目 AI 助手指引

## 项目概述
VibeLink 是一个网页版跨平台文件传输助手，类似微信「文件传输助手」。用户通过浏览器即可在手机和电脑之间传输文字、图片、文件，支持端到端加密。

## 核心文档路径

| 文档 | 路径 | 说明 |
|------|------|------|
| 产品需求 | [docs/01-requirements.md](docs/01-requirements.md) | 功能需求、传输策略 |
| 技术选型 | [docs/02-tech-stack.md](docs/02-tech-stack.md) | 前端/后端/数据库/部署 |
| 设计规范 | [docs/03-design-spec.md](docs/03-design-spec.md) | 色彩、排版、布局、组件 |
| 实施计划 | [docs/04-implementation-plan.md](docs/04-implementation-plan.md) | 分阶段任务清单 |
| API 规范 | [docs/05-api-spec.md](docs/05-api-spec.md) | 接口定义、请求/响应格式 |

## 开发日志
每日开发日志存放在 [dev-logs/](dev-logs/)，按日期命名（如 `2026-08-02.md`）。
每完成一个阶段的开发后，更新对应的日志文件，记录完成事项和待办事项。

## 工作原则

1. **稳步推进** — 一个文件写完验证通过再写下一个，不堆砌代码
2. **分阶段交付** — 按 Phase 1→6 顺序推进，每阶段跑通再进入下一阶段
3. **先跑通核心流程** — 登录→发消息→收消息→看记录，然后才加密、P2P 等高级功能
4. **代码简洁** — 变量和函数命名清晰，减少不必要的注释
5. **每天更新开发日志** — 下班前写 `dev-logs/YYYY-MM-DD.md`，记录完成和待办

## 技术要点速查

### 前端 (client/)
- React 18 + TypeScript + Vite
- 路由: react-router-dom v6
- 状态: Zustand（轻量全局状态）
- HTTP: Axios
- 端口: 5173 (dev)，proxy → localhost:3001

### 后端 (server/)
- Express 4 + TypeScript + tsx
- 数据库: better-sqlite3（文件: server/data/vibelink.db）
- 认证: JWT（7天过期，记住密码30天）
- WebSocket: ws 库
- 文件上传: multer（1GB 限制）
- 端口: 3001

### 数据库表
- `users` — 用户账户
- `sessions` — 登录会话（多设备）
- `messages` — 消息记录（含文件元数据）

### 加密方案
- 密钥交换: ECDH (P-256)
- 对称加密: AES-256-GCM (Web Crypto API)
- 私钥存储: 用 PBKDF2(password) 加密后存服务器

## 常用命令

```bash
# 安装后端依赖
cd server && npm install

# 启动后端开发服务器
cd server && npm run dev

# 安装前端依赖
cd client && npm install

# 启动前端开发服务器
cd client && npm run dev
```
