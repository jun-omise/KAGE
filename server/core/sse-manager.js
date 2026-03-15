import { EventEmitter } from 'events';

class SSEManager extends EventEmitter {
  constructor() {
    super();
    this.connections = new Map(); // conversationId -> Set<res>
  }

  addConnection(conversationId, res) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('\n');

    if (!this.connections.has(conversationId)) {
      this.connections.set(conversationId, new Set());
    }
    this.connections.get(conversationId).add(res);

    res.on('close', () => {
      const conns = this.connections.get(conversationId);
      if (conns) {
        conns.delete(res);
        if (conns.size === 0) this.connections.delete(conversationId);
      }
    });
  }

  send(conversationId, event, data) {
    const conns = this.connections.get(conversationId);
    if (!conns) return;

    const payload = `event: ${event}\ndata: ${JSON.stringify({ ...data, timestamp: Date.now() })}\n\n`;
    for (const res of conns) {
      res.write(payload);
    }
  }

  broadcast(event, data) {
    for (const [conversationId] of this.connections) {
      this.send(conversationId, event, data);
    }
  }

  closeAll(conversationId) {
    const conns = this.connections.get(conversationId);
    if (conns) {
      for (const res of conns) res.end();
      this.connections.delete(conversationId);
    }
  }
}

// Singleton
const sseManager = new SSEManager();
export default sseManager;
