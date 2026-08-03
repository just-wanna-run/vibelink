import { useEffect, useState, useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import Layout from '../components/Layout';
import MessageBubble, { formatDateHeader } from '../components/MessageBubble';
import api from '../services/api';

function getFileName(msg: any, i: number): string {
  const ts = `${Date.now()}_${i}`;
  if (msg.file_name) {
    const dot = msg.file_name.lastIndexOf('.');
    return dot > 0 ? `${msg.file_name.slice(0, dot)}_${ts}${msg.file_name.slice(dot)}` : `${msg.file_name}_${ts}`;
  }
  if (msg.type === 'image') {
    const ext = msg.content?.startsWith('data:image/png') ? 'png'
      : msg.content?.startsWith('data:image/gif') ? 'gif'
      : msg.content?.startsWith('data:image/webp') ? 'webp'
      : 'jpg';
    return `image_${ts}.${ext}`;
  }
  return `file_${ts}`;
}

export default function History() {
  const { messages, loadHistory, isLoadingHistory, hasMore, deleteMessage } = useChatStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'text' | 'image' | 'file'>('all');
  const [dateFilter, setDateFilter] = useState('');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 条记录吗？`)) return;
    try {
      await api.post('/messages/batch-delete', { ids: [...selected] });
      useChatStore.setState((s) => ({ messages: s.messages.filter((m) => !selected.has(m.id)) }));
      setSelected(new Set()); setSelectMode(false);
    } catch { alert('删除失败'); }
  };

  const handleBatchDownload = async () => {
    const selectedMsgs = messages.filter((m) => selected.has(m.id));
    const dl = selectedMsgs.filter((m) => (m.type === 'image' && m.content) || (m.type === 'file' && m.file_path));
    if (dl.length === 0) { alert('选中的消息中没有可下载的文件'); return; }
    try {
      const dirHandle = await (window as any).showDirectoryPicker();
      let saved = 0;
      for (let i = 0; i < dl.length; i++) {
        const msg = dl[i];
        try {
          let blob: Blob;
          if (msg.type === 'image' && msg.content) {
            blob = await (await fetch(msg.content)).blob();
          } else {
            const token = localStorage.getItem('vibelink_token') || sessionStorage.getItem('vibelink_token') || '';
            blob = await (await fetch(`/api/files/${encodeURIComponent(msg.file_path!)}`, { headers: { Authorization: `Bearer ${token}` } })).blob();
          }
          const fh = await dirHandle.getFileHandle(getFileName(msg, i), { create: true });
          const w = await fh.createWritable(); await w.write(blob); await w.close();
          saved++;
        } catch {}
      }
      setSelected(new Set()); setSelectMode(false);
      alert(`已保存 ${saved} 个文件`);
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      dl.forEach(async (msg, i) => {
        try {
          let blob: Blob;
          if (msg.type === 'image' && msg.content) { blob = await (await fetch(msg.content)).blob(); }
          else { const t = localStorage.getItem('vibelink_token') || sessionStorage.getItem('vibelink_token') || ''; blob = await (await fetch(`/api/files/${msg.file_path}`, { headers: { Authorization: `Bearer ${t}` } })).blob(); }
          const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = getFileName(msg, i); document.body.appendChild(a); a.click();
          setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
        } catch {}
      });
    }
  };

  useEffect(() => { if (messages.length === 0) loadHistory(); }, []);

  const filtered = useMemo(() => {
    let list = [...messages].reverse();
    if (filter !== 'all') list = list.filter((m) => m.type === filter);
    if (dateFilter) {
      list = list.filter((m) => {
        const ts = typeof m.created_at === 'string' ? new Date(m.created_at).getTime() : m.created_at * 1000;
        const msgDate = new Date(ts).toDateString();
        const filterDate = new Date(dateFilter).toDateString();
        return msgDate === filterDate;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((m) => (m.content && m.content.toLowerCase().includes(q)) || (m.file_name && m.file_name.toLowerCase().includes(q)));
    }
    return list;
  }, [messages, search, filter, dateFilter]);

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <header style={{ padding: '14px 20px', background: 'var(--white)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600 }}>传输记录</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {selectMode ? (
                <>
                  <button onClick={handleBatchDownload} disabled={selected.size === 0} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12, color: selected.size ? 'var(--primary)' : undefined, borderColor: selected.size ? 'var(--primary)' : undefined }}>下载({selected.size})</button>
                  <button onClick={handleBatchDelete} disabled={selected.size === 0} className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 12 }}>删除({selected.size})</button>
                  <button onClick={() => { setSelectMode(false); setSelected(new Set()); }} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}>取消</button>
                </>
              ) : (
                messages.length > 0 && (
                  <button onClick={() => setSelectMode(true)} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}>批量操作</button>
                )
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="text" placeholder="搜索内容或文件名..." value={search} onChange={(e) => setSearch(e.target.value)}
              style={{ flex: '1 1 120px', padding: '8px 14px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none', minWidth: 100 }} />
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}
              style={{ padding: '8px 12px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--white)', cursor: 'pointer', flexShrink: 0 }}>
              <option value="all">全部</option>
              <option value="text">文字</option>
              <option value="image">图片</option>
              <option value="file">文件</option>
            </select>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <span style={{ position: 'absolute', left: 10, fontSize: 14, color: 'var(--text-secondary)', pointerEvents: 'none', zIndex: 1 }}>日期</span>
              <input type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)}
                style={{ padding: '8px 12px 8px 50px', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--white)', cursor: 'pointer', color: dateFilter ? 'var(--text)' : 'transparent', width: 160 }} />
            </div>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {isLoadingHistory && messages.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>加载中...</div>}
          {filtered.length === 0 && !isLoadingHistory && <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>{search ? '没有匹配的记录' : '暂无传输记录'}</div>}
          {filtered.map((msg, i) => {
            const prev = i > 0 ? filtered[i - 1] : null;
            const prevDate = prev ? new Date((typeof prev.created_at === 'string' ? new Date(prev.created_at).getTime() : prev.created_at * 1000)).toDateString() : '';
            const thisTs = typeof msg.created_at === 'string' ? new Date(msg.created_at).getTime() : msg.created_at * 1000;
            const thisDate = new Date(thisTs).toDateString();
            const isSelected = selected.has(msg.id);
            return (
              <div key={msg.id || msg.client_message_id} style={{ position: 'relative' }}>
                {prevDate !== thisDate && <div style={{ textAlign: 'center', padding: '10px 0 6px', fontSize: 12, color: 'var(--text-secondary)' }}>{formatDateHeader(thisTs / 1000)}</div>}
                {selectMode && <div style={{ position: 'absolute', left: 8, top: '50%', zIndex: 2, transform: 'translateY(-50%)' }}><input type="checkbox" checked={isSelected} onChange={() => toggleSelect(msg.id)} style={{ width: 20, height: 20, accentColor: 'var(--primary)', cursor: 'pointer' }} /></div>}
                <div style={{ opacity: selectMode ? 0.7 : 1, pointerEvents: selectMode ? 'none' : 'auto' }}><MessageBubble message={msg} onDelete={deleteMessage} /></div>
              </div>
            );
          })}
          {hasMore && messages.length > 0 && <div style={{ textAlign: 'center', padding: 16 }}><button onClick={loadHistory} disabled={isLoadingHistory} className="btn btn-outline" style={{ fontSize: 13 }}>{isLoadingHistory ? '加载中...' : '加载更多'}</button></div>}
        </div>
      </div>
    </Layout>
  );
}
