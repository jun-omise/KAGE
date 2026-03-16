/**
 * JWT認証ミドルウェア
 * Authorization: Bearer <token> ヘッダーを検証
 * auth.js ルートから分離された共通ミドルウェア
 */
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const JWT_SECRET = process.env.JWT_SECRET || 'kage-dev-secret';

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: 'No authorization header provided' });
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    res.status(500).json({ error: 'Authentication failed' });
  }
}

export function generateToken(payload) {
  return jwt.sign({ ...payload, jti: uuidv4() }, JWT_SECRET, { expiresIn: '24h' });
}
