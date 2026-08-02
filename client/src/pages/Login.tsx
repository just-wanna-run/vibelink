import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

type TabType = 'email' | 'phone';
type ModeType = 'login' | 'register';
type PhoneMethod = 'password' | 'code';

export default function Login() {
  const navigate = useNavigate();
  const { login, register, loginWithCode, sendCode, isLoading } = useAuthStore();

  const [tab, setTab] = useState<TabType>('email');
  const [mode, setMode] = useState<ModeType>('login');
  const [phoneMethod, setPhoneMethod] = useState<PhoneMethod>('password');

  // Form fields
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState('');

  // Countdown for resend
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (countdown > 0) {
      timerRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c <= 1) { clearInterval(timerRef.current); return 0; }
          return c - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [countdown]);

  const resetForm = () => {
    setEmail('');
    setPhone('');
    setPassword('');
    setConfirmPassword('');
    setCode('');
    setError('');
    setPhoneMethod('password');
  };

  const switchMode = (newMode: ModeType) => {
    setMode(newMode);
    setError('');
  };

  const handleSendCode = async () => {
    if (!phone.trim()) {
      setError('请先输入手机号');
      return;
    }
    if (countdown > 0) return;

    setError('');
    try {
      await sendCode(phone.trim());
      setCountdown(60);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (tab === 'email' && !email.trim()) {
      setError('请输入邮箱地址');
      return;
    }
    if (tab === 'phone' && !phone.trim()) {
      setError('请输入手机号');
      return;
    }

    if (tab === 'phone' && mode === 'login' && phoneMethod === 'code') {
      if (!code.trim() || code.length < 4) {
        setError('请输入验证码');
        return;
      }
    } else {
      if (!password || password.length < 6) {
        setError('密码至少6个字符');
        return;
      }
    }

    if (mode === 'register' && password !== confirmPassword) {
      setError('两次密码不一致');
      return;
    }

    try {
      if (mode === 'register') {
        await register({
          email: tab === 'email' ? email.trim() : undefined,
          phone: tab === 'phone' ? phone.trim() : undefined,
          password,
        });
      } else if (tab === 'phone' && phoneMethod === 'code') {
        await loginWithCode({ phone: phone.trim(), code: code.trim(), rememberMe });
      } else {
        await login({
          email: tab === 'email' ? email.trim() : undefined,
          phone: tab === 'phone' ? phone.trim() : undefined,
          password,
          rememberMe,
        });
      }
      navigate('/chat', { replace: true });
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="page-center">
      <div style={{ width: '100%', maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: 'linear-gradient(135deg, #5B9BD5, #4A8AC4)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 12,
          }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text)' }}>VibeLink</h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>
            网页版文件传输助手
          </p>
        </div>

        {/* Card */}
        <div className="card">
          {/* Tabs */}
          <div className="tabs">
            <button className={`tab ${tab === 'email' ? 'active' : ''}`}
              onClick={() => { setTab('email'); resetForm(); }}>
              📧 邮箱
            </button>
            <button className={`tab ${tab === 'phone' ? 'active' : ''}`}
              onClick={() => { setTab('phone'); resetForm(); }}>
              📱 手机号
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {tab === 'email' ? (
              <div className="input-group">
                <label>邮箱地址</label>
                <input type="email" placeholder="请输入邮箱" value={email}
                  onChange={(e) => setEmail(e.target.value)} autoFocus />
              </div>
            ) : (
              <div className="input-group">
                <label>手机号</label>
                <input type="tel" placeholder="请输入手机号" value={phone}
                  onChange={(e) => setPhone(e.target.value)} autoFocus />
              </div>
            )}

            {/* Phone: method switch (login only) */}
            {tab === 'phone' && mode === 'login' && (
              <div style={{
                display: 'flex', marginBottom: 16,
                background: 'var(--border)', borderRadius: 8, padding: 3,
              }}>
                <button type="button"
                  onClick={() => setPhoneMethod('password')}
                  style={{
                    flex: 1, padding: '8px', fontSize: 13, borderRadius: 6,
                    border: 'none',
                    background: phoneMethod === 'password' ? 'var(--white)' : 'transparent',
                    color: phoneMethod === 'password' ? 'var(--text)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: phoneMethod === 'password' ? 600 : 400,
                    transition: 'all 0.2s',
                    boxShadow: phoneMethod === 'password' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  密码登录
                </button>
                <button type="button"
                  onClick={() => setPhoneMethod('code')}
                  style={{
                    flex: 1, padding: '8px', fontSize: 13, borderRadius: 6,
                    border: 'none',
                    background: phoneMethod === 'code' ? 'var(--white)' : 'transparent',
                    color: phoneMethod === 'code' ? 'var(--text)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontWeight: phoneMethod === 'code' ? 600 : 400,
                    transition: 'all 0.2s',
                    boxShadow: phoneMethod === 'code' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                  }}
                >
                  验证码登录
                </button>
              </div>
            )}

            {/* Password fields (not for code login) */}
            {!(tab === 'phone' && mode === 'login' && phoneMethod === 'code') && (
              <>
                <div className="input-group">
                  <label>密码</label>
                  <input type="password" placeholder="至少6个字符" value={password}
                    onChange={(e) => setPassword(e.target.value)} />
                </div>

                {mode === 'register' && (
                  <div className="input-group">
                    <label>确认密码</label>
                    <input type="password" placeholder="再次输入密码" value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)} />
                  </div>
                )}
              </>
            )}

            {/* Verification code input */}
            {tab === 'phone' && mode === 'login' && phoneMethod === 'code' && (
              <div className="input-group">
                <label>验证码</label>
                <div style={{ display: 'flex', gap: 10 }}>
                  <input type="text" placeholder="输入验证码" value={code}
                    onChange={(e) => setCode(e.target.value)} maxLength={6}
                    style={{ flex: 1 }} />
                  <button type="button"
                    onClick={handleSendCode} disabled={countdown > 0}
                    style={{
                      whiteSpace: 'nowrap', padding: '0 16px', fontSize: 13, borderRadius: 6,
                      border: '1.5px solid var(--primary)', cursor: countdown > 0 ? 'default' : 'pointer',
                      background: countdown > 0 ? 'var(--border)' : 'var(--white)',
                      color: countdown > 0 ? 'var(--text-secondary)' : 'var(--primary)',
                    }}
                  >
                    {countdown > 0 ? `${countdown}s` : '获取验证码'}
                  </button>
                </div>
              </div>
            )}

            {/* Remember Me (login only) */}
            {mode === 'login' && (
              <label style={{
                display: 'flex', alignItems: 'center', gap: 8,
                marginBottom: 16, cursor: 'pointer', fontSize: 14, color: 'var(--text-secondary)',
              }}>
                <input type="checkbox" checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                记住密码（30天免登录）
              </label>
            )}

            {/* Error */}
            {error && (
              <div style={{
                background: '#FFF0F0', color: 'var(--danger)',
                padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                fontSize: 14, marginBottom: 16,
              }}>
                {error}
              </div>
            )}

            {/* Submit */}
            <button type="submit" className="btn btn-primary btn-block" disabled={isLoading}>
              {isLoading ? '处理中...' : mode === 'login' ? '登录' : '注册'}
            </button>
          </form>

          {/* Mode switch */}
          <div style={{ textAlign: 'center', marginTop: 20, fontSize: 14, color: 'var(--text-secondary)' }}>
            {mode === 'login' ? (
              <>还没有账号？{' '}
                <button onClick={() => switchMode('register')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                  立即注册
                </button>
              </>
            ) : (
              <>已有账号？{' '}
                <button onClick={() => switchMode('login')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
                  去登录
                </button>
              </>
            )}
          </div>
        </div>

        {/* Security note */}
        <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: 'var(--text-secondary)' }}>
          🔒 所有内容端到端加密，服务器无法查看你的数据
        </p>
      </div>
    </div>
  );
}
