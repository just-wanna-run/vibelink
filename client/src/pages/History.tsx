import { useEffect, useState, useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import Layout from '../components/Layout';
import MessageBubble, { formatDateHeader } from '../components/MessageBubble';
import api from '../services/api';

export default function History() {
  const { messages, loadHistory, isLoadingHistory, hasMore, deleteMessage } = useChatStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'text' | 'image' | 'file'>('all');
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 条记录吗？`)) return;
    try {
      await api.post('/messages/batch-delete', { ids: [...selected] });
      useChatStore.setState((s) => ({ messages: s.messages.filter((m) => !selected.has(m.id)) }));
      setSelected(new Set());
      setSelectMode(false);
    } catch { alert('删除失败'); }
  };

  const handleClearAll = async () => {
    if (!confirm('确定要删除所有传输记录吗？此操作不可撤销。')) return;
    try {
      await api.delete('/messages/all');
      useChatStore.setState({ messages: [] });
    } catch { alert('清空失败'); }
  };

  useEffect(() => {
    if (messages.length === 0) {
      loadHistory();
    }
  }, []);

  const filtered = useMemo(() => {
    let list = [...messages].reverse(); // newest first
    if (filter !== 'all') {
      list = list.filter((m) => m.type === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          (m.content && m.content.toLowerCase().includes(q)) ||
          (m.file_name && m.file_name.toLowerCase().includes(q)),
      );
    }
    return list;
  }, [messages, search, filter]);

  return (
    <Layout>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <header style={{
          padding: '14px 20px', background: 'var(--white)',
          borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <h1 style={{ fontSize: 18, fontWeight: 600 }}>传输记录</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              {messages.length > 0 && !selectMode && (
                <button onClick={() => setSelectMode(true)} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}>选择</button>
              )}
              {selectMode && (
                <>
                  <button onClick={() => { setSelectMode(false); setSelected(new Set()); }} className="btn btn-outline" style={{ padding: '6px 14px', fontSize: 12 }}>取消</button>
                  <button onClick={handleBatchDelete} disabled={selected.size === 0} className="btn btn-danger" style={{ padding: '6px 14px', fontSize: 12 }}>删除({selected.size})</button>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="text"
              placeholder="搜索内容或文件名..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                flex: 1, padding: '8px 14px', border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: 14, outline: 'none',
              }}
            />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as any)}
              style={{
                padding: '8px 12px', border: '1.5px solid var(--border)',
                borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'var(--white)',
                cursor: 'pointer',
              }}
            >
              <option value="all">全部</option>
              <option value="text">文字</option>
              <option value="image">图片</option>
              <option value="file">文件</option>
            </select>
          </div>
        </header>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
          {isLoadingHistory && messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
              加载中...
            </div>
          )}

          {filtered.length === 0 && !isLoadingHistory && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
              {search ? '没有匹配的记录' : '暂无传输记录'}
            </div>
          )}

          {filtered.map((msg, i) => {
            const prev = i > 0 ? filtered[i - 1] : null;
            const prevDate = prev ? new Date(prev.created_at * 1000).toDateString() : '';
            const thisDate = new Date(msg.created_at * 1000).toDateString();
            const isSelected = selected.has(msg.id);
            return (
              <div key={msg.id || msg.client_message_id} style={{ position: 'relative' }}>
                {prevDate !== thisDate && (
                  <div style={{ textAlign: 'center', padding: '10px 0 6px', fontSize: 12, color: 'var(--text-secondary)' }}>
                    {formatDateHeader(msg.created_at)}
                  </div>
                )}
                {selectMode && (
                  <div style={{ position: 'absolute', left: 8, top: '50%', zIndex: 2, transform: 'translateY(-50%)' }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(msg.id)}
                      style={{ width: 20, height: 20, accentColor: 'var(--primary)', cursor: 'pointer' }} />
                  </div>
                )}
                <div style={{ opacity: selectMode ? 0.7 : 1, pointerEvents: selectMode ? 'none' : 'auto' }}>
                  <MessageBubble message={msg} onDelete={deleteMessage} />
                </div>
              </div>
            );
          })}

          {hasMore && (
            <div style={{ textAlign: 'center', padding: 16 }}>
              <button
                onClick={loadHistory}
                disabled={isLoadingHistory}
                className="btn btn-outline"
                style={{ fontSize: 13 }}
              >
                {isLoadingHistory ? '加载中...' : '加载更多'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
