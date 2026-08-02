import { useEffect, useState, useMemo } from 'react';
import { useChatStore } from '../store/chatStore';
import Layout from '../components/Layout';
import MessageBubble from '../components/MessageBubble';

export default function History() {
  const { messages, loadHistory, isLoadingHistory, hasMore, deleteMessage } = useChatStore();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'text' | 'image' | 'file'>('all');

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
          <h1 style={{ fontSize: 18, fontWeight: 600, marginBottom: 10 }}>传输记录</h1>
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

          {filtered.map((msg) => (
            <MessageBubble
              key={msg.id || msg.client_message_id}
              message={msg}
              onDelete={deleteMessage}
            />
          ))}

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
