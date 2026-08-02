# 技术选型方案

## 总览

| 层面 | 选型 | 理由 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | 生态成熟，适合 SPA |
| 构建工具 | Vite 5 | 开发热更新快，构建产物小 |
| 路由 | React Router v6 | SPA 路由标准方案 |
| 状态管理 | Zustand | 比 Redux 轻量，API 简洁 |
| HTTP 客户端 | Axios | 拦截器完善，适合 JWT 续期 |
| 后端框架 | Express 4 | Node.js 最成熟的 Web 框架 |
| 数据库 | better-sqlite3 | 零配置，文件级数据库，免安装 |
| 密码加密 | bcryptjs | 纯 JS，无需编译 |
| 认证 | JWT (jsonwebtoken) | 无状态，适合分布式部署 |
| 文件上传 | multer | Express 标准中间件 |
| 实时通信 | ws (WebSocket) | 轻量 WebSocket 库 |
| 大文件传输 | WebRTC (浏览器原生) | P2P 直连，不占服务器带宽 |
| 端到端加密 | Web Crypto API (AES-256-GCM) | 浏览器原生，性能好 |
| 运行环境 | tsx (TypeScript 执行器) | 开发阶段直接跑 TS |

## 部署

| 组件 | 平台 | 说明 |
|------|------|------|
| 前端 | Vercel | 免费，自动 HTTPS，全球 CDN |
| 后端 | Render | 免费 Web Service |
| 大文件存储 | Cloudflare R2 | 10GB 免费，零出口流量费 |

## 浏览器兼容
- Chrome 90+
- Safari 15+ (iOS 15+)
- Edge 90+
- Firefox 90+
