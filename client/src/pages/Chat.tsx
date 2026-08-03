import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import api from '../services/api';
import Layout from '../components/Layout';
import MessageBubble, { formatDateHeader } from '../components/MessageBubble';
import InputArea from '../components/InputArea';

export default function Chat() {
  const { user } = useAuthStore();
  const {
    messages, isLoadingHistory, hasMore, myDeviceId,
    sendText, loadHistory, deleteMessage, pollNewMessages, addMessage,
  } = useChatStore();

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBatchDownload = () => {
    const selectedMsgs = messages.filter((m) => selected.has(m.id));
    const downloadable = selectedMsgs.filter((m) =>
      (m.type === 'image' && m.content) || (m.type === 'file' && m.file_path)
    );
    if (downloadable.length === 0) {
      alert('选中的消息中没有可下载的文件');
      return;
    }
    downloadable.forEach((msg, i) => {
      setTimeout(() => {
        if (msg.type === 'image' && msg.content) {
          const a = document.createElement('a');
          a.href = msg.content;
          a.download = msg.file_name || `image_${Date.now()}.jpg`;
          a.click();
        } else if (msg.file_path) {
          const a = document.createElement('a');
          a.href = `/api/files/${encodeURIComponent(msg.file_path)}`;
          a.download = msg.file_name || `file_${i}`;
          a.click();
        }
      }, i * 300);
    });
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 条消息吗？`)) return;
    try {
      await api.post('/messages/batch-delete', { ids: [...selected] });
      useChatStore.setState((s) => ({ messages: s.messages.filter((m) => !selected.has(m.id)) }));
      setSelected(new Set());
      setSelectMode(false);
    } catch { alert('删除失败'); }
  };

  // Polling for new messages (2s interval, replaces WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      pollNewMessages();
    }, 2000);
    return () => clearInterval(interval);
  }, [pollNewMessages]);

  // Track previous message count for auto-scroll detection
  const prevCountRef = useRef(messages.length);

  // Load initial history, then scroll to bottom
  useEffect(() => {
    loadHistory().then(() => {
      // Scroll to bottom after initial load
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    });
  }, []);

  // Auto-scroll to bottom when a new message is added
  useEffect(() => {
    const isNewMessage = messages.length > prevCountRef.current;
    prevCountRef.current = messages.length;

    if (isNewMessage && messages.length > 0) {
      // Check if the new message is recent (within last 2 seconds — i.e., live)
      const lastMsg = messages[messages.length - 1];
      const now = Math.floor(Date.now() / 1000);
      if (now - lastMsg.created_at < 5) {
        setTimeout(() => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    }
  }, [messages.length]);

  // Scroll handling for loading more history
  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container || isLoadingHistory || !hasMore) return;
    if (container.scrollTop < 50) {
      loadHistory();
    }
  };

  // Send multiple files/images
  const handleSendFiles = async (files: FileList | File[]) => {
    for (const file of Array.from(files)) {
      handleSendFile(file);
    }
  };

  // Send single file/image via HTTP upload
  const handleSendFile = async (file: File) => {
    const isImage = file.type.startsWith('image/');
    const clientId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

    // For images, generate local preview
    let localPreview: string | undefined;
    if (isImage) {
      localPreview = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => resolve(undefined);
        reader.readAsDataURL(file);
      });
    }

    // Show optimistic message
    const optimistic: import('../store/chatStore').Message = {
      id: clientId,
      user_id: '',
      from_device: myDeviceId,
      type: isImage ? 'image' : 'file',
      content: localPreview || null,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      file_path: null,
      encrypted_key: null,
      iv: null,
      client_message_id: clientId,
      created_at: Math.floor(Date.now() / 1000),
      pending: true,
    };
    addMessage(optimistic);

    try {
      let responseData: any;

      if (isImage && localPreview) {
        // Images: send as JSON (base64 only, one request, smaller)
        const res = await api.post('/messages/send', {
          type: 'image',
          content: localPreview,
          clientMessageId: clientId,
        }, { timeout: 60000 });
        responseData = res.data;
      } else {
        // Documents/files: send as multipart form
        const fd = new FormData();
        fd.append('type', 'file');
        fd.append('clientMessageId', clientId);
        fd.append('file', file);
        const res = await api.post('/messages/send', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 120000,
        });
        responseData = res.data;
      }

      if (responseData.message && !responseData.duplicate) {
        setOptimisticConfirmed(clientId, { ...responseData.message, content: localPreview || responseData.message.content });
      }
    } catch (err: any) {
      console.error('[SendFile] Failed:', err);
      setOptimisticFailed(clientId);
      const msg = err.response?.data?.error || err.message || '发送失败，请重试';
      alert(msg);
    }
  };

  // Helper: replace optimistic with confirmed message
  const setOptimisticConfirmed = (clientId: string, confirmed: import('../store/chatStore').Message) => {
    useChatStore.setState((s) => ({
      messages: s.messages.map((m) =>
        m.client_message_id === clientId ? { ...confirmed, pending: false } : m
      ),
    }));
  };

  // Helper: mark optimistic as failed
  const setOptimisticFailed = (clientId: string) => {
    useChatStore.setState((s) => ({
      messages: s.messages.map((m) =>
        m.client_message_id === clientId ? { ...m, pending: false, file_name: '[发送失败] ' + (m.file_name || '') } : m
      ),
    }));
  };

  if (!user) return null;

  return (
    <Layout>
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        width: '100%', boxSizing: 'border-box',
      }}>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {isLoadingHistory && (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
            加载历史记录...
          </div>
        )}

        {!hasMore && messages.length > 0 && (
          <div style={{ textAlign: 'center', padding: 12, color: 'var(--text-secondary)', fontSize: 12 }}>
            — 已加载全部记录 —
          </div>
        )}

        {messages.length === 0 && !isLoadingHistory && (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-secondary)', flexDirection: 'column', gap: 8,
          }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" style={{ opacity: 0.5 }}>
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
            <span style={{ fontSize: 14 }}>开始发送你的第一条消息吧</span>
            <span style={{ fontSize: 12 }}>另一台设备登录同一账号即可实时同步</span>
          </div>
        )}

        {messages.map((msg, i) => {
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const prevDate = prevMsg ? new Date(prevMsg.created_at * 1000).toDateString() : '';
          const thisDate = new Date(msg.created_at * 1000).toDateString();
          const gapSeconds = prevMsg ? msg.created_at - prevMsg.created_at : Infinity;
          const showHeader = !prevMsg || prevDate !== thisDate || gapSeconds > 60;
          const isSelected = selected.has(msg.id);

          return (
            <div key={msg.id || msg.client_message_id} style={{ position: 'relative' }}>
              {showHeader && (
                <div style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
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

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <InputArea
        onSendText={sendText}
        onSendFiles={handleSendFiles}
        selectMode={selectMode}
        selectedCount={selected.size}
        onToggleSelectMode={() => { setSelectMode(!selectMode); setSelected(new Set()); }}
        onBatchDelete={handleBatchDelete}
        onBatchDownload={handleBatchDownload}
        hasMessages={messages.length > 0}
      />
      </div>
    </Layout>
  );
}
