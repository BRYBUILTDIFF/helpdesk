const crypto = require('crypto');
const prisma = require('../prisma');
const mfa = require('../services/adminMfa');
async function administrator(req) {
  const user = req.user?.id && await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!user?.isActive || user.role !== 'ADMIN' || (user.tokenVersion || 0) !== (req.user.tokenVersion || 0)) {
    const error = new Error('Verification failed'); error.status = 403; error.publicMessage = 'Administrator verification failed.'; throw error;
  }
  return user;
}
function challengeState(record, user) {
  const expiresAt = record?.pendingExpiresAt?.getTime() || 0;
  const resendAfter = Math.max(0, Math.ceil((expiresAt - 240000 - Date.now()) / 1000));
  let challengeActive = false;
  if (record?.pendingSecret && expiresAt > Date.now()) {
    try {
      const challenge = JSON.parse(mfa.open(record.pendingSecret, `email-mfa:${user.id}`));
      challengeActive = challenge.version === (user.tokenVersion || 0) && challenge.attempts < 5;
    } catch { /* Legacy authenticator enrollment is not an email challenge. */ }
  }
  return { resendAfter, challengeActive };
}
async function status(req, res, next) {
  try {
    const [record] = await prisma.$queryRaw`SELECT * FROM "AdminSecurity" WHERE "userId"=${req.user.id}`;
    const proof = record?.secret?.startsWith('email:') && mfa.verifyProof(req.headers['x-admin-verification'], req.user, record.secret);
    res.json({ ...challengeState(record, req.user), method: 'email', required: mfa.required(), enrolled: !!record?.secret, verified: !!proof, recent: !!proof && Date.now() - proof.verifiedAt <= 5 * 60000 });
  } catch (error) { next(error); }
}
async function enroll(req, res, next) {
  try {
    const user = await administrator(req);
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mfa:${user.id}`}))`;
      const [record] = await tx.$queryRaw`SELECT * FROM "AdminSecurity" WHERE "userId"=${user.id} FOR UPDATE`;
      const state = challengeState(record, user);
      if (state.resendAfter > 0) return { limited: true, ...state };
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
      const challenge = mfa.seal(JSON.stringify({ digest: mfa.hash(code), attempts: 0, version: user.tokenVersion || 0 }), `email-mfa:${user.id}`);
      await tx.$executeRaw`INSERT INTO "AdminSecurity" ("userId","pendingSecret","pendingExpiresAt") VALUES (${user.id},${challenge},${new Date(Date.now()+300000)}) ON CONFLICT ("userId") DO UPDATE SET "pendingSecret"=EXCLUDED."pendingSecret","pendingExpiresAt"=EXCLUDED."pendingExpiresAt"`;
      await require('../services/adminEmail').sendCode(user.email, code);
      return { resendAfter: 60, challengeActive: true };
    }, { timeout: 20000 });
    if (result.limited) {
      res.set('Retry-After', String(result.resendAfter));
      return res.status(429).json({ message: 'Please wait before requesting another code.', ...result });
    }
    res.json({ message: 'Verification code sent to your administrator email.', ...result, expiresIn: 300 });
  } catch (error) { next(error); }
}
async function verify(req, res, next) {
  try {
    const user = await administrator(req);
    const result = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`mfa:${user.id}`}))`;
      const [record] = await tx.$queryRaw`SELECT * FROM "AdminSecurity" WHERE "userId"=${user.id} FOR UPDATE`;
      if (!record?.pendingSecret || !record.pendingExpiresAt || record.pendingExpiresAt <= new Date()) return null;
      let challenge;
      try { challenge = JSON.parse(mfa.open(record.pendingSecret, `email-mfa:${user.id}`)); } catch { return null; }
      if (challenge.attempts >= 5 || challenge.version !== (user.tokenVersion || 0)) return null;
      if (!crypto.timingSafeEqual(Buffer.from(challenge.digest), Buffer.from(mfa.hash(String(req.body.code))))) {
        challenge.attempts += 1;
        const pending = mfa.seal(JSON.stringify(challenge), `email-mfa:${user.id}`);
        await tx.$executeRaw`UPDATE "AdminSecurity" SET "pendingSecret"=${pending} WHERE "userId"=${user.id}`;
        return null;
      }
      const secret = 'email:' + crypto.randomBytes(32).toString('hex');
      await tx.$executeRaw`UPDATE "AdminSecurity" SET "secret"=${secret},"pendingSecret"=NULL,"pendingExpiresAt"=NULL,"lastCounter"=-1,"recoveryHashes"='[]'::jsonb WHERE "userId"=${user.id}`;
      return { verificationToken: mfa.issueProof(user, secret) };
    });
    if (!result) return res.status(400).json({ message: 'Code is invalid, expired, or has too many attempts. Request a new email code.' });
    res.json(result);
  } catch (error) { next(error); }
}
module.exports = { status, enroll, verify };
