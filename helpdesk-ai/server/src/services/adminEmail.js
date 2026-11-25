function unavailable(message) {
  const error = new Error(message);
  error.status = 503;
  error.publicMessage = message;
  return error;
}
function mailbox(value) {
  return typeof value === 'string' && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) && !/[^\x21-\x7e]/.test(value);
}
async function sendCode(email, code) {
  const sender = String(process.env.GMAIL_USER || '').trim();
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  if (!mailbox(sender) || !clientId || !clientSecret || !refreshToken) {
    throw unavailable('Administrator Gmail delivery is not configured.');
  }
  if (!mailbox(email) || !/^\d{6}$/.test(code)) {
    throw unavailable('Administrator email delivery details are invalid.');
  }
  try {
    // One deadline covers both requests and fits within the MFA transaction timeout.
    const signal = AbortSignal.timeout(12000);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' })
    });
    if (!tokenResponse.ok) throw new Error('Gmail authorization failed');
    const token = await tokenResponse.json();
    if (typeof token.access_token !== 'string' || !token.access_token) throw new Error('Gmail access token missing');
    const text = `Your HelpDesk AI administrator verification code is ${code}. It expires in 5 minutes and can be used once. If you did not request this code, change your account password.`;
    const content = Buffer.from(text, 'utf8').toString('base64').match(/.{1,76}/g).join('\r\n');
    const message = [
      `From: HelpDesk AI <${sender}>`, `To: <${email}>`,
      'Subject: Your HelpDesk AI administrator verification code',
      'MIME-Version: 1.0', 'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64', '', content
    ].join('\r\n');
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST', signal,
      headers: { Authorization: `Bearer ${token.access_token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw: Buffer.from(message, 'utf8').toString('base64url') })
    });
    if (!response.ok) throw new Error('Gmail rejected delivery');
  } catch {
    // Do not expose provider responses, authorization credentials, or verification codes.
    throw unavailable('Unable to send verification email. Try again later.');
  }
}
module.exports = { sendCode };
