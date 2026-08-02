import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { generateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, phone, password, publicKey, encryptedPrivateKey } = req.body;

    if (!password || password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });
    if (!email && !phone) return res.status(400).json({ error: '请填写邮箱或手机号' });

    const db = getDb();

    if (email) {
      const { data: exist } = await db.from('users').select('id').eq('email', email).maybeSingle();
      if (exist) return res.status(400).json({ error: '该邮箱已被注册' });
    }
    if (phone) {
      const { data: exist } = await db.from('users').select('id').eq('phone', phone).maybeSingle();
      if (exist) return res.status(400).json({ error: '该手机号已被注册' });
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await db.from('users').insert({
      id: userId, email: email || null, phone: phone || null,
      password_hash: passwordHash, public_key: publicKey || null,
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

    return res.json({ token, userId, email: email || null, phone: phone || null, message: '注册成功' });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, phone, password, rememberMe, deviceName, deviceType } = req.body;
    if (!password) return res.status(400).json({ error: '请输入密码' });

    const db = getDb();
    let user: any;

    if (email) {
      const { data } = await db.from('users').select('*').eq('email', email).maybeSingle();
      user = data;
    } else if (phone) {
      const { data } = await db.from('users').select('*').eq('phone', phone).maybeSingle();
      user = data;
    } else {
      return res.status(400).json({ error: '请输入邮箱或手机号' });
    }

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
      token, userId: user.id, email: user.email, phone: user.phone,
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
    const { data: session } = await db.from('sessions')
      .select('*, users(email, phone, public_key, encrypted_private_key)')
      .eq('token', token)
      .maybeSingle() as any;

    if (!session || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: '登录已过期' });
    }

    return res.json({
      token, userId: session.user_id, email: session.users?.email,
      phone: session.users?.phone, publicKey: session.users?.public_key,
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

// ---- In-memory verification code store ----
const codeStore = new Map<string, { code: string; expires: number }>();
import { sendSMS } from '../services/sms';

// POST /api/auth/send-code
router.post('/send-code', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: '请输入手机号' });
    const code = String(Math.floor(100000 + Math.random() * 900000));
    codeStore.set(phone, { code, expires: Date.now() + 5 * 60 * 1000 });
    const result = await sendSMS(phone, code);
    return res.json({ message: result.dev ? '验证码已发送（开发模式）' : '验证码已发送', code: result.dev ? code : undefined });
  } catch (err: any) {
    return res.status(500).json({ error: '发送失败' });
  }
});

// POST /api/auth/login-with-code
router.post('/login-with-code', async (req: Request, res: Response) => {
  try {
    const { phone, code, rememberMe, deviceName, deviceType } = req.body;
    if (!phone || !code) return res.status(400).json({ error: '请输入手机号和验证码' });

    const stored = codeStore.get(phone);
    if (!stored || stored.expires < Date.now()) { codeStore.delete(phone); return res.status(400).json({ error: '验证码已过期' }); }
    if (stored.code !== code) return res.status(400).json({ error: '验证码错误' });
    codeStore.delete(phone);

    const db = getDb();
    let { data: user } = await db.from('users').select('*').eq('phone', phone).maybeSingle() as any;

    if (!user) {
      const userId = uuidv4();
      const randomPass = uuidv4();
      const passwordHash = await bcrypt.hash(randomPass, 12);
      await db.from('users').insert({ id: userId, phone, password_hash: passwordHash });
      const { data: u } = await db.from('users').select('*').eq('id', userId).single();
      user = u;
    }

    const sessionId = uuidv4();
    const token = generateToken(user.id, sessionId, !!rememberMe);
    const expiresAt = rememberMe
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await db.from('sessions').insert({ id: sessionId, user_id: user.id, token, device_name: deviceName || '手机', device_type: deviceType || 'mobile', expires_at: expiresAt });

    return res.json({ token, userId: user.id, email: user.email, phone: user.phone, publicKey: user.public_key, encryptedPrivateKey: user.encrypted_private_key, isNewUser: !user.email });
  } catch (err: any) {
    return res.status(500).json({ error: '登录失败' });
  }
});

// POST /api/auth/send-reset-code
router.post('/send-reset-code', async (req: Request, res: Response) => {
  try {
    const { email, phone } = req.body;
    if (!email && !phone) return res.status(400).json({ error: '请输入邮箱或手机号' });
    const db = getDb();
    let user: any;
    if (email) { const { data } = await db.from('users').select('*').eq('email', email).maybeSingle(); user = data; }
    else { const { data } = await db.from('users').select('*').eq('phone', phone).maybeSingle(); user = data; }
    if (!user) return res.status(400).json({ error: '该账号不存在' });

    const target = email || phone;
    const code = String(Math.floor(100000 + Math.random() * 900000));
    codeStore.set(`reset_${target}`, { code, expires: Date.now() + 5 * 60 * 1000 });
    const result = await sendSMS(phone || '', code);
    if (email) console.log(`[RESET] Reset code for ${email}: ${code}`);
    return res.json({ message: '验证码已发送', code: result.dev ? code : undefined });
  } catch (err: any) {
    return res.status(500).json({ error: '发送失败' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { email, phone, code, newPassword } = req.body;
    if (!email && !phone) return res.status(400).json({ error: '请输入邮箱或手机号' });
    if (!code) return res.status(400).json({ error: '请输入验证码' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '新密码至少6个字符' });

    const target = email || phone;
    const stored = codeStore.get(`reset_${target}`);
    if (!stored || stored.expires < Date.now()) { codeStore.delete(`reset_${target}`); return res.status(400).json({ error: '验证码已过期' }); }
    if (stored.code !== code) return res.status(400).json({ error: '验证码错误' });
    codeStore.delete(`reset_${target}`);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    const db = getDb();
    if (email) await db.from('users').update({ password_hash: passwordHash }).eq('email', email);
    else await db.from('users').update({ password_hash: passwordHash }).eq('phone', phone);

    return res.json({ message: '密码已重置，请重新登录' });
  } catch (err: any) {
    return res.status(500).json({ error: '重置失败' });
  }
});

export default router;
