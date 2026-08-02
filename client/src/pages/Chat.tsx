import { useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { initWebRTCReceiver, sendFileViaWebRTC } from '../services/webrtc';
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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // Polling for new messages (2s interval, replaces WebSocket)
  useEffect(() => {
    const interval = setInterval(() => {
      pollNewMessages();
    }, 2000);
    return () => clearInterval(interval);
  }, [pollNewMessages]);

  // WebRTC receiver for P2P large files
  useEffect(() => {
    initWebRTCReceiver();
  }, []);

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

  // Send image as base64
  const handleSendImage = async (file: File) => {
    // For now, read as base64 data URL and send as content
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;

      // Upload via FormData to preserve in file storage
      const formData = new FormData();
      formData.append('type', 'image');
      formData.append('clientMessageId', `img_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
      formData.append('content', base64);
      formData.append('file', file);

      try {
        const { data } = await api.post('/messages/send', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (!data.duplicate) {
          addMessage(data.message);
        }
      } catch {
        // silently fail, message was addable optimistically but we skip that for images
      }
    };
    reader.readAsDataURL(file);
  };

  // Send file — small files via HTTP, large files (>10MB) via WebRTC P2P
  const handleSendFile = async (file: File) => {
    const LARGE_FILE_THRESHOLD = 10 * 1024 * 1024; // 10MB

    if (file.size > LARGE_FILE_THRESHOLD) {
      // Use WebRTC P2P for large files
      const clientId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      const optimistic: import('../store/chatStore').Message = {
        id: clientId,
        user_id: '',
        from_device: myDeviceId,
        type: 'file',
        content: null,
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
        await sendFileViaWebRTC(file);
        // Mark as sent (remove pending)
        // Note: the receiver will get the file directly, no server message needed
        setOptimisticSent(clientId);
      } catch {
        setOptimisticFailed(clientId);
      }
      return;
    }

    // Small file: HTTP upload
    const formData = new FormData();
    formData.append('type', 'file');
    formData.append('clientMessageId', `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`);
    formData.append('file', file);

    try {
      const { data } = await api.post('/messages/send', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (!data.duplicate) {
        addMessage(data.message);
      }
    } catch {
      // handle error
    }
  };

  // Helpers for optimistic updates
  const setOptimisticSent = (clientId: string) => {
    useChatStore.setState((s) => ({
      messages: s.messages.map((m) =>
        m.client_message_id === clientId ? { ...m, pending: false } : m
      ),
    }));
  };

  const setOptimisticFailed = (clientId: string) => {
    useChatStore.setState((s) => ({
      messages: s.messages.map((m) =>
        m.client_message_id === clientId ? { ...m, pending: false, file_name: '[P2P发送失败] ' + (m.file_name || '') } : m
      ),
    }));
  };

  if (!user) return null;

  return (
    <Layout>
      <div style={{
        display: 'flex', flexDirection: 'column', height: '100%',
        maxWidth: 800, margin: '0 auto', width: '100%',
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
            <span style={{ fontSize: 12 }}>在同一账号的另一台设备登录即可实时同步</span>
          </div>
        )}

        {messages.map((msg, i) => {
          // Grouping logic: show time header only for first message,
          // or when gap from previous > 60 seconds, or when date changes
          const prevMsg = i > 0 ? messages[i - 1] : null;
          const prevDate = prevMsg ? new Date(prevMsg.created_at * 1000).toDateString() : '';
          const thisDate = new Date(msg.created_at * 1000).toDateString();
          const gapSeconds = prevMsg ? msg.created_at - prevMsg.created_at : Infinity;
          const showHeader = !prevMsg || prevDate !== thisDate || gapSeconds > 60;

          return (
            <div key={msg.id || msg.client_message_id}>
              {showHeader && (
                <div style={{
                  textAlign: 'center',
                  padding: '8px 0',
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                }}>
                  {formatDateHeader(msg.created_at)}
                </div>
              )}
              <MessageBubble
                message={msg}
                onDelete={deleteMessage}
              />
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <InputArea
        onSendText={sendText}
        onSendImage={handleSendImage}
        onSendFile={handleSendFile}
      />
      </div>
    </Layout>
  );
}
