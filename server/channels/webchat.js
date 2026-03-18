/**
 * WebChatAdapter — wraps existing web chat into ChannelAdapter interface.
 * Always enabled as the default channel.
 */
import { ChannelAdapter } from './adapter.js';

export class WebChatAdapter extends ChannelAdapter {
  constructor() {
    super('webchat', { enabled: true });
  }

  async connect() {
    this.status = 'connected';
    return { success: true };
  }

  async disconnect() {
    this.status = 'disconnected';
  }

  async sendMessage(peerId, text) {
    // WebChat messages are sent via SSE directly — this is a no-op
    // The orchestrator handles all web chat message delivery
    return { delivered: true, channel: 'webchat', peerId };
  }

  getStatus() {
    return 'connected'; // WebChat is always available
  }
}

// Singleton
const webchatAdapter = new WebChatAdapter();
export default webchatAdapter;
