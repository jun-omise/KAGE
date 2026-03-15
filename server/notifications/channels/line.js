export class LINEChannel {
  async send(config, message) {
    const { token } = config;
    if (!token) throw new Error('LINE Notify token is required');

    const response = await fetch('https://notify-api.line.me/api/notify', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ message }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`LINE Notify failed: ${response.status} ${text}`);
    }
  }
}
