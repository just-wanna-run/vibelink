import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
      await api.post('/auth/login', { username: user?.username, password: oldPassword });
      setMsg({ type: 'success', text: '密码验证成功（密码修改功能将在后续版本支持）' });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch { setMsg({ type: 'error', text: '原密码错误' }); }
  };

  return (
    <Layout>
      <div style={{ maxWidth: 860, margin: '0 auto', padding: 20, width: '100%' }}>
        <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 24 }}>设置</h1>

        {/* Account info */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 className="section-title">账号信息</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #5B9BD5, #4A8AC4)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fff', fontSize: 18, fontWeight: 700 }}>
              {(user?.username || '?')[0].toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user?.username || '未登录'}
                <ChangeUsernameButton />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1 }}>
                {user?.recoveryEmail || '未绑定邮箱'}
                <ChangeEmailButton />
              </div>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}><DeleteAccountButton /></div>
        </div>

        {/* Download mode */}
        <DownloadModeSetting />

        {/* Dark mode */}
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 className="section-title">夜间模式</h2>
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
            <h2 className="section-title">修改密码</h2>
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
            <h2 className="section-title">反馈与建议</h2>
            <span style={{ color: 'var(--text-secondary)', fontSize: 14, transform: showFeedback ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
          </div>
          {showFeedback && <FeedbackSection />}
        </div>

        {/* About */}
        <div className="card" style={{ marginBottom: 20 }}>
          <h2 className="section-title">关于 VibeLink</h2>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
            手机和电脑之间互传文件总是不方便？VibeLink 就是你的随身传输助手。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: '🔓', title: '独立账号\n随时可用', desc: '其他工具常因安全因素限制登录，支持账号登录 100% 可用', color: '#5B9BD5' },
              { icon: '🚀', title: '不限大小\n跨网即传', desc: '其他工具限制 100MB 且需同一网络，支持 1GB 任意网络', color: '#4CAF50' },
              { icon: '📱', title: '全平台\n不挑系统', desc: 'iOS / 安卓 / Windows / Mac / Linux 互传', color: '#FF9800' },
              { icon: '🔐', title: '端到端加密\n隐私安全', desc: '服务器也无法解密你的内容，真正安全', color: '#9C27B0' },
              { icon: '🖼️', title: '图片原画质\n不压缩', desc: '原样传输，画质无损，不缩图', color: '#E91E63' },
              { icon: '🌐', title: '纯网页\n无需安装', desc: '浏览器打开就能传，可添加桌面快捷方式', color: '#00BCD4' },
            ].map((item) => (
              <div key={item.icon} style={{
                background: 'var(--bg)', borderRadius: 10, padding: '10px 12px',
                border: '1px solid var(--border)', position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, width: '100%', height: 3,
                  background: item.color,
                }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                    background: `${item.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13,
                  }}>{item.icon}</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3, whiteSpace: 'pre-line' }}>{item.title}</div>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 14 }}>💰 完全免费，源码开放</p>
        </div>

        {/* Admin stats */}
        <AdminSection />

        {/* Support — at bottom */}
        <SupportSection />
      </div>
    </Layout>
  );
}

function downloadDirStore() {
  const DB = 'vibelink_fs';
  const STORE = 'handles';
  return {
    async get(): Promise<any> {
      return new Promise((resolve, reject) => {
        const r = indexedDB.open(DB);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get('dir');
          req.onsuccess = () => resolve(req.result?.handle || null);
          req.onerror = reject;
        };
        r.onerror = reject;
      });
    },
    async set(handle: any): Promise<void> {
      return new Promise((resolve, reject) => {
        const r = indexedDB.open(DB);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put({ name: handle.name, handle }, 'dir');
          tx.oncomplete = () => resolve();
          tx.onerror = reject;
        };
        r.onerror = reject;
      });
    },
    async getDirName(): Promise<string> {
      return new Promise((resolve) => {
        const r = indexedDB.open(DB);
        r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE); };
        r.onsuccess = () => {
          const db = r.result;
          const tx = db.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get('dir');
          req.onsuccess = () => resolve(req.result?.name || '');
          req.onerror = () => resolve('');
        };
        r.onerror = () => resolve('');
      });
    },
  };
}

export async function getDefaultDir(): Promise<any> {
  const handle = await downloadDirStore().get();
  if (!handle) return null;
  // Verify permission — request it if needed
  const opts: any = { mode: 'readwrite' };
  try {
    if ((await handle.queryPermission(opts)) === 'granted') return handle;
    if ((await handle.requestPermission(opts)) === 'granted') return handle;
    return null;
  } catch { return null; }
}

function DownloadModeSetting() {
  const DOWNLOAD_KEY = 'vibelink_download_mode';
  const [mode, setMode] = useState(localStorage.getItem(DOWNLOAD_KEY) || 'defaultDir');
  const [showTip, setShowTip] = useState(false);
  const [dirName, setDirName] = useState('');

  useEffect(() => { downloadDirStore().getDirName().then(setDirName); }, []);

  const handlePickDir = async () => {
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      await downloadDirStore().set(dirHandle);
      setDirName(dirHandle.name);
    } catch {}
  };

  return (
    <div className="card desktop-only" style={{ marginBottom: 20 }}>
      <h2 className="section-title">下载方式</h2>
      <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
        当前：<strong style={{ color: 'var(--primary)' }}>{mode === 'picker' ? '选文件夹保存' : mode === 'defaultDir' ? '保存到默认目录' : '浏览器直接下载'}</strong>
      </p>
      <div style={{ display: 'flex', background: 'var(--border)', borderRadius: 10, padding: 3, gap: 2, marginBottom: 8 }}>
        <button onClick={() => { localStorage.setItem(DOWNLOAD_KEY, 'picker'); setMode('picker'); }}
          style={{
            flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: mode === 'picker' ? 'var(--primary)' : 'transparent',
            color: mode === 'picker' ? '#fff' : 'var(--text-secondary)',
            fontWeight: mode === 'picker' ? 600 : 400, transition: 'all 0.2s',
          }}>选文件夹</button>
        <button onClick={() => { localStorage.setItem(DOWNLOAD_KEY, 'defaultDir'); setMode('defaultDir'); }}
          style={{
            flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: mode === 'defaultDir' ? 'var(--primary)' : 'transparent',
            color: mode === 'defaultDir' ? '#fff' : 'var(--text-secondary)',
            fontWeight: mode === 'defaultDir' ? 600 : 400, transition: 'all 0.2s',
          }}>默认目录</button>
        <button onClick={() => { localStorage.setItem(DOWNLOAD_KEY, 'browser'); setMode('browser'); }}
          style={{
            flex: 1, padding: '8px 12px', fontSize: 12, borderRadius: 8, border: 'none', cursor: 'pointer',
            background: mode === 'browser' ? 'var(--primary)' : 'transparent',
            color: mode === 'browser' ? '#fff' : 'var(--text-secondary)',
            fontWeight: mode === 'browser' ? 600 : 400, transition: 'all 0.2s',
          }}>浏览器下载</button>
      </div>
      {mode === 'defaultDir' && (
        <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {dirName ? (
            <>默认下载目录：{dirName} <button onClick={handlePickDir} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, padding: 0, marginLeft: 8 }}>更改</button></>
          ) : (
            <button onClick={handlePickDir} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 12, padding: 0 }}>请先设置默认下载目录</button>
          )}
        </p>
      )}
    </div>
  );
}

function DeleteAccountButton() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [pwd, setPwd] = useState('');
  const [msg, setMsg] = useState('');

  const handleDelete = async () => {
    if (!pwd) { setMsg('请输入密码'); return; }
    try {
      await api.post('/auth/delete-account', { username: user?.username, password: pwd });
      await logout();
      navigate('/login', { replace: true });
    } catch (e: any) { setMsg(e.response?.data?.error || '注销失败'); }
  };

  return (
    <>
      <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>· <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 11, padding: 0, opacity: 0.7 }}>注销</button></span>
      {open && (
        <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--white)', borderRadius: 12, padding: 24, width: 340, maxWidth: '90vw', boxShadow: '0 8px 30px rgba(0,0,0,0.15)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>注销账号</h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>此操作不可恢复，所有数据将被永久删除。</p>
            <input type="password" placeholder="输入密码确认" value={pwd} onChange={(e) => setPwd(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1.5px solid var(--border)', borderRadius: 8, fontSize: 14, marginBottom: 12, outline: 'none' }} />
            {msg && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{msg}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => { setOpen(false); setPwd(''); setMsg(''); }} className="btn btn-outline" style={{ fontSize: 13, padding: '8px 20px' }}>取消</button>
              <button onClick={handleDelete} className="btn btn-danger" style={{ fontSize: 13, padding: '8px 20px' }}>确认注销</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function AdminSection() {
  const [expanded, setExpanded] = useState(false);
  const [pwd, setPwd] = useState('');
  const [stats, setStats] = useState<any>(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchStats = async () => {
    if (!pwd.trim()) return;
    setLoading(true); setErr('');
    try {
      const { data } = await api.get('/admin/stats', { headers: { 'x-admin-pwd': pwd.trim() } });
      setStats(data);
    } catch (e: any) {
      setErr(e?.response?.status === 403 ? '密码错误' : '获取失败');
    }
    setLoading(false);
  };

  return (
    <div className="card" style={{ marginBottom: 20 }}>
      <div onClick={() => setExpanded(!expanded)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
        <h2 className="section-title" style={{ marginBottom: 0 }}>管理统计</h2>
        <span style={{ color: 'var(--text-secondary)', fontSize: 14, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
      </div>
      {expanded && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input type="password" value={pwd} onChange={(e) => { setPwd(e.target.value); setErr(''); }}
              placeholder="管理员密码" onKeyDown={(e) => e.key === 'Enter' && fetchStats()}
              style={{ padding: '6px 10px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 13, width: 130 }} />
            <button onClick={fetchStats} disabled={loading} className="btn btn-outline"
              style={{ padding: '6px 14px', fontSize: 12 }}>{loading ? '加载中...' : '查看统计'}</button>
          </div>
          {err && <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{err}</p>}
          {stats && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{stats.totalUsers}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>注册用户</div>
              </div>
              <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{stats.totalMessages}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>消息总数</div>
              </div>
              <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{stats.todayMessages}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>今日消息</div>
              </div>
              <div style={{ background: 'var(--primary-light)', borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--primary)' }}>{stats.weekMessages}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>近7天消息</div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChangeUsernameButton() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [pwd, setPwd] = useState('');
  const [msg, setMsg] = useState('');

  const handleSave = async () => {
    if (!name.trim() || name.trim().length < 2) { setMsg('用户名至少2个字符'); return; }
    if (!pwd) { setMsg('请输入密码确认'); return; }
    try {
      await api.post('/auth/change-username', { username: user?.username, password: pwd, newUsername: name.trim() });
      setMsg('用户名已更新'); setOpen(false);
      window.location.reload();
    } catch (e: any) { setMsg(e.response?.data?.error || '更新失败'); }
  };

  if (open) {
    return (
      <span style={{ marginLeft: 8 }}>
        <input type="text" placeholder="新用户名" value={name} onChange={(e) => setName(e.target.value)}
          style={{ padding: '4px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, width: 110 }} />
        <input type="password" placeholder="密码" value={pwd} onChange={(e) => setPwd(e.target.value)}
          style={{ padding: '4px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, width: 90, marginLeft: 4 }} />
        <button onClick={handleSave} style={{ padding: '4px 10px', fontSize: 11, marginLeft: 4, border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}>保存</button>
        <button onClick={() => { setOpen(false); setMsg(''); }} style={{ padding: '4px 6px', fontSize: 11, marginLeft: 4, border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
        {msg && <span style={{ fontSize: 11, marginLeft: 4, color: msg.includes('更新') ? 'var(--success)' : 'var(--danger)' }}>{msg}</span>}
      </span>
    );
  }
  return <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, fontWeight: 400 }}>· <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, padding: 0 }}>修改</button></span>;
}

function ChangeEmailButton() {
  const { user } = useAuthStore();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (countdown > 0) {
      const t = setInterval(() => setCountdown((c) => (c <= 1 ? 0 : c - 1)), 1000);
      return () => clearInterval(t);
    }
  }, [countdown]);

  const handleSendCode = async () => {
    if (!email.trim()) { setMsg('请输入新邮箱'); return; }
    if (!pwd) { setMsg('请输入密码'); return; }
    if (countdown > 0) return;
    setMsg('');
    try {
      const { data } = await api.post('/auth/send-change-email-code', { username: user?.username, password: pwd, newEmail: email.trim() });
      if (!data.sent && data.code) { alert(`验证码：${data.code}\n（已自动复制到剪贴板）`); navigator.clipboard?.writeText(data.code); }
      setCountdown(60);
    } catch (e: any) { setMsg(e.response?.data?.error || '发送失败'); }
  };

  const handleSave = async () => {
    if (!code.trim()) { setMsg('请输入验证码'); return; }
    try {
      await api.post('/auth/change-email', { username: user?.username, password: pwd, newEmail: email.trim(), code: code.trim() });
      setMsg('邮箱已更新'); setOpen(false);
      window.location.reload();
    } catch (e: any) { setMsg(e.response?.data?.error || '更新失败'); }
  };

  if (open) {
    return (
      <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="email" placeholder="新邮箱" value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ padding: '4px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, width: 150 }} />
        <input type="password" placeholder="密码" value={pwd} onChange={(e) => setPwd(e.target.value)}
          style={{ padding: '4px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, width: 80 }} />
        <button onClick={handleSendCode} disabled={countdown > 0}
          style={{ padding: '4px 10px', fontSize: 11, border: '1.5px solid var(--primary)', borderRadius: 6, cursor: countdown > 0 ? 'default' : 'pointer', background: countdown > 0 ? 'var(--border)' : 'var(--white)', color: countdown > 0 ? 'var(--text-secondary)' : 'var(--primary)', whiteSpace: 'nowrap' }}>
          {countdown > 0 ? `${countdown}s` : '发验证码'}
        </button>
        <input type="text" placeholder="验证码" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6}
          style={{ padding: '4px 8px', border: '1.5px solid var(--border)', borderRadius: 6, fontSize: 12, width: 70 }} />
        <button onClick={handleSave} style={{ padding: '4px 10px', fontSize: 11, border: 'none', borderRadius: 6, background: 'var(--primary)', color: '#fff', cursor: 'pointer' }}>保存</button>
        <button onClick={() => { setOpen(false); setMsg(''); }} style={{ padding: '4px 6px', fontSize: 11, border: 'none', borderRadius: 6, background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}>取消</button>
        {msg && <span style={{ fontSize: 11, color: msg.includes('更新') ? 'var(--success)' : 'var(--danger)' }}>{msg}</span>}
      </div>
    );
  }
  return <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 8, fontWeight: 400 }}>· <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, padding: 0 }}>修改</button></span>;
}

function SupportSection() {
  const [preview, setPreview] = useState<string | null>(null);
  return (
    <div className="card" style={{ textAlign: 'center', padding: '16px 20px', marginBottom: 20 }}>
      <h2 className="section-title" style={{ textAlign: 'left' }}>支持作者</h2>
      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
        🍭 这根棒棒糖我请了，Bug 你继续修
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
