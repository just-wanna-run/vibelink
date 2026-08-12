import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => { const ext = path.extname(file.originalname); cb(null, `${uuidv4()}${ext}`); },
});

const upload = multer({ storage, limits: { fileSize: 1024 * 1024 * 1024, fieldSize: 50 * 1024 * 1024 } });

// POST /api/messages/send
router.post('/send', authMiddleware, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const sessionId = req.sessionId!;
    const { type, content, iv, encryptedKey, clientMessageId, categoryId } = req.body;

    if (!type || !clientMessageId) return res.status(400).json({ error: '缺少必要参数' });

    const db = getDb();
    const { data: existing } = await db.from('messages').select('id').eq('client_message_id', clientMessageId).maybeSingle();
    if (existing) return res.json({ id: existing.id, duplicate: true });

    const messageId = uuidv4();
    let filePath: string | null = null, fileName: string | null = null, fileSize: number | null = null, fileType: string | null = null;

    if (req.file) {
      filePath = req.file.filename;
      fileName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
      fileSize = req.file.size;
      fileType = req.file.mimetype;
    }

    await db.from('messages').insert({
      id: messageId, user_id: userId, from_device: sessionId, type,
      content: content || null, file_name: fileName, file_size: fileSize,
      file_type: fileType, file_path: filePath, encrypted_key: encryptedKey || null,
      iv: iv || null, client_message_id: clientMessageId,
      category_id: categoryId || null,
    });

    const { data: message } = await db.from('messages').select('*').eq('id', messageId).single();
    return res.json({ message });
  } catch (err: any) {
    console.error('Send message error:', err);
    return res.status(500).json({ error: '发送失败' });
  }
});

// GET /api/messages/history
router.get('/history', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const limit = parseInt(req.query.limit as string) || 50;
    const before = parseInt(req.query.before as string) || Math.floor(Date.now() / 1000);

    const db = getDb();
    const beforeDate = new Date(before * 1000).toISOString();
    let query = db.from('messages')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
    const result = await query;
    const messages = result.data || result;

    return res.json({ messages: (messages || []).reverse() });
  } catch (err: any) {
    return res.status(500).json({ error: '获取记录失败' });
  }
});

// GET /api/messages/poll
router.get('/poll', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const db = getDb();

    // Get latest messages (client deduplicates by client_message_id)
    const result = await db.from('messages')
      .select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(20);
    const messages = ((result.data || result) || []).reverse();

    // Deleted message IDs for cross-device sync
    const delResult = await db.from('deletions')
      .select('message_id').eq('user_id', userId).order('deleted_at', { ascending: true }).limit(100) as any;
    const rows = delResult.data || delResult || [];
    const deletedIds = rows.map((d: any) => d.message_id);
    console.log('[Poll]', messages.length, 'msgs,', deletedIds.length, 'deleted');
    return res.json({ messages, deletedIds });
  } catch (err: any) {
    return res.status(500).json({ error: '获取消息失败' });
  }
});

// POST /api/messages/batch-delete
router.post('/batch-delete', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: '请选择要删除的消息' });

    const db = getDb();
    for (const id of ids) {
      const { data: msg } = await db.from('messages').select('file_path').eq('id', id).eq('user_id', userId).maybeSingle() as any;
      if (msg?.file_path) {
        const fp = path.join(UPLOAD_DIR, msg.file_path);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
    }
    await db.from('messages').delete().eq('user_id', userId).in('id', ids);
    // Record deletions for cross-device sync
    for (const id of ids) {
      try {
        await db.from('deletions').insert({ user_id: userId, message_id: id });
        console.log('[Sync] Deletion recorded:', id);
      } catch (e: any) {
        console.error('[Sync] Failed to record deletion:', id, e.message);
      }
    }
    return res.json({ message: '已删除' });
  } catch (err: any) {
    return res.status(500).json({ error: '删除失败' });
  }
});

// DELETE /api/messages/all
router.delete('/all', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const db = getDb();
    // Get all messages for this user (for file cleanup + sync tracking)
    const { data: allMessages } = await db.from('messages').select('id,file_path').eq('user_id', userId) as any;
    for (const msg of (allMessages || [])) {
      if (msg.file_path) {
        const fp = path.join(UPLOAD_DIR, msg.file_path);
        if (fs.existsSync(fp)) fs.unlinkSync(fp);
      }
      await db.from('deletions').insert({ user_id: userId, message_id: msg.id });
    }
    await db.from('messages').delete().eq('user_id', userId);
    return res.json({ message: '已清空' });
  } catch (err: any) {
    return res.status(500).json({ error: '清空失败' });
  }
});

// DELETE /api/messages/:id
router.delete('/:id', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const messageId = req.params.id;
    const db = getDb();
    const { data: msg } = await db.from('messages').select('*').eq('id', messageId).eq('user_id', userId).maybeSingle() as any;
    if (!msg) return res.status(404).json({ error: '消息不存在' });
    if (msg.file_path) {
      const fp = path.join(UPLOAD_DIR, msg.file_path);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    }
    await db.from('messages').delete().eq('id', messageId);
    try {
      await db.from('deletions').insert({ user_id: userId, message_id: messageId });
      console.log('[Sync] Deletion recorded:', messageId);
    } catch (e: any) {
      console.error('[Sync] Failed to record deletion:', messageId, e.message);
    }
    return res.json({ message: '已删除' });
  } catch (err: any) {
    return res.status(500).json({ error: '删除失败' });
  }
});

export default router;
