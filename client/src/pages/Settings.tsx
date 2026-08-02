import { useState } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import api from '../services/api';

export default function Settings() {
  const { user } = useAuthStore();
  const { theme, toggle } = useThemeStore();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg(null);
    if (!oldPassword || !newPassword) { setMsg({ type: 'error', text: '请填写所有密码字段' }); return; }
    if (newPassword.length < 6) { setMsg({ type: 'error', text: '新密码至少6个字符' }); return; }
    if (newPassword !== confirmPassword) { setMsg({ type: 'error', text: '两次新密码不一致' }); return; }
    try {
      await api.post('/auth/login', { email: user?.email || undefined, phone: user?.phone || undefined, password: oldPassword });
      setMsg({ type: 'success', text: '密码验证成功（密码修改功能将在后续版本支持）' });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch { setMsg({ type: 'error', text: '原密码错误' }); }
  };

  return (
    <Layout>
      <div style={{ maxWidth: 600, margin: '0 auto', padding: 20, width: '100%' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>设置</h1>

        {/* Account info */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>账号信息</h2>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {user?.email && <p style={{ marginBottom: 4 }}>📧 邮箱：{user.email}</p>}
            {user?.phone && <p style={{ marginBottom: 4 }}>📱 手机：{user.phone}</p>}
          </div>
        </div>

        {/* Dark mode */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600 }}>夜间模式</h2>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 2 }}>{theme === 'dark' ? '已开启' : '已关闭'}</p>
            </div>
            <button onClick={toggle} style={{ width: 52, height: 28, borderRadius: 14, border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', background: theme === 'dark' ? 'var(--primary)' : '#ccc' }}>
              <span style={{ position: 'absolute', top: 3, left: theme === 'dark' ? 27 : 3, width: 22, height: 22, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
            </button>
          </div>
        </div>

        {/* Change password — collapsible */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div onClick={() => setShowPasswordChange(!showPasswordChange)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>修改密码</h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14, transform: showPasswordChange ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
          </div>
          {showPasswordChange && (
            <form onSubmit={handleChangePassword} style={{ marginTop: 16 }}>
              <div className="input-group"><label>原密码</label><input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="输入原密码" /></div>
              <div className="input-group"><label>新密码</label><input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少6个字符" /></div>
              <div className="input-group"><label>确认新密码</label><input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" /></div>
              {msg && <div style={{ padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14, marginBottom: 16, background: msg.type === 'success' ? '#E8F5E9' : '#FFF0F0', color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)' }}>{msg.text}</div>}
              <button type="submit" className="btn btn-primary">修改密码</button>
            </form>
          )}
        </div>

        {/* Feedback — collapsible */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div onClick={() => setShowFeedback(!showFeedback)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
            <h2 style={{ fontSize: 16, fontWeight: 600 }}>反馈与建议</h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14, transform: showFeedback ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
          </div>
          {showFeedback && <FeedbackSection />}
        </div>

        {/* About */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>关于 VibeLink</h2>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>VibeLink 是一个轻量级的网页版文件传输助手。所有内容端到端加密，支持文字、图片、文件传输，最大支持 1GB 文件。</p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 8 }}>Version 1.0.0 · 浏览器打开即用，无需安装</p>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>🔒 端到端加密 · 🌐 联网传输 · 📱💻 跨平台</p>
        </div>

        {/* Support — at bottom */}
        <SupportSection />
      </div>
    </Layout>
  );
}

function SupportSection() {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <div className="card" style={{ textAlign: 'center', padding: '16px 20px' }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>支持作者</h2>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        ☕ 这杯咖啡我请了，Bug 你继续修
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
        {[
          { src: '/收款码/微信.jpg', label: '微信' },
          { src: '/收款码/支付宝.jpg', label: '支付宝' },
        ].map((item) => (
          <div key={item.label} style={{ cursor: 'pointer', textAlign: 'center' }}
            onClick={() => setPreview(item.src)}>
            <img src={item.src} alt={item.label} style={{ width: 100, height: 100, borderRadius: 8, border: '1px solid var(--border)', objectFit: 'cover' }} />
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 4 }}>{item.label}</div>
          </div>
        ))}
      </div>
      {preview && (
        <div onClick={() => setPreview(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, cursor: 'pointer' }}>
          <img src={preview} alt="" style={{ maxWidth: '80vw', maxHeight: '80vh', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }} />
        </div>
      )}
    </div>
  );
}

function FeedbackSection() {
  const [msg, setMsg] = useState('');
  const [contact, setContact] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done'>('idle');
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [showList, setShowList] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [passErr, setPassErr] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msg.trim()) return;
    setStatus('sending');
    try {
      await api.post('/feedback', { message: msg, contact: contact || undefined });
      setStatus('done'); setMsg(''); setContact('');
      setTimeout(() => setStatus('idle'), 2000);
    } catch { setStatus('idle'); }
  };

  const handleViewFeedbacks = async () => {
    if (adminPass !== '551314') { setPassErr('密码错误'); return; }
    setPassErr('');
    try {
      const { data } = await api.get('/feedback');
      setFeedbacks(data.feedbacks || []);
      setShowList(true);
    } catch {}
  };

  return (
    <div style={{ marginTop: 16 }}>
      <form onSubmit={handleSubmit}>
        <div className="input-group">
          <label>反馈内容</label>
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="你的建议或遇到的问题..." rows={3}
            style={{ width: '100%', resize: 'vertical', padding: '10px 12px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 14, fontFamily: 'inherit', outline: 'none', minHeight: 60 }} />
        </div>
        <div className="input-group">
          <label>联系方式（选填）</label>
          <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="邮箱或微信，方便回复" />
        </div>
        <button type="submit" className="btn btn-primary" disabled={!msg.trim() || status !== 'idle'} style={{ padding: '8px 20px', fontSize: 13 }}>
          {status === 'done' ? '✅ 已提交' : status === 'sending' ? '提交中...' : '提交反馈'}
        </button>
      </form>

      {/* Admin view */}
      <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="password" value={adminPass} onChange={(e) => { setAdminPass(e.target.value); setPassErr(''); }}
            placeholder="管理员密码" onKeyDown={(e) => e.key === 'Enter' && handleViewFeedbacks()}
            style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 4, fontSize: 13, width: 120 }} />
          <button type="button" onClick={handleViewFeedbacks} className="btn btn-outline"
            style={{ padding: '6px 14px', fontSize: 12 }}>查看反馈</button>
          {passErr && <span style={{ fontSize: 12, color: 'var(--danger)' }}>{passErr}</span>}
        </div>

        {showList && (
          <div style={{ marginTop: 12 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>反馈列表 ({feedbacks.length})</h3>
            {feedbacks.length === 0 ? <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>暂无反馈</p> : (
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                {feedbacks.map((fb: any) => (
                  <div key={fb.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                    <div style={{ color: 'var(--text)', marginBottom: 4 }}>{fb.message}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: 11, display: 'flex', justifyContent: 'space-between' }}>
                      <span>{fb.contact || '匿名'}</span>
                      <span>{new Date(fb.created_at * 1000).toLocaleString('zh-CN')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
