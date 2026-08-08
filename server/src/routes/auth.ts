import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db';
import { generateToken } from '../middleware/auth';

const router = Router();

// Helper: run a query and return first row or null (avoids buggy maybeSingle)
async function queryOne(query: Promise<any>): Promise<any> {
  const result = await query;
  const rows = result?.data || result || [];
  return rows[0] || null;
}

// POST /api/auth/send-register-code
router.post('/send-register-code', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: '请输入邮箱' });
    console.log('[Auth] send-register-code called for:', email);
    // Check if email already registered
    const emailExist = await queryOne(getDb().from('users').select('id').eq('recovery_email', email));
    if (emailExist) return res.status(400).json({ error: '该邮箱已被绑定' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    codeStore.set(`reg_${email}`, { code, expires: Date.now() + 5 * 60 * 1000 });
    const sent = await sendEmailCode(email, code, '注册验证');
    return res.json({ sent, code: sent ? undefined : code });
  } catch (err: any) {
    console.log('[Auth] send-register-code error:', err.message || String(err));
    return res.status(500).json({ error: '发送失败' });
  }
});

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, password, recoveryEmail, emailCode, publicKey, encryptedPrivateKey } = req.body;

    if (!username || username.length < 2) return res.status(400).json({ error: '用户名至少2个字符' });
    if (!password || password.length < 6) return res.status(400).json({ error: '密码至少6个字符' });
    if (!recoveryEmail) return res.status(400).json({ error: '请绑定邮箱用于找回密码' });

    // Verify email code
    const stored = codeStore.get(`reg_${recoveryEmail}`);
    if (!stored || stored.expires < Date.now()) {
      codeStore.delete(`reg_${recoveryEmail}`);
      return res.status(400).json({ error: '验证码已过期，请重新获取' });
    }
    if (stored.code !== emailCode) return res.status(400).json({ error: '验证码错误' });
    codeStore.delete(`reg_${recoveryEmail}`);

    const db = getDb();

    // Check if username exists
    const exist = await queryOne(db.from('users').select('id').eq('username', username));
    if (exist) return res.status(400).json({ error: '该用户名已存在' });

    const userId = uuidv4();
    const passwordHash = await bcrypt.hash(password, 12);

    await db.from('users').insert({
      id: userId, username,
      password_hash: passwordHash,
      recovery_email: recoveryEmail || null,
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

    return res.json({ token, userId, username, recoveryEmail, message: '注册成功' });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ error: '注册失败' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
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
      recoveryEmail: user.recovery_email,
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
      .select('*, users(username, recovery_email, public_key, encrypted_private_key)')
      .eq('token', token));

    if (!session || new Date(session.expires_at) < new Date()) {
      return res.status(401).json({ error: '登录已过期' });
    }

    return res.json({
      token, userId: session.user_id, username: session.users?.username,
      recoveryEmail: session.users?.recovery_email,
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

// ---- In-memory verification code store ----
const codeStore = new Map<string, { code: string; expires: number }>();
import { sendEmailCode } from '../services/email';

// POST /api/auth/send-reset-code
router.post('/send-reset-code', async (req: Request, res: Response) => {
  try {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: '请输入用户名' });

    const db = getDb();
    const user = await queryOne(db.from('users').select('id,recovery_email').eq('username', username));
    if (!user) return res.status(400).json({ error: '该账号不存在' });
    if (!user.recovery_email) return res.status(400).json({ error: '该账号未绑定邮箱，无法找回密码' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    codeStore.set(`reset_${username}`, { code, expires: Date.now() + 5 * 60 * 1000 });
    const sent = await sendEmailCode(user.recovery_email, code, '重置密码');
    return res.json({ message: '验证码已发送', sent, code: sent ? undefined : code });
  } catch (err: any) {
    return res.status(500).json({ error: '发送失败' });
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

    // Delete all user data
    await db.from('sessions').delete().eq('user_id', user.id);
    await db.from('messages').delete().eq('user_id', user.id);
    await db.from('deletions').delete().eq('user_id', user.id);
    await db.from('users').delete().eq('id', user.id);

    return res.json({ message: '账号已注销' });
  } catch (err: any) {
    return res.status(500).json({ error: '注销失败' });
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

    // Check if new username is taken
    const exist = await queryOne(db.from('users').select('id').eq('username', newUsername));
    if (exist) return res.status(400).json({ error: '该用户名已存在' });

    await db.from('users').update({ username: newUsername }).eq('username', username);
    return res.json({ message: '用户名已更新', username: newUsername });
  } catch (err: any) {
    return res.status(500).json({ error: '更新失败' });
  }
});

// POST /api/auth/send-change-email-code
router.post('/send-change-email-code', async (req: Request, res: Response) => {
  try {
    const { username, password, newEmail } = req.body;
    if (!username || !password || !newEmail) return res.status(400).json({ error: '缺少参数' });

    const db = getDb();
    const user = await queryOne(db.from('users').select('*').eq('username', username));
    if (!user) return res.status(400).json({ error: '用户不存在' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(400).json({ error: '密码错误' });

    // Check if new email is already used by someone else
    const exist = await queryOne(db.from('users').select('id').eq('recovery_email', newEmail));
    if (exist) return res.status(400).json({ error: '该邮箱已被其他账号绑定' });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    codeStore.set(`chg_${username}_${newEmail}`, { code, expires: Date.now() + 5 * 60 * 1000 });
    const sent = await sendEmailCode(newEmail, code, '修改绑定邮箱');
    return res.json({ sent, code: sent ? undefined : code });
  } catch (err: any) {
    return res.status(500).json({ error: '发送失败' });
  }
});

// POST /api/auth/change-email
router.post('/change-email', async (req: Request, res: Response) => {
  try {
    const { username, password, newEmail, code } = req.body;
    if (!username || !password || !newEmail || !code) return res.status(400).json({ error: '缺少参数' });

    const db = getDb();
    const user = await queryOne(db.from('users').select('*').eq('username', username));
    if (!user) return res.status(400).json({ error: '用户不存在' });

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) return res.status(400).json({ error: '密码错误' });

    // Verify code
    const stored = codeStore.get(`chg_${username}_${newEmail}`);
    if (!stored || stored.expires < Date.now()) {
      codeStore.delete(`chg_${username}_${newEmail}`);
      return res.status(400).json({ error: '验证码已过期，请重新获取' });
    }
    if (stored.code !== code) return res.status(400).json({ error: '验证码错误' });
    codeStore.delete(`chg_${username}_${newEmail}`);

    await db.from('users').update({ recovery_email: newEmail }).eq('username', username);
    return res.json({ message: '邮箱已更新' });
  } catch (err: any) {
    return res.status(500).json({ error: '更新失败' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { username, code, newPassword } = req.body;
    if (!username) return res.status(400).json({ error: '请输入用户名' });
    if (!code) return res.status(400).json({ error: '请输入验证码' });
    if (!newPassword || newPassword.length < 6) return res.status(400).json({ error: '新密码至少6个字符' });

    const stored = codeStore.get(`reset_${username}`);
    if (!stored || stored.expires < Date.now()) { codeStore.delete(`reset_${username}`); return res.status(400).json({ error: '验证码已过期' }); }
    if (stored.code !== code) return res.status(400).json({ error: '验证码错误' });
    codeStore.delete(`reset_${username}`);

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await getDb().from('users').update({ password_hash: passwordHash }).eq('username', username);

    return res.json({ message: '密码已重置，请重新登录' });
  } catch (err: any) {
    return res.status(500).json({ error: '重置失败' });
  }
});

export default router;
