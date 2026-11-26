const messages=require('./adminEmailErrors');
function unavailable(message,code='ADMIN_EMAIL_UNAVAILABLE') {
  const error = new Error(message);
  error.status = 503;
  error.publicMessage = message;
  error.code = code;
  return error;
}
function mailbox(value) {
  return typeof value === 'string' && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value) && !/[^\x21-\x7e]/.test(value);
}
async function sendCode(email, code) {
  const sender = String(process.env.ADMIN_EMAIL_FROM || '').trim();
  const apiKey = process.env.RESEND_API_KEY;
  if (!sender || /[\r\n]/.test(sender) || !apiKey) {
    throw unavailable(messages.ADMIN_EMAIL_NOT_CONFIGURED,'ADMIN_EMAIL_NOT_CONFIGURED');
  }
  if (!mailbox(email) || !/^\d{6}$/.test(code)) {
    throw unavailable(messages.ADMIN_EMAIL_INVALID_DETAILS,'ADMIN_EMAIL_INVALID_DETAILS');
  }
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'User-Agent': 'HelpDesk-AI/1.0' },
      body: JSON.stringify({
        from: sender, to: [email],
        subject: 'Your HelpDesk AI administrator verification code',
        text: `Your HelpDesk AI administrator verification code is ${code}. It expires in 5 minutes and can be used once. If you did not request this code, change your account password.`
      })
    });
    if (!response.ok) {
      let body;try{body=await response.json();}catch{body={};}
      const detail=typeof body?.message==='string'?body.message.slice(0,2000):'';
      const code=response.status===403&&/only send testing emails|own email address/i.test(detail)?'ADMIN_EMAIL_RECIPIENT_RESTRICTED'
        :response.status===403&&/domain.*not verified/i.test(detail)?'ADMIN_EMAIL_SENDER_UNVERIFIED'
        :response.status===400&&/invalid.*from|from.*(?:invalid|format)/i.test(detail)?'ADMIN_EMAIL_SENDER_INVALID'
        :response.status===401||([400,403].includes(response.status)&&/api key|access token.*scope/i.test(detail))?'ADMIN_EMAIL_KEY_INVALID'
        :response.status===429?'ADMIN_EMAIL_RATE_LIMITED':'ADMIN_EMAIL_UNAVAILABLE';
      console.warn('[AdminEmail] Delivery failed',{code,status:response.status});
      throw unavailable(messages[code],code);
    }
  } catch(error) {
    // Do not expose provider responses, authorization credentials, or verification codes.
    if(error.status===503&&Object.hasOwn(messages,error.code))throw error;
    const code=['TimeoutError','AbortError'].includes(error.name)?'ADMIN_EMAIL_TIMEOUT':'ADMIN_EMAIL_UNAVAILABLE';
    console.warn('[AdminEmail] Delivery failed',{code});
    throw unavailable(messages[code],code);
  }
}
module.exports = { sendCode };
