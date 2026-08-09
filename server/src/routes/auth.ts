import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { generateToken, rateLimit } from '../middleware/auth';

const router = Router();

// Helper: run a query and return first row or null
async function queryOne(query: Promise<any>): Promise<any> {
  const result = await query;
  const rows = result?.data || result || [];
  return rows[0] || null;
}

// POST /api/auth/register
router.post('/register', rateLimit(5, 60000), async (req: Request, res: Response) => {
  try {
    const { username, password, publicKey, encryptedPrivateKey } = req.body;

    if (!username || username.length < 2) return res.status(400).json({ error: '用户名至少2个字符' });
    if (!password || password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });

    const db = getDb();
    const exist = await queryOne(db.from('users').select('id').eq('username', username));
    if (exist) return res.status(400).json({ error: '该用户名已存在' });

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await db.from('users').insert({
      id: userId, username,
      password_hash: passwordHash,
      public_key: publicKey || null,
      encrypted_private_key: encryptedPrivateKey || null,
    });

    const sessionId = uuidv4();
    const token = generateToken(userId, sessionId, true);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    await db.from('sessions').insert({
      id: sessionId, user_id: userId, token,
      device_name: req.body.deviceName || '未知设备',
      device_type: req.body.deviceType || 'unknown',
      expires_at: expiresAt,
    });

    return res.json({ token, userId, username, message: '注册成功' });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login
router.post('/login', rateLimit(10, 60000), async (req: Request, res: Response) => {
  try {
    const { username, password, rememberMe, deviceName, deviceType } = req.body;
    if (!username) return res.status(400).json({ error: '请输入用户名' });
    if (!password) return res.status(400).json({ error: '请输入密码' });

    const db = getDb();
    const user = await queryOne(db.from('users').select('*').eq('username', username));
    if (!user) return res.status(400).json({ error: '账号不存在' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(400).json({ error: '密码错误' });

    const sessionId = uuidv4();
    const token = generateToken(user.id, sessionId, !!rememberMe);
    const expiresAt = rememberMe
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.from('sessions').insert({
      id: sessionId, user_id: user.id, token,
      device_name: deviceName || '未知设备',
      device_type: deviceType || 'unknown',
      expires_at: expiresAt,
    });

    return res.json({
      token, userId: user.id, username: user.username,
      publicKey: user.public_key, encryptedPrivateKey: user.encrypted_private_key,
      message: '登录成功',
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: '登录失败' });
  }
});

// POST /api/auth/verify-token
router.post('/verify-token', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: '缺少 token' });

    const db = getDb();
    const session = await queryOne(db.from('sessions')
      .select('*, users(username, public_key, encrypted_private_key)')
      .eq('token', token));

    if (!session || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: '登录已过期' });
    }

    return res.json({
      token, userId: session.user_id, username: session.users?.username,
      publicKey: session.users?.public_key,
      encryptedPrivateKey: session.users?.encrypted_private_key,
    });
  } catch (err: any) {
    return res.status(500).json({ error: '验证失败' });
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (token) await getDb().from('sessions').delete().eq('token', token);
    return res.json({ message: '已退出登录' });
  } catch (err: any) {
    return res.status(500).json({ error: '退出失败' });
  }
});

// POST /api/auth/change-username
router.post('/change-username', async (req: Request, res: Response) => {
  try {
    const { username, password, newUsername } = req.body;
    if (!username || !password || !newUsername) return res.status(400).json({ error: '缺少参数' });
    if (newUsername.length < 2) return res.status(400).json({ error: '新用户名至少2个字符' });

    const db = getDb();
    const user = await queryOne(db.from('users').select('*').eq('username', username));
    if (!user) return res.status(400).json({ error: '用户不存在' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(400).json({ error: '密码错误' });

    const exist = await queryOne(db.from('users').select('id').eq('username', newUsername));
    if (exist) return res.status(400).json({ error: '该用户名已存在' });

    await db.from('users').update({ username: newUsername }).eq('username', username);
    return res.json({ message: '用户名已更新', username: newUsername });
  } catch (err: any) {
    return res.status(500).json({ error: '更新失败' });
  }
});

// POST /api/auth/delete-account
router.post('/delete-account', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: '缺少参数' });

    const db = getDb();
    const user = await queryOne(db.from('users').select('*').eq('username', username));
    if (!user) return res.status(400).json({ error: '用户不存在' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(400).json({ error: '密码错误' });

    await db.from('sessions').delete().eq('user_id', user.id);
    await db.from('messages').delete().eq('user_id', user.id);
    await db.from('deletions').delete().eq('user_id', user.id);
    await db.from('users').delete().eq('id', user.id);

    return res.json({ message: '账号已注销' });
  } catch (err: any) {
    return res.status(500).json({ error: '注销失败' });
  }
});

export default router;
