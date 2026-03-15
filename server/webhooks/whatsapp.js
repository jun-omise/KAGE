import { WebhookHandler } from './base.js';
import { getDb } from '../db/init.js';

export class WhatsAppWebhook extends WebhookHandler {
  constructor() {
    super('whatsapp');
  }

  // GET - webhook verification
  handleVerification(req, res) {
    const db = getDb();
    const configRow = db.prepare("SELECT value FROM config WHERE key = 'messaging_whatsapp'").get();
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

  // POST - incoming messages
  async handleWebhook(req, res) {
    try {
      const db = getDb();
      const configRow = db.prepare("SELECT value FROM config WHERE key = 'messaging_whatsapp'").get();
      if (!configRow) {
        return res.status(500).json({ error: 'WhatsApp not configured' });
      }
      const config = JSON.parse(configRow.value);

      // Process incoming messages
      const entries = req.body.entry || [];
      for (const entry of entries) {
        const changes = entry.changes || [];
        for (const change of changes) {
          if (change.field !== 'messages') continue;
          const messages = change.value?.messages || [];

          for (const msg of messages) {
            if (msg.type !== 'text') continue;

            const userId = msg.from;
            const text = msg.text?.body;
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
            await this.sendMessage(config, userId, this.truncateResponse(response, 4096));
          }
        }
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('WhatsApp webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  async sendMessage(config, to, message) {
    try {
      if (config.accountSid && config.authToken) {
        // Twilio WhatsApp
        const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
        const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');

        await fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: `whatsapp:${config.fromNumber}`,
            To: `whatsapp:${to}`,
            Body: message,
          }),
        });
      } else if (config.phoneNumberId && config.accessToken) {
        // WhatsApp Business API
        await fetch(`https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            text: { body: message },
          }),
        });
      }
    } catch (err) {
      console.error('WhatsApp send error:', err);
    }
  }
}
