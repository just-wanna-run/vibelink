import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import url from 'url';

const JWT_SECRET = process.env.JWT_SECRET || 'vibelink-dev-secret-change-in-production';

// Map of userId -> Set of WebSocket connections (multiple devices)
const clients = new Map<string, Set<WebSocket>>();

export function setupWebSocket(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket, req) => {
    // Authenticate via token in query string
    const params = url.parse(req.url || '', true).query;
    const token = params.token as string;

    if (!token) {
      ws.close(4001, '未提供认证 token');
      return;
    }

    let userId: string;
    try {
      const payload = jwt.verify(token, JWT_SECRET) as { userId: string };
      userId = payload.userId;
    } catch {
      ws.close(4002, 'token 无效或已过期');
      return;
    }

    // Register connection
    if (!clients.has(userId)) {
      clients.set(userId, new Set());
    }
    clients.get(userId)!.add(ws);

    console.log(`[WS] User ${userId} connected (${clients.get(userId)!.size} devices)`);

    // Notify other devices
    broadcastToUser(userId, {
      type: 'device_online',
      userId,
      deviceCount: clients.get(userId)!.size,
    }, ws);

    // Handle incoming messages (WebRTC signaling relay)
    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // Relay WebRTC signaling to other devices of the same user
        if (['webrtc_offer', 'webrtc_answer', 'webrtc_ice_candidate'].includes(msg.type)) {
          broadcastToUser(userId, msg, ws);
        }
      } catch {
        // Ignore invalid messages
      }
    });

    // Handle close
    ws.on('close', () => {
      const userSockets = clients.get(userId);
      if (userSockets) {
        userSockets.delete(ws);
        if (userSockets.size === 0) {
          clients.delete(userId);
        }
      }
      console.log(`[WS] User ${userId} disconnected`);
    });
  });

  console.log('[WS] WebSocket server ready on /ws');
}

// Broadcast message to all devices of a user
export function broadcastToUser(userId: string, data: object, excludeWs?: WebSocket) {
  const userSockets = clients.get(userId);
  if (!userSockets) return;

  const payload = JSON.stringify(data);
  for (const ws of userSockets) {
    if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
      ws.send(payload);
    }
  }
}

// Notify other devices of the same user about a new message
export function notifyNewMessage(userId: string, message: any, senderWs?: WebSocket) {
  broadcastToUser(userId, {
    type: 'new_message',
    message,
  }, senderWs);
}

// Notify about deleted message
export function notifyMessageDeleted(userId: string, messageId: string) {
  broadcastToUser(userId, {
    type: 'message_deleted',
    messageId,
  });
}
