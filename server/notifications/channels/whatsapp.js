export class WhatsAppChannel {
  async send(config, message) {
    const { accountSid, authToken, fromNumber, toNumber } = config;
    if (!accountSid || !authToken || !fromNumber || !toNumber) {
      throw new Error('WhatsApp config requires accountSid, authToken, fromNumber, toNumber');
    }

    const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: `whatsapp:${fromNumber}`,
        To: `whatsapp:${toNumber}`,
        Body: message.slice(0, 4096),
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`WhatsApp (Twilio) failed: ${response.status} ${text}`);
    }
  }
}
