import { create } from 'zustand';
import api from '../services/api';

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

  // Actions
  addMessage: (msg: Message) => void;
  sendText: (text: string) => Promise<void>;
  loadHistory: () => Promise<void>;
  deleteMessage: (id: string) => Promise<void>;
  handleWsMessage: (data: any) => void;
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

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoadingHistory: false,
  hasMore: true,
  myDeviceId: getLocalDeviceId(),

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

    // Track optimistically so WS doesn't duplicate
    sentMessageIds.add(clientId);

    try {
      const res = await api.post('/messages/send', {
        type: 'text',
        content: text,
        clientMessageId: clientId,
      });

      // Server returns the confirmed message — add it to state
      if (res.data.message && !res.data.duplicate) {
        set((s) => {
          // Dedup: don't add if WS already added it
          if (s.messages.some((m) => m.client_message_id === clientId)) {
            return s;
          }
          return { messages: [...s.messages, { ...res.data.message, pending: false }] };
        });
      }
    } catch (err) {
      sentMessageIds.delete(clientId);
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

      set((s) => ({
        messages: [...historyMessages, ...s.messages],
        hasMore: historyMessages.length >= 50,
        isLoadingHistory: false,
      }));
    } catch {
      set({ isLoadingHistory: false });
    }
  },

  deleteMessage: async (id: string) => {
    // Optimistic delete
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) }));
    try {
      await api.delete(`/messages/${id}`);
    } catch {
      // On failure, reload
      get().loadHistory();
    }
  },

  handleWsMessage: (data: any) => {
    if (data.type === 'new_message') {
      const msg = data.message;
      // Skip if we already added this message via API response
      if (sentMessageIds.has(msg.client_message_id)) return;
      set((s) => {
        // Double-check dedup
        if (s.messages.some((m) => m.client_message_id === msg.client_message_id)) {
          return s;
        }
        return { messages: [...s.messages, msg] };
      });
    } else if (data.type === 'message_deleted') {
      set((s) => ({
        messages: s.messages.filter((m) => m.id !== data.messageId),
      }));
    }
  },
}));
