import crypto from 'crypto';
import { WebhookHandler } from './base.js';
import { getDb } from '../db/init.js';

export class MessengerWebhook extends WebhookHandler {
  constructor() {
    super('messenger');
  }

  // GET - webhook verification
  handleVerification(req, res) {
    const db = getDb();
    const configRow = db.prepare("SELECT value FROM config WHERE key = 'messaging_messenger'").get();
    const config = configRow ? JSON.parse(configRow.value) : {};

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.verifyToken) {
      res.status(200).send(challenge);
    } else {
      res.status(403).json({ error: 'Verification failed' });
    }
  }

  verifySignature(body, signature, appSecret) {
    if (!signature || !appSecret) return false;
    const hash = crypto.createHmac('sha256', appSecret).update(body).digest('hex');
    return signature === `sha256=${hash}`;
  }

  // POST - incoming messages
  async handleWebhook(req, res) {
    try {
      const db = getDb();
      const configRow = db.prepare("SELECT value FROM config WHERE key = 'messaging_messenger'").get();
      if (!configRow) {
        return res.status(500).json({ error: 'Messenger not configured' });
      }
      const config = JSON.parse(configRow.value);

      // Verify signature
      if (config.appSecret) {
        const signature = req.headers['x-hub-signature-256'];
        if (!this.verifySignature(JSON.stringify(req.body), signature, config.appSecret)) {
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      const entries = req.body.entry || [];
      for (const entry of entries) {
        const messaging = entry.messaging || [];
        for (const event of messaging) {
          if (!event.message?.text) continue;

          const userId = event.sender?.id;
          const text = event.message.text;
          if (!userId || !text) continue;

          const session = await this.getOrCreateSession(userId);

          if (!(await this.checkRateLimit(session))) {
            await this.sendMessage(config, userId, 'Rate limit exceeded. Please try again later.');
            continue;
          }

          if (!session.authenticated) {
            const authed = await this.authenticate(session, text);
            if (authed) {
              await this.sendMessage(config, userId, '\u2705 Authenticated! You can now send commands to KAGE.');
            } else {
              await this.sendMessage(config, userId, '\uD83D\uDD12 Please send your KAGE passphrase to authenticate.');
            }
            continue;
          }

          const response = await this.processCommand(text, session);
          await this.sendMessage(config, userId, this.truncateResponse(response, 2000));
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Messenger webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  async sendMessage(config, recipientId, message) {
    try {
      await fetch(`https://graph.facebook.com/v18.0/me/messages?access_token=${config.pageAccessToken}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: { id: recipientId },
          message: { text: message },
        }),
      });
    } catch (err) {
      console.error('Messenger send error:', err);
    }
  }
}
