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

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[Server] Port ${PORT} is already in use.`);
    process.exit(1);
  }
  throw err;
});

server.listen(PORT, () => {
  console.log(`[Server] VibeLink server running on http://localhost:${PORT}`);
});
