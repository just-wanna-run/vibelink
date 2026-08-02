import { getStoredToken } from './api';

type MessageHandler = (msg: any) => void;

class WsClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, Set<MessageHandler>> = new Map();
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private url: string = '';

  connect() {
    const token = getStoredToken();
    if (!token) return;

    // In dev: use current host (Vite proxy handles ws://localhost:5173/ws → backend)
    // In prod: use configured backend URL
    const apiBase = import.meta.env.VITE_API_URL || '';
    if (apiBase) {
      const wsUrl = apiBase.replace(/^http/, 'ws');
      this.url = `${wsUrl}/ws?token=${token}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      this.url = `${protocol}//${host}/ws?token=${token}`;
    }

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[WS] Connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const handlers = this.handlers.get(data.type);
        if (handlers) {
          handlers.forEach((h) => h(data));
        }
        // Also notify 'all' handlers
        const allHandlers = this.handlers.get('*');
        if (allHandlers) {
          allHandlers.forEach((h) => h(data));
        }
      } catch {
        // Ignore parse errors
      }
    };

    this.ws.onclose = () => {
      console.log('[WS] Disconnected');
      this.scheduleReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 3000);
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
  }

  off(type: string, handler: MessageHandler) {
    this.handlers.get(type)?.delete(handler);
  }

  send(data: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }
}

export const wsClient = new WsClient();
