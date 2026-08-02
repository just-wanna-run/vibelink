import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'vibelink-dev-secret-change-in-production';

export interface AuthRequest extends Request {
  userId?: string;
  sessionId?: string;
}

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
