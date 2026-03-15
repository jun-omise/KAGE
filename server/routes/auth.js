import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'kage-dev-secret';
const JWT_EXPIRY = '24h';

function generateToken(payload) {
  return jwt.sign({ ...payload, jti: uuidv4() }, JWT_SECRET, { expiresIn: JWT_EXPIRY });
}

// GET /status - Check if passphrase has been set
router.get('/status', async (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare("SELECT value FROM config WHERE key = 'passphrase_hash'").get();
    res.json({ setup: !!row });
  } catch (error) {
    console.error('Auth status error:', error);
    res.status(500).json({ error: 'Failed to check auth status' });
  }
});

// POST /setup - First time passphrase setup (or re-setup)
router.post('/setup', async (req, res) => {
  try {
    const db = getDb();
    const { passphrase, apiKey, securityLevel } = req.body;

    if (!passphrase) {
      return res.status(400).json({ error: 'Passphrase is required' });
    }

    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(passphrase, salt);

    db.prepare(
      "INSERT OR REPLACE INTO config (key, value) VALUES ('passphrase_hash', ?)"
    ).run(hash);

    if (apiKey) {
      db.prepare(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('api_key', ?)"
      ).run(apiKey);
    }

    if (securityLevel) {
      db.prepare(
        "INSERT OR REPLACE INTO config (key, value) VALUES ('security_level', ?)"
      ).run(securityLevel);
    }

    const token = generateToken({ type: 'session' });
    res.status(201).json({ token });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Failed to complete setup' });
  }
});

// POST /reset - Reset setup to show wizard again
router.post('/reset', async (req, res) => {
  try {
    const db = getDb();
    db.prepare("DELETE FROM config WHERE key = 'passphrase_hash'").run();
    res.json({ success: true });
  } catch (error) {
    console.error('Reset error:', error);
    res.status(500).json({ error: 'Failed to reset' });
  }
});

// POST /login - Login with passphrase
router.post('/login', async (req, res) => {
  try {
    const db = getDb();
    const { passphrase } = req.body;

    if (!passphrase) {
      return res.status(400).json({ error: 'Passphrase is required' });
    }

    const row = db.prepare("SELECT value FROM config WHERE key = 'passphrase_hash'").get();
    if (!row) {
      return res.status(404).json({ error: 'No passphrase configured. Run /setup first.' });
    }

    const valid = await bcrypt.compare(passphrase, row.value);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid passphrase' });
    }

    const token = generateToken({ type: 'session' });
    res.json({ token });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// Auth middleware for protecting routes
export function authMiddleware(req, res, next) {
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

export default router;
