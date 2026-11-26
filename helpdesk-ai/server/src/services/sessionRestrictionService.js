const prisma = require("../prisma");
const WINDOW_MS = 15 * 60000;
const COOLDOWN_MS = 10 * 60000;
// Store the account counter in the existing table, independently of chat IDs.
const ACCOUNT_SCOPE = '__account_safety__';
function safetyViolation(event) {
  return event.blocked && /^SAFETY_/.test(event.code || "") && !/UNAVAILABLE/.test(event.code);
}
async function getRestriction(userId) {
  if (!userId) return null;
  // Honor pre-existing conversation cooldowns across the account until they expire.
  return prisma.sessionRestriction.findFirst({where:{userId,expiresAt:{gt:new Date()}},orderBy:{expiresAt:'desc'}});
}
async function recordViolation(tx, event, now = new Date()) {
  if (!event.userId || !safetyViolation(event)) return null;
  const key = { userId: event.userId, sessionId: ACCOUNT_SCOPE };
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`restriction:${event.userId}`}))`;
  const active=await tx.sessionRestriction.findFirst({where:{userId:event.userId,expiresAt:{gt:now}},orderBy:{expiresAt:'desc'}});
  if(active)return active;
  const previous = await tx.sessionRestriction.findUnique({ where: { userId_sessionId: key } });
  if (previous?.expiresAt > now) return previous;
  const inWindow = previous && !previous.expiresAt && now - previous.windowStart < WINDOW_MS;
  const violations = inWindow ? previous.violations + 1 : 1;
  const data = { violations, windowStart: inWindow ? previous.windowStart : now,
    expiresAt: violations >= 3 ? new Date(now.getTime() + COOLDOWN_MS) : null,
    reason: violations >= 3 ? "Repeated safety-blocked requests" : null };
  return tx.sessionRestriction.upsert({ where: { userId_sessionId: key }, create: { ...key, ...data }, update: data });
}
module.exports = { getRestriction, recordViolation, safetyViolation, WINDOW_MS, COOLDOWN_MS, ACCOUNT_SCOPE };
