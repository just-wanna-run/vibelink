import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore, markLocallyDeleted } from '../store/chatStore';
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
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // Global drag-and-drop — prevent browser from opening files in new tab
  useEffect(() => {
    const onDragOver = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(true); };
    const onDragLeave = (e: DragEvent) => { e.preventDefault(); e.stopPropagation(); setDragOver(false); };
    const onDrop = (e: DragEvent) => {
      e.preventDefault(); e.stopPropagation(); setDragOver(false);
      if (e.dataTransfer?.files?.length) handleSendFiles(e.dataTransfer.files);
    };
    document.addEventListener('dragover', onDragOver);
    document.addEventListener('dragleave', onDragLeave);
    document.addEventListener('drop', onDrop);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      document.removeEventListener('dragleave', onDragLeave);
      document.removeEventListener('drop', onDrop);
    };
  }, []);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const getFileName = (msg: import('../store/chatStore').Message, index: number): string => {
    const ts = `${Date.now()}_${index}`;
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
  };

  const handleBatchDownload = async () => {
    const selectedMsgs = messages.filter((m) => selected.has(m.id));
    const downloadable = selectedMsgs.filter((m) =>
      (m.type === 'image' && m.content) || (m.type === 'file' && m.file_path)
    );
    if (downloadable.length === 0) {
      alert('选中的消息中没有可下载的文件');
      return;
    }

    const fetchBlob = async (msg: typeof downloadable[0]): Promise<Blob> => {
      if (msg.type === 'image' && msg.content) {
        return (await fetch(msg.content)).blob();
      }
      const token = localStorage.getItem('vibelink_token') || sessionStorage.getItem('vibelink_token') || '';
      return (await fetch(`/api/files/${encodeURIComponent(msg.file_path!)}`, { headers: { Authorization: `Bearer ${token}` } })).blob();
    };

    // Try File System Access API (choose folder)
    let triedApi = false;
    try {
      const dirHandle = await (window as any).showDirectoryPicker({ startIn: 'downloads' });
      triedApi = true;
      setDownloadProgress({ current: 0, total: downloadable.length });
      let saved = 0;
      for (let i = 0; i < downloadable.length; i++) {
        try {
          const blob = await fetchBlob(downloadable[i]);
          const fh = await dirHandle.getFileHandle(getFileName(downloadable[i], i), { create: true });
          const w = await fh.createWritable(); await w.write(blob); await w.close();
          saved++;
        } catch {}
        setDownloadProgress({ current: i + 1, total: downloadable.length });
      }
      setDownloadProgress(null);
      setSelected(new Set()); setSelectMode(false);
      if (saved > 0) alert(`已保存 ${saved} 个文件`);
      return;
    } catch (err: any) {
      if (err?.name === 'AbortError') { return; }
    }

    // Fallback: browser download
    setDownloadProgress({ current: 0, total: downloadable.length });
    let saved = 0;
    for (let i = 0; i < downloadable.length; i++) {
      try {
        const blob = await fetchBlob(downloadable[i]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = getFileName(downloadable[i], i); a.style.display = 'none';
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        saved++;
      } catch {}
      setDownloadProgress({ current: i + 1, total: downloadable.length });
      if (i < downloadable.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    setDownloadProgress(null);
    setSelected(new Set()); setSelectMode(false);
    if (saved > 0) alert(`已保存 ${saved} 个文件`);
  };

  const handleBatchDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`确定删除选中的 ${selected.size} 条消息吗？`)) return;
    // Mark as locally deleted to prevent poll re-add
    const ids = [...selected];
    const clientMsgIds = messages.filter((m) => selected.has(m.id)).map((m) => m.client_message_id).filter(Boolean);
    markLocallyDeleted(clientMsgIds);
    try {
      await api.post('/messages/batch-delete', { ids });
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

  // Track previous newest message for auto-scroll detection
  const prevNewestRef = useRef<number>(0);

  // Load initial history, then scroll to bottom
  useEffect(() => {
    loadHistory().then(() => {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
      }, 100);
    });
  }, []);

  // Auto-scroll to bottom when new messages arrive (only if user is near bottom)
  useEffect(() => {
    if (messages.length === 0) return;
    const newest = messages[messages.length - 1].created_at;
    if (newest > prevNewestRef.current && prevNewestRef.current > 0) {
      const container = messagesContainerRef.current;
      if (container) {
        const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 200;
        if (nearBottom) {
          setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
          }, 50);
        }
      }
    }
    prevNewestRef.current = newest;
  }, [messages]);

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
        width: '100%', boxSizing: 'border-box', position: 'relative',
      }}>
        {/* Drag overlay */}
        {dragOver && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 100,
            background: 'rgba(91,155,213,0.15)', border: '3px dashed var(--primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 12, margin: 8, pointerEvents: 'none',
          }}>
            <div style={{
              background: 'var(--white)', padding: '20px 40px', borderRadius: 12,
              boxShadow: '0 4px 20px rgba(0,0,0,0.15)', textAlign: 'center',
            }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📥</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--primary)' }}>释放文件即可发送</div>
            </div>
          </div>
        )}

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
        {downloadProgress && (
          <div style={{ background: 'var(--primary-light)', padding: '6px 20px', fontSize: 12, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>📥 {downloadProgress.current}/{downloadProgress.total}</span>
            <div style={{ flex: 1, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
              <div style={{ height: '100%', background: 'var(--primary)', borderRadius: 2, width: `${(downloadProgress.current / downloadProgress.total) * 100}%`, transition: 'width 0.3s' }} />
            </div>
          </div>
        )}
        {isLoadingHistory && (
          <div style={{ textAlign: 'center', padding: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
            加载历史记录...
          </div>
        )}

        {!hasMore && messages.length > 0 && !isLoadingHistory && (
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
            <div key={msg.id || msg.client_message_id} style={{ position: 'relative', cursor: selectMode ? 'pointer' : undefined }}
              onClick={selectMode ? () => toggleSelect(msg.id) : undefined}>
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
