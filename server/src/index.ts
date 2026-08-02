import express from 'express';
import cors from 'cors';
import http from 'http';
import authRoutes from './routes/auth';
import messageRoutes from './routes/messages';
import fileRoutes from './routes/files';
import { setupWebSocket } from './ws';
import { dbReady } from './db';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// ---- Middleware ----
app.use(cors());
app.use(express.json({ limit: '10mb' })); // for base64 image content
app.use(express.urlencoded({ extended: true }));

// ---- Routes ----
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/files', fileRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// ---- Start server after database is ready ----
async function start() {
  await dbReady;
  console.log('[Server] Database initialized');

  const server = http.createServer(app);
  setupWebSocket(server);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[Server] Port ${PORT} is already in use.`);
      console.error('[Server] Please stop the other server first:');
      console.error('[Server]   Windows: netstat -ano | findstr :' + PORT);
      console.error('[Server]            taskkill //F //PID <PID>');
      console.error('[Server]   Mac/Linux: lsof -i :' + PORT + ' | grep LISTEN');
      console.error('[Server]              kill -9 <PID>');
      process.exit(1);
    }
    throw err;
  });

  server.listen(PORT, () => {
    console.log(`[Server] VibeLink server running on http://localhost:${PORT}`);
    console.log(`[Server] WebSocket on ws://localhost:${PORT}/ws`);
  });
}

start().catch((err) => {
  console.error('[Server] Failed to start:', err.message || err);
  process.exit(1);
});
