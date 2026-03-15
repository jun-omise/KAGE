import crypto from 'crypto';
import { WebhookHandler } from './base.js';
import { getDb } from '../db/init.js';

export class LINEWebhook extends WebhookHandler {
  constructor() {
    super('line');
  }

  verifySignature(body, signature, channelSecret) {
    const hmac = crypto.createHmac('SHA256', channelSecret);
    hmac.update(body);
    const digest = hmac.digest('base64');
    return digest === signature;
  }

  async handleWebhook(req, res) {
    try {
      const db = getDb();
      const configRow = db.prepare("SELECT value FROM config WHERE key = 'messaging_line'").get();
      if (!configRow) {
        return res.status(500).json({ error: 'LINE not configured' });
      }
      const config = JSON.parse(configRow.value);

      // Verify signature
      const signature = req.headers['x-line-signature'];
      const bodyStr = JSON.stringify(req.body);
      if (!this.verifySignature(bodyStr, signature, config.channelSecret)) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      const events = req.body.events || [];
      for (const event of events) {
        if (event.type !== 'message' || event.message?.type !== 'text') continue;

        const userId = event.source?.userId;
        const text = event.message.text;
        const replyToken = event.replyToken;

        if (!userId || !text) continue;

        const session = await this.getOrCreateSession(userId);

        // Rate limit check
        if (!(await this.checkRateLimit(session))) {
          await this.reply(config.channelAccessToken, replyToken, 'Rate limit exceeded. Please try again later.');
          continue;
        }

        // Authentication
        if (!session.authenticated) {
          const authed = await this.authenticate(session, text);
          if (authed) {
            await this.reply(config.channelAccessToken, replyToken, '\u2705 Authenticated! You can now send commands to KAGE.');
          } else {
            await this.reply(config.channelAccessToken, replyToken, '\uD83D\uDD12 Please send your KAGE passphrase to authenticate.');
          }
          continue;
        }

        // Process command
        const response = await this.processCommand(text, session);
        await this.reply(config.channelAccessToken, replyToken, this.truncateResponse(response, 5000));
      }

      res.json({ success: true });
    } catch (error) {
      console.error('LINE webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  }

  async reply(channelAccessToken, replyToken, message) {
    try {
      await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
          replyToken,
          messages: [{ type: 'text', text: message }],
        }),
      });
    } catch (err) {
      console.error('LINE reply error:', err);
    }
  }
}
