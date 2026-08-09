import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || atob('dmljZWxpbmstYXBwLWp3dC1wcm9kLTljZi02ZmZkLTU1NGYtYTJjMg==');

export interface AuthRequest extends Request {
  userId?: string;
  sessionId?: string;
}

// Simple in-memory rate limiter for auth endpoints
const rateMap = new Map<string, { count: number; reset: number }>();
export function rateLimit(maxAttempts = 10, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = rateMap.get(ip);
    if (entry && now < entry.reset) {
      if (entry.count >= maxAttempts) {
        return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
      }
      entry.count++;
    } else {
      rateMap.set(ip, { count: 1, reset: now + windowMs });
    }
    next();
  };
}

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of rateMap) { if (now > v.reset) rateMap.delete(k); }
}, 300000);

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录，请先登录' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string; sessionId: string };
    req.userId = payload.userId;
    req.sessionId = payload.sessionId;
    next();
  } catch (err) {
    return res.status(401).json({ error: '登录已过期，请重新登录' });
  }
}

// Generate JWT token
export function generateToken(userId: string, sessionId: string, rememberMe: boolean): string {
  const expiresIn = rememberMe ? '30d' : '7d';
  return jwt.sign({ userId, sessionId }, JWT_SECRET, { expiresIn });
}
