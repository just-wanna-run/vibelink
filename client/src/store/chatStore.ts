import { create } from 'zustand';
import api from '../services/api';
import { encryptContent, decryptContent } from './encryptionStore';

// Supabase returns ISO timestamps, convert to Unix epoch for consistency
function fixMessage(msg: any) {
  if (msg && msg.created_at != null && typeof msg.created_at !== 'number') {
    const t = new Date(msg.created_at).getTime();
    if (!isNaN(t)) {
      msg.created_at = Math.floor(t / 1000);
    } else {
      msg.created_at = Math.floor(Date.now() / 1000);
    }
  }
  return msg;
}

export interface Message {
  id: string;
  user_id: string;
  from_device: string;
  type: 'text' | 'image' | 'file';
  content: string | null;
  file_name: string | null;
  file_size: number | null;
  file_type: string | null;
  file_path: string | null;
  encrypted_key: string | null;
  iv: string | null;
  client_message_id: string;
  created_at: number;
  pending?: boolean;   // optimistic local message
}

function generateClientId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

interface ChatState {
  messages: Message[];
  isLoadingHistory: boolean;
  hasMore: boolean;
  myDeviceId: string;
  selectedCategoryId: string | null;

  // Actions
  addMessage: (msg: Message) => void;
  sendText: (text: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  pollNewMessages: () => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  setSelectedCategoryId: (id: string | null) => void;
}

// Generate a persistent local device identifier
function getLocalDeviceId(): string {
  const key = 'vibelink_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'dev_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    localStorage.setItem(key, id);
  }
  return id;
}

// Track our own messages by client_message_id
export const sentMessageIds = new Set<string>();
// Track locally deleted message IDs (prevent poll from re-adding during race)
const locallyDeletedIds = new Set<string>();
export function markLocallyDeleted(clientMessageIds: string[]) {
  clientMessageIds.forEach((id) => locallyDeletedIds.add(id));
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoadingHistory: false,
  hasMore: true,
  myDeviceId: getLocalDeviceId(),
  selectedCategoryId: null,

  setSelectedCategoryId: (id) => set({ selectedCategoryId: id }),

  addMessage: (msg) => {
    set((s) => {
      // Dedup by client_message_id
      if (s.messages.some((m) => m.client_message_id === msg.client_message_id)) {
        return s;
      }
      return { messages: [...s.messages, msg] };
    });
  },

  sendText: async (text: string) => {
    const clientId = generateClientId();
    const { myDeviceId, addMessage } = get();

    // Optimistic: show text immediately
    const optimistic: Message = {
      id: clientId,
      user_id: '',
      from_device: myDeviceId,
      type: 'text',
      content: text,
      file_name: null,
      file_size: null,
      file_type: null,
      file_path: null,
      encrypted_key: null,
      iv: null,
      client_message_id: clientId,
      created_at: Math.floor(Date.now() / 1000),
      pending: true,
    };
    addMessage(optimistic);

    // Track optimistically so poll doesn't duplicate
    sentMessageIds.add(clientId);

    try {
      // Encrypt content before sending
      const { content: encContent, iv } = await encryptContent(text);

      const res = await api.post('/messages/send', {
        type: 'text',
        content: encContent,
        iv: iv || undefined,
        clientMessageId: clientId,
        categoryId: get().selectedCategoryId,
      });

      // Server returns the confirmed message — decrypt before storing
      if (res.data.message && !res.data.duplicate) {
        const confirmed = fixMessage(res.data.message);
        if (confirmed.content && confirmed.iv) {
          confirmed.content = await decryptContent(confirmed.content, confirmed.iv);
        }
        set((s) => ({
          messages: s.messages.map((m) =>
            m.client_message_id === clientId ? { ...confirmed, pending: false } : m
          ),
        }));
      }
    } catch (err) {
      sentMessageIds.delete(clientId);
      // Mark optimistic as failed
      set((s) => ({
        messages: s.messages.map((m) =>
          m.client_message_id === clientId ? { ...m, pending: false, content: '发送失败' } : m
        ),
      }));
      console.error('[sendText] Failed:', err);
    }
  },

  loadHistory: async () => {
    const { messages, isLoadingHistory } = get();
    if (isLoadingHistory) return;

    set({ isLoadingHistory: true });

    try {
      const before = messages.length > 0
        ? Math.min(...messages.map((m) => m.created_at))
        : Math.floor(Date.now() / 1000);

      const { data } = await api.get('/messages/history', {
        params: { limit: 50, before },
      });

      const historyMessages: Message[] = data.messages || [];
      // Decrypt history messages
      for (const msg of historyMessages) {
        fixMessage(msg);
        if (msg.content && msg.iv) {
          msg.content = await decryptContent(msg.content, msg.iv);
        }
      }

      set((s) => {
        const existingIds = new Set(s.messages.map((m) => m.id));
        const newMessages = historyMessages.filter((m) => !existingIds.has(m.id));
        return {
          messages: [...newMessages, ...s.messages],
          hasMore: historyMessages.length >= 50,
          isLoadingHistory: false,
        };
      });
    } catch {
      set({ isLoadingHistory: false });
    }
  },

  deleteMessage: async (id: string) => {
    // Track the deleted message to prevent poll from re-adding it
    const msg = get().messages.find((m) => m.id === id);
    if (msg?.client_message_id) {
      locallyDeletedIds.add(msg.client_message_id);
    }
    // Optimistic delete
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
    try {
      await api.delete(`/messages/${id}`);
    } catch {
      get().loadHistory();
    }
  },

  pollNewMessages: async () => {
    const { messages } = get();
    const after = messages.length > 0
      ? Math.max(...messages.map((m) => m.created_at))
      : 0;

    try {
      const { data } = await api.get('/messages/poll', { params: { after } });
      const newMessages: Message[] = data.messages || [];
      const deletedIds: string[] = data.deletedIds || [];

      // Remove deleted messages (cross-device sync)
      if (deletedIds.length > 0) {
        set((s) => {
          const deletedSet = new Set(deletedIds);
          const remaining = s.messages.filter((m) => !deletedSet.has(m.id));
          if (remaining.length === s.messages.length) return s;
          return { messages: remaining };
        });
      }

      // Decrypt incoming messages
      for (const msg of newMessages) {
        fixMessage(msg);
        if (msg.content && msg.iv) {
          msg.content = await decryptContent(msg.content, msg.iv);
        }
      }
      if (newMessages.length > 0) {
        set((s) => {
          const existing = new Set(s.messages.map((m) => m.client_message_id));
          const toAdd = newMessages.filter((m) => !existing.has(m.client_message_id) && !sentMessageIds.has(m.client_message_id) && !locallyDeletedIds.has(m.client_message_id));
          if (toAdd.length === 0) return s;
          return { messages: [...s.messages, ...toAdd] };
        });
      }
    } catch {
      // Silently ignore poll errors
    }
  },
}));
