export class WebhookChannel {
  async send(config, message) {
    const { url, headers = {} } = config;
    if (!url) throw new Error('Webhook URL is required');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({ text: message, timestamp: new Date().toISOString() }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }
}
