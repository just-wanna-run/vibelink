import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { notifyNewMessage, notifyMessageDeleted } from '../ws';

const router = Router();

// File upload config
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB file
    fieldSize: 50 * 1024 * 1024,   // 50MB field (for base64 image content)
  },
});

// POST /api/messages/send — send a text/image/file message
router.post('/send', authMiddleware, upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sessionId = req.sessionId!;
    const { type, content, iv, encryptedKey, clientMessageId } = req.body;

    if (!type || !clientMessageId) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // Dedup — ignore duplicate clientMessageId
    const existing = getDb().prepare('SELECT id FROM messages WHERE client_message_id = ?').get(clientMessageId);
    if (existing) {
      return res.json({ id: (existing as any).id, duplicate: true });
    }

    const messageId = uuidv4();
    let filePath: string | null = null;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let fileType: string | null = null;

    if (req.file) {
      filePath = req.file.filename;
      fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      fileSize = req.file.size;
      fileType = req.file.mimetype;
    }

    getDb().prepare(`
      INSERT INTO messages (id, user_id, from_device, type, content, file_name, file_size, file_type, file_path, encrypted_key, iv, client_message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(messageId, userId, sessionId, type, content || null, fileName, fileSize, fileType, filePath, encryptedKey || null, iv || null, clientMessageId);

    saveDb();

    // Return the message
    const message = getDb().prepare('SELECT * FROM messages WHERE id = ?').get(messageId);

    // Notify other devices of the same user
    notifyNewMessage(userId, message);

    return res.json({ message });
  } catch (err: any) {
    console.error('Send message error:', err);
    return res.status(500).json({ error: '发送失败' });
  }
});

// GET /api/messages/history — get user's message history
router.get('/history', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = parseInt(req.query.before as string) || Date.now() / 1000;

    const messages = getDb().prepare(`
      SELECT * FROM messages
      WHERE user_id = ? AND created_at < ?
      ORDER BY created_at DESC
      LIMIT ?
    `).all(userId, before, limit);

    return res.json({ messages: messages.reverse() });
  } catch (err: any) {
    console.error('Get history error:', err);
    return res.status(500).json({ error: '获取记录失败' });
  }
});

// GET /api/messages/poll?after=<timestamp> — poll for new messages (replaces WebSocket)
router.get('/poll', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const after = parseInt(req.query.after as string) || 0;

    const messages = getDb().prepare(`
      SELECT * FROM messages
      WHERE user_id = ? AND created_at > ?
      ORDER BY created_at ASC
      LIMIT 20
    `).all(userId, after);

    return res.json({ messages });
  } catch (err: any) {
    console.error('Poll error:', err);
    return res.status(500).json({ error: '获取消息失败' });
  }
});

// DELETE /api/messages/all — clear all messages for user
router.delete('/all', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    // Delete files from disk
    const messages = getDb().prepare('SELECT file_path FROM messages WHERE user_id = ? AND file_path IS NOT NULL').all(userId) as any[];
    for (const msg of messages) {
      const fp = path.join(UPLOAD_DIR, msg.file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    getDb().prepare('DELETE FROM messages WHERE user_id = ?').run(userId);
    saveDb();
    return res.json({ message: '已清空' });
  } catch (err: any) {
    return res.status(500).json({ error: '清空失败' });
  }
});

// DELETE /api/messages/:id — delete a message
router.delete('/:id', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const messageId = req.params.id;

    const msg = getDb().prepare('SELECT * FROM messages WHERE id = ? AND user_id = ?').get(messageId, userId) as any;
    if (!msg) {
      return res.status(404).json({ error: '消息不存在' });
    }

    // Delete file if exists
    if (msg.file_path) {
      const filePath = path.join(UPLOAD_DIR, msg.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    getDb().prepare('DELETE FROM messages WHERE id = ?').run(messageId);

    saveDb();

    // Notify other devices
    notifyMessageDeleted(userId, messageId);

    return res.json({ message: '已删除' });
  } catch (err: any) {
    console.error('Delete message error:', err);
    return res.status(500).json({ error: '删除失败' });
  }
});

export default router;
