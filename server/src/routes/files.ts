import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

// GET /api/files/:filename — download a file
router.get('/:filename', authMiddleware, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const filename = req.params.filename;

    // Verify the file belongs to this user
    const msg = getDb().prepare('SELECT * FROM messages WHERE file_path = ? AND user_id = ?').get(filename, userId) as any;
    if (!msg) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件已过期' });
    }

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(msg.file_name || filename)}`);
    res.setHeader('Content-Type', msg.file_type || 'application/octet-stream');
    res.setHeader('Content-Length', msg.file_size);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err: any) {
    console.error('Download file error:', err);
    return res.status(500).json({ error: '下载失败' });
  }
});

export default router;
