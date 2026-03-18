/**
 * ChannelAdapter — abstract base class for messaging platform integrations.
 * WebChat, Telegram, LINE, Slack adapters extend this.
 */
export class ChannelAdapter {
  constructor(name, config = {}) {
    this.name = name;
    this.config = config;
    this.status = 'disconnected';
    this._messageCallback = null;
  }

  async connect() {
    throw new Error(`${this.name}: connect() not implemented`);
  }

  async disconnect() {
    this.status = 'disconnected';
  }

  async sendMessage(peerId, text) {
    throw new Error(`${this.name}: sendMessage() not implemented`);
  }

  onMessage(callback) {
    this._messageCallback = callback;
  }

  getStatus() {
    return this.status;
  }

  _emitMessage(peerId, text, metadata = {}) {
    if (this._messageCallback) {
      this._messageCallback(peerId, text, { channel: this.name, ...metadata });
    }
  }
}
