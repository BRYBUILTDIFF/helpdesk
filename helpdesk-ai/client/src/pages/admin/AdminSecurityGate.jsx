import {useEffect, useState} from 'react';
import {useAxios} from '../../hooks/useAxios';
import {useAuth} from '../../hooks/useAuth';
import {setAdminVerification} from '../../utils/adminVerification';
import './admin-security.css';

export default function AdminSecurityGate({children}) {
  const api = useAxios();
  const {user, logout} = useAuth();
  const [status, setStatus] = useState(null);
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [challengeId, setChallengeId] = useState(0);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  function applyCooldown(data, headers = {}) {
    const seconds = Number(data?.resendAfter ?? headers['retry-after'] ?? 0);
    setResendAt(Date.now() + Math.max(0, seconds) * 1000);
    setNow(Date.now());
  }
  useEffect(() => {
    if (!resendAt) return;
    const interval = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= resendAt) setResendAt(0);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [resendAt]);
  useEffect(() => {
    const verify = event => {
      setStatus(null);setError(event.detail);setCode('');setMessage('');setSent(false);
      setChallengeId(previous => previous + 1);
    };
    window.addEventListener('admin-verification-required', verify);
    return () => window.removeEventListener('admin-verification-required',verify);
  }, []);
  useEffect(() => {
    let active = true;
    async function initialize() {
      setBusy(true);
      try {
        const response = await api.get('/api/auth/admin-mfa/status');
        if (!active) return;
        setStatus(response.data);
        applyCooldown(response.data);
        if (!response.data.required || response.data.verified) return;
        if (response.data.challengeActive) {setSent(true);return;}
        if (response.data.resendAfter > 0) return;
        const sentResponse = await api.post('/api/auth/admin-mfa/send-code');
        if (!active) return;
        applyCooldown(sentResponse.data);setSent(true);setMessage(sentResponse.data.message);
      } catch (error) {
        if (!active) return;
        applyCooldown(error.response?.data, error.response?.headers);
        if (error.response?.data?.challengeActive) setSent(true);
        setError(error.response?.data?.message || 'Unable to prepare email verification. Please retry.');
      } finally {if (active) setBusy(false);}
    }
    initialize();
    return () => {active=false;};
  }, [api, user.id, challengeId]);
  async function sendCode() {
    if (busy || remaining > 0) return;
    setBusy(true);setError('');setMessage('');
    try {
      const response = await api.post('/api/auth/admin-mfa/send-code');
      applyCooldown(response.data);setSent(true);setCode('');setMessage(response.data.message);
    } catch (error) {
      applyCooldown(error.response?.data, error.response?.headers);
      if (error.response?.data?.challengeActive) setSent(true);
      setError(error.response?.data?.message || 'Unable to send code. Please try again.');
    } finally {setBusy(false);}
  }
  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError('');setBusy(true);
    try {
      const response = await api.post('/api/auth/admin-mfa/verify',{code:code.trim()});
      setAdminVerification(user.id,response.data.verificationToken);
      setCode('');setMessage('');setStatus({...status,verified:true});
    } catch(error) {
      if (error.response?.status === 429) applyCooldown(error.response.data,error.response.headers);
      setError(error.response?.data?.message || 'Verification failed. Check your code and try again.');
    } finally {setBusy(false);}
  }
  if(status && (!status.required || status.verified))return children;
  return <main className="admin-security-shell"><section className="admin-security-panel" aria-labelledby="admin-security-title">
    <h1 id="admin-security-title">Verify your administrator email</h1>
    {error && <p className="admin-security-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    {!status ? <><p role="status">Checking account security…</p>{!busy && <button onClick={()=>{setError('');setChallengeId(value=>value+1);}}>Retry</button>}</> : <>
      <p>{sent ? `Enter the six-digit code sent to ${user.email}. The code expires in five minutes.` : busy ? `Sending a verification code to ${user.email}…` : `Request a verification code for ${user.email} to continue.`}</p>
      <form onSubmit={submit} aria-busy={busy}>
        <label htmlFor="admin-security-code">Email verification code</label>
        <input id="admin-security-code" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" value={code} onChange={event=>setCode(event.target.value)} required minLength={6} maxLength={6} disabled={busy || !sent}/>
        <button type="submit" disabled={busy || !sent || !/^\d{6}$/.test(code)}>{busy ? 'Please wait…' : 'Verify and continue'}</button>
        <button type="button" className="admin-security-secondary" disabled={busy || remaining > 0} onClick={sendCode}>{remaining > 0 ? `Resend code in ${remaining}s` : sent ? 'Resend code' : 'Send email code'}</button>
      </form>
    </>}
    <button type="button" className="admin-security-secondary" onClick={logout}>Sign out</button>
  </section></main>;
}
