module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const to = 'tathome2025@gmail.com';
  const from = process.env.MAIL_FROM || 'TAT Chatbot <onboarding@resend.dev>';
  const resendApiKey = process.env.RESEND_API_KEY;

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    payload = {};
  }

  const messages = payload.conversation || [];
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(200).json({ ok: true, skipped: true });
    return;
  }

  const textBody = [
    `Session: ${payload.sessionId || 'unknown'}`,
    `Page: ${payload.page || ''}`,
    `User Agent: ${payload.userAgent || ''}`,
    `Sent At: ${payload.sentAt || new Date().toISOString()}`,
    '',
    'Conversation:',
    ...messages.map((m) => `[${m.ts || ''}] ${m.role}: ${m.text}`)
  ].join('\n');

  if (!resendApiKey) {
    res.status(200).json({ ok: true, skipped: true, reason: 'RESEND_API_KEY not set' });
    return;
  }

  try {
    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'New TAT website chatbot transcript',
        text: textBody
      })
    });

    if (!emailRes.ok) {
      const err = await emailRes.text();
      throw new Error(err);
    }

    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
};
