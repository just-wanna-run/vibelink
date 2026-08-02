import { Router, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { getDb } from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

router.get('/:filename', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.userId!;
    const filename = req.params.filename;

    const { data: msg } = await getDb().from('messages')
      .select('*').eq('file_path', filename).eq('user_id', userId).maybeSingle() as any;

    if (!msg) return res.status(404).json({ error: '文件不存在' });

    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: '文件已过期' });

    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(msg.file_name || filename)}`);
    res.setHeader('Content-Type', msg.file_type || 'application/octet-stream');
    res.setHeader('Content-Length', msg.file_size);
    fs.createReadStream(filePath).pipe(res);
  } catch (err: any) {
    return res.status(500).json({ error: '下载失败' });
  }
});

export default router;
