export class MessengerChannel {
  async send(config, message) {
    const { pageAccessToken, recipientId } = config;
    if (!pageAccessToken || !recipientId) {
      throw new Error('Messenger config requires pageAccessToken and recipientId');
    }

    const url = `https://graph.facebook.com/v18.0/me/messages?access_token=${pageAccessToken}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: message.slice(0, 2000) },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`Messenger failed: ${response.status} ${text}`);
    }
  }
}
