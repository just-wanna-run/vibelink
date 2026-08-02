# 部署指南

## 前端：Vercel（免费）

1. 注册 [Vercel](https://vercel.com) 账号（用 GitHub 登录）
2. 在 Vercel 中导入项目仓库
3. 配置：
   - **Root Directory**: `client`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. 部署后获得域名如 `vibelink.vercel.app`

## 后端：Render（免费）

1. 注册 [Render](https://render.com) 账号
2. 创建 **Web Service**，连接仓库
3. 配置：
   - **Root Directory**: `server`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `JWT_SECRET`: 随机字符串（如 `openssl rand -hex 32` 生成）
     - `PORT`: `3001`
4. 部署后获得域名如 `vibelink-server.onrender.com`

## 前后端对接

1. 在 Vercel 项目设置中，添加环境变量或直接修改 `vercel.json`
2. 将 `vercel.json` 中的 `YOUR_RENDER_APP` 替换为实际的 Render 域名
3. 后端 CORS 设置为允许 Vercel 域名

## 注意事项

- Render 免费套餐 15 分钟无访问会休眠，唤醒需 30 秒
- 文件上传存储在本地磁盘，Render 重启后会丢失
- 生产环境建议配置 Cloudflare R2 存储文件
