import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb, saveDb } from '../db';
import { generateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, phone, password, publicKey, encryptedPrivateKey } = req.body;

    // Validate required fields
    if (!password || password.length < 6) {
      return res.status(400).json({ error: '密码至少6个字符' });
    }

    if (!email && !phone) {
      return res.status(400).json({ error: '请填写邮箱或手机号' });
    }

    // Check if email or phone already exists
    if (email) {
      const existing = getDb().prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) {
        return res.status(400).json({ error: '该邮箱已被注册' });
      }
    }

    if (phone) {
      const existing = getDb().prepare('SELECT id FROM users WHERE phone = ?').get(phone);
      if (existing) {
        return res.status(400).json({ error: '该手机号已被注册' });
      }
    }

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    getDb().prepare(`
      INSERT INTO users (id, email, phone, password_hash, public_key, encrypted_private_key)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, email || null, phone || null, passwordHash, publicKey || null, encryptedPrivateKey || null);

    saveDb();

    // Create a session for auto-login
    const sessionId = uuidv4();
    const token = generateToken(userId, sessionId, true);
    const expiresAt = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60; // 30 days

    getDb().prepare(`
      INSERT INTO sessions (id, user_id, token, device_name, device_type, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, token, req.body.deviceName || '未知设备', req.body.deviceType || 'unknown', expiresAt);

    saveDb();

    return res.json({
      token,
      userId,
      email: email || null,
      phone: phone || null,
      message: '注册成功',
    });
  } catch (err: any) {
    console.error('Register error details:', err?.message || err, err?.stack || '');
    return res.status(500).json({ error: `注册失败: ${err?.message || '未知错误'}` });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, phone, password, rememberMe, deviceName, deviceType } = req.body;

    if (!password) {
      return res.status(400).json({ error: '请输入密码' });
    }

    // Find user by email or phone
    let user: any;
    if (email) {
      user = getDb().prepare('SELECT * FROM users WHERE email = ?').get(email);
    } else if (phone) {
      user = getDb().prepare('SELECT * FROM users WHERE phone = ?').get(phone);
    } else {
      return res.status(400).json({ error: '请输入邮箱或手机号' });
    }

    if (!user) {
      return res.status(400).json({ error: '账号不存在' });
    }

    // Verify password
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(400).json({ error: '密码错误' });
    }

    // Create session
    const sessionId = uuidv4();
    const token = generateToken(user.id, sessionId, !!rememberMe);
    const expiresAt = rememberMe
      ? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60   // 30 days
      : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;   // 7 days

    getDb().prepare(`
      INSERT INTO sessions (id, user_id, token, device_name, device_type, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, user.id, token, deviceName || '未知设备', deviceType || 'unknown', expiresAt);

    saveDb();

    return res.json({
      token,
      userId: user.id,
      email: user.email,
      phone: user.phone,
      publicKey: user.public_key,
      encryptedPrivateKey: user.encrypted_private_key,
      message: '登录成功',
    });
  } catch (err: any) {
    console.error('Login error details:', err?.message || err, err?.stack || '');
    return res.status(500).json({ error: `登录失败: ${err?.message || '未知错误'}` });
  }
});

// POST /api/auth/verify-token — validate stored token on app start
router.post('/verify-token', (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({ error: '缺少 token' });
    }

    // Check session exists and not expired
    const session = getDb().prepare(`
      SELECT s.*, u.email, u.phone, u.public_key, u.encrypted_private_key
      FROM sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ?
    `).get(token) as any;

    if (!session || session.expires_at < Math.floor(Date.now() / 1000)) {
      return res.status(401).json({ error: '登录已过期' });
    }

    return res.json({
      token,
      userId: session.user_id,
      email: session.email,
      phone: session.phone,
      publicKey: session.public_key,
      encryptedPrivateKey: session.encrypted_private_key,
    });
  } catch (err: any) {
    console.error('Verify token error:', err);
    return res.status(500).json({ error: '验证失败' });
  }
});

// ---- In-memory verification code store (production: use SMS service) ----
const codeStore = new Map<string, { code: string; expires: number }>();

// POST /api/auth/send-code
router.post('/send-code', (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: '请输入手机号' });
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    codeStore.set(phone, { code, expires: Date.now() + 5 * 60 * 1000 }); // 5 min

    // In production: send via SMS service (Alibaba Cloud / Tencent Cloud)
    // For dev: log to console AND return in response
    console.log(`[SMS] Verification code for ${phone}: ${code}`);

    return res.json({ message: '验证码已发送', code });
  } catch (err: any) {
    console.error('Send code error:', err);
    return res.status(500).json({ error: '发送失败' });
  }
});

// POST /api/auth/login-with-code
router.post('/login-with-code', async (req: Request, res: Response) => {
  try {
    const { phone, code, rememberMe, deviceName, deviceType } = req.body;

    if (!phone || !code) {
      return res.status(400).json({ error: '请输入手机号和验证码' });
    }

    // Verify code
    const stored = codeStore.get(phone);
    if (!stored || stored.expires < Date.now()) {
      codeStore.delete(phone);
      return res.status(400).json({ error: '验证码已过期，请重新获取' });
    }
    if (stored.code !== code) {
      return res.status(400).json({ error: '验证码错误' });
    }
    codeStore.delete(phone);

    // Find or create user
    let user = getDb().prepare('SELECT * FROM users WHERE phone = ?').get(phone) as any;
    if (!user) {
      // Auto-register: create user with random password
      const userId = uuidv4();
      const randomPass = uuidv4();
      const passwordHash = await bcrypt.hash(randomPass, 12);

      getDb().prepare(`
        INSERT INTO users (id, phone, password_hash) VALUES (?, ?, ?)
      `).run(userId, phone, passwordHash);
      saveDb();

      user = getDb().prepare('SELECT * FROM users WHERE id = ?').get(userId) as any;
    }

    // Create session
    const sessionId = uuidv4();
    const token = generateToken(user.id, sessionId, !!rememberMe);
    const expiresAt = rememberMe
      ? Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60
      : Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;

    getDb().prepare(`
      INSERT INTO sessions (id, user_id, token, device_name, device_type, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sessionId, user.id, token, deviceName || '手机', deviceType || 'mobile', expiresAt);
    saveDb();

    return res.json({
      token,
      userId: user.id,
      email: user.email,
      phone: user.phone,
      publicKey: user.public_key,
      encryptedPrivateKey: user.encrypted_private_key,
      isNewUser: !user.email, // no email = auto-registered via phone
    });
  } catch (err: any) {
    console.error('Login-with-code error:', err);
    return res.status(500).json({ error: '登录失败' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (token) {
      getDb().prepare('DELETE FROM sessions WHERE token = ?').run(token);
      saveDb();
    }
    return res.json({ message: '已退出登录' });
  } catch (err: any) {
    return res.status(500).json({ error: '退出失败' });
  }
});

export default router;
