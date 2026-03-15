import { v4 as uuidv4 } from 'uuid';
import { getDb } from '../db/init.js';
import { WebhookChannel } from './channels/webhook.js';
import { LINEChannel } from './channels/line.js';
import { WhatsAppChannel } from './channels/whatsapp.js';
import { MessengerChannel } from './channels/messenger.js';

class NotificationService {
  constructor() {
    this.channels = {
      webhook: new WebhookChannel(),
      line: new LINEChannel(),
      whatsapp: new WhatsAppChannel(),
      messenger: new MessengerChannel(),
    };
  }

  async notify(eventType, payload) {
    try {
      const db = getDb();
      const channels = db.prepare(
        'SELECT * FROM notification_channels WHERE enabled = 1'
      ).all();

      for (const channel of channels) {
        // Check event filters
        if (channel.event_filters) {
          const filters = JSON.parse(channel.event_filters);
          if (filters.length > 0 && !filters.includes(eventType)) continue;
        }

        const config = JSON.parse(channel.config);
        const sender = this.channels[channel.type];
        if (!sender) continue;

        const logId = uuidv4();
        try {
          const message = this._formatMessage(eventType, payload);
          await sender.send(config, message);

          db.prepare(
            'INSERT INTO notification_log (id, channel_id, event_type, payload, status) VALUES (?, ?, ?, ?, ?)'
          ).run(logId, channel.id, eventType, JSON.stringify(payload), 'sent');
        } catch (err) {
          db.prepare(
            'INSERT INTO notification_log (id, channel_id, event_type, payload, status, error) VALUES (?, ?, ?, ?, ?, ?)'
          ).run(logId, channel.id, eventType, JSON.stringify(payload), 'failed', err.message);
          console.error(`Notification failed for channel ${channel.name}:`, err.message);
        }
      }
    } catch (err) {
      console.error('NotificationService error:', err.message);
    }
  }

  _formatMessage(eventType, payload) {
    const icons = {
      task_start: '\u25B6\uFE0F',
      task_complete: '\u2705',
      task_error: '\u274C',
      approval_required: '\u26A0\uFE0F',
      cost_warning: '\uD83D\uDCB0',
      security_alert: '\uD83D\uDEE1\uFE0F',
    };

    const icon = icons[eventType] || '\uD83D\uDD14';
    const title = eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

    let details = '';
    if (payload.message) details += `\nMessage: ${payload.message}`;
    if (payload.taskId) details += `\nTask: ${payload.taskId}`;
    if (payload.cost) details += `\nCost: $${payload.cost}`;
    if (payload.elapsed) details += `\nDuration: ${payload.elapsed}`;
    if (payload.error) details += `\nError: ${payload.error}`;

    return `${icon} KAGE: ${title}${details}`;
  }

  async sendTest(channelId) {
    const db = getDb();
    const channel = db.prepare('SELECT * FROM notification_channels WHERE id = ?').get(channelId);
    if (!channel) throw new Error('Channel not found');

    const config = JSON.parse(channel.config);
    const sender = this.channels[channel.type];
    if (!sender) throw new Error(`Unknown channel type: ${channel.type}`);

    const message = '\uD83D\uDD14 KAGE Test Notification - If you received this, notifications are working!';
    await sender.send(config, message);
    return true;
  }
}

const notificationService = new NotificationService();
export default notificationService;
