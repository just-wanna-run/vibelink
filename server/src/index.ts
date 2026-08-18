import express from 'express';
import cors from 'cors';
import compression from 'compression';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import authRoutes from './routes/auth';
import messageRoutes from './routes/messages';
import fileRoutes from './routes/files';
import { setupWebSocket } from './ws';
import { getDb } from './db';
import { authMiddleware, AuthRequest } from './middleware/auth';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');
const isProduction = process.env.NODE_ENV === 'production';

// ---- Middleware ----
app.use(cors());
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// ---- API Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);

// ---- Feedback routes ----
app.post('/api/feedback', async (req, res) => {
  try {
    const { message, contact } = req.body;
    if (!message) return res.status(400).json({ error: '请输入反馈内容' });
    await getDb().from('feedbacks').insert({ id: uuidv4(), message, contact: contact || null });
    console.log(`[Feedback] ${contact || '匿名'}: ${message}`);
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: '提交失败' }); }
});

app.get('/api/feedback', async (_req, res) => {
  try {
    const { data: feedbacks } = await getDb().from('feedbacks').select('*').order('created_at', { ascending: false }).limit(50);
    res.json({ feedbacks: feedbacks || [] });
  } catch (err) { res.status(500).json({ error: '获取失败' }); }
});

// ---- Categories ----
app.get('/api/categories', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const result = await getDb().from('categories').select('*').eq('user_id', userId).order('created_at');
    const cats = (result?.data || result || []);
    return res.json({ categories: cats });
  } catch (err) { return res.status(500).json({ error: '获取失败' }); }
});

app.post('/api/categories', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!;
    const { name, color } = req.body;
    if (!name) return res.status(400).json({ error: '请输入分类名称' });
    await getDb().from('categories').insert({ id: uuidv4(), user_id: userId, name, color: color || '#5B9BD5' });
    return res.json({ message: '已创建' });
  } catch (err) { return res.status(500).json({ error: '创建失败' }); }
});

app.put('/api/categories/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { name, color } = req.body;
    await getDb().from('categories').update({ name, color }).eq('id', req.params.id);
    return res.json({ message: '已更新' });
  } catch (err) { return res.status(500).json({ error: '更新失败' }); }
});

app.delete('/api/categories/:id', authMiddleware, async (req: AuthRequest, res) => {
  try {
    await getDb().from('categories').delete().eq('id', req.params.id);
    return res.json({ message: '已删除' });
  } catch (err) { return res.status(500).json({ error: '删除失败' }); }
});

// ---- Admin stats ----
app.get('/api/admin/stats', async (req, res) => {
  try {
    const pwd = req.headers['x-admin-pwd'] as string;
    if (pwd !== atob('NTUxMzE0')) return res.status(403).json({ error: '无权限' });

    const db = getDb();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [usersR, msgsR, txtR, imgR, fileR, todayUserR, weekMsgR]: any = await Promise.all([
      db.from('users').select('id'),
      db.from('messages').select('id,type,created_at'),
      db.from('messages').select('id').eq('type', 'text'),
      db.from('messages').select('id').eq('type', 'image'),
      db.from('messages').select('id').eq('type', 'file'),
      db.from('messages').select('id').gt('created_at', today),
      db.from('messages').select('id').gt('created_at', weekAgo),
    ]);

    const users = usersR?.data || usersR || [];
    const allMsgs = msgsR?.data || msgsR || [];
    const texts = txtR?.data || txtR || [];
    const images = imgR?.data || imgR || [];
    const files = fileR?.data || fileR || [];
    const todayMsgs = todayUserR?.data || todayUserR || [];
    const weekMsgs = weekMsgR?.data || weekMsgR || [];

    // Count active users (users who sent messages today)
    const msgsWithUser = allMsgs.filter((m: any) => m.user_id);
    const userIds = new Set(msgsWithUser.map((m: any) => m.user_id));
    const todayUserIds = new Set(msgsWithUser.filter((m: any) => m.created_at >= today).map((m: any) => m.user_id));

    res.json({
      totalUsers: users.length,
      totalMessages: allMsgs.length,
      textMessages: texts.length,
      imageMessages: images.length,
      fileMessages: files.length,
      todayMessages: todayMsgs.length,
      weekMessages: weekMsgs.length,
      activeUsers: userIds.size,
      todayActiveUsers: todayUserIds.size,
    });
  } catch (err) {
    res.status(500).json({ error: '获取失败' });
  }
});

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: Date.now(),
    hasSupabaseUrl: !!process.env.SUPABASE_URL,
    hasSupabaseKey: !!process.env.SUPABASE_KEY,
    supabaseUrlLen: (process.env.SUPABASE_URL || '').length,
    supabaseKeyLen: (process.env.SUPABASE_KEY || '').length,
  });
});

// ---- Auto cleanup: delete files >100MB older than 3 months ----
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

async function cleanupOldLargeFiles() {
  try {
    const db = getDb();
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const result = await db.from('messages')
      .select('id,user_id,file_path,file_size')
      .eq('type', 'file')
      .lt('created_at', cutoff);
    const msgs = (result?.data || result || []) as any[];
    let deleted = 0;
    for (const msg of msgs) {
      const size = msg.file_size || 0;
      if (size > 100 * 1024 * 1024) {
        if (msg.file_path) {
          const fp = path.join(UPLOAD_DIR, msg.file_path);
          if (fs.existsSync(fp)) { fs.unlinkSync(fp); }
        }
        await db.from('messages').delete().eq('id', msg.id);
        await db.from('deletions').insert({ user_id: msg.user_id, message_id: msg.id });
        deleted++;
      }
    }
    if (deleted > 0) console.log(`[Cleanup] Deleted ${deleted} old files (>100MB, >3mo)`);
  } catch (err: any) {
    console.error('[Cleanup] Error:', err.message);
  }
}

// Run cleanup on startup and every 24h
cleanupOldLargeFiles();
setInterval(cleanupOldLargeFiles, 24 * 60 * 60 * 1000);

// ---- Serve frontend static files in production ----
if (isProduction) {
  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  if (fs.existsSync(clientDist)) {
    // Static assets with aggressive caching (Vite generates hashed filenames)
    app.use(express.static(clientDist, {
      maxAge: '30d',
      setHeaders: (res, filePath) => {
        // HTML and service worker: no cache (may change between deploys)
        if (filePath.endsWith('.html') || filePath.endsWith('sw.js')) {
          res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        }
      },
    }));
    app.get('*', (_req, res) => { res.sendFile(path.join(clientDist, 'index.html')); });
    console.log('[Server] Serving frontend from', clientDist);
  }
}

// ---- Start server ----
const server = http.createServer(app);
setupWebSocket(server);

function startServer(retries = 8) {
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE' && retries > 0) {
      console.log(`[Server] Port ${PORT} in use, retrying in 5s... (${retries} left)`);
      setTimeout(() => startServer(retries - 1), 5000);
    } else {
      console.error(`[Server] Failed to bind port ${PORT}:`, err.message);
      process.exit(1);
    }
  });

  try {
    server.listen(PORT, () => {
      console.log(`[Server] VibeLink server running on http://localhost:${PORT}`);
    });
  } catch (err: any) {
    if (err.code === 'EADDRINUSE' && retries > 0) {
      console.log(`[Server] Port ${PORT} in use, retrying in 5s... (${retries} left)`);
      setTimeout(() => startServer(retries - 1), 5000);
    } else {
      throw err;
    }
  }
}

startServer();
