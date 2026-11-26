const { test } = require("node:test");
const assert = require("node:assert/strict");
const { recordViolation, safetyViolation } = require("../src/services/sessionRestrictionService");
function database() {
  const rows = new Map();
  const key=value=>value.userId+':'+value.sessionId;
  return { $executeRaw: async () => {}, sessionRestriction: {
    findUnique: async ({where}) => rows.get(key(where.userId_sessionId))||null,
    findFirst: async ({where})=>[...rows.values()].filter(row=>row.userId===where.userId&&row.expiresAt>where.expiresAt.gt).sort((a,b)=>b.expiresAt-a.expiresAt)[0]||null,
    upsert: async ({create, update}) => {const id=key(create),row=rows.get(id);const next=row?{...row,...update}:create;rows.set(id,next);return next;}
  } };
}
const event = {userId: 1, sessionId: "conversation", blocked: true, code: "SAFETY_THREAT"};
test("three safety violations trigger ten minutes, then reset", async () => {
  const tx = database(), now = new Date();
  assert.equal((await recordViolation(tx, event, now)).expiresAt, null);
  await recordViolation(tx, event, now);
  const third = await recordViolation(tx, event, now);
  assert.equal(third.violations, 3);
  assert.equal(third.expiresAt - now, 600000);
  assert.equal((await recordViolation(tx, event, new Date(+now + 1000))).violations, 3);
  const after = await recordViolation(tx, event, new Date(+now + 601000));
  assert.equal(after.violations, 1); assert.equal(after.expiresAt, null);
});
test("non-violations never contribute; windows expire after fifteen minutes", async () => {
  for (const code of ["SAFETY_UNAVAILABLE", "SCOPE_CLASSIFIER_UNAVAILABLE", "OUT_OF_SCOPE_REDIRECT", "OUTPUT_SAFETY_FILTERED", "SCOPE_CLARIFICATION"]) {
    assert.equal(safetyViolation({...event, code}), false);
  }
  const tx = database(), now = new Date();
  await recordViolation(tx, event, now);
  assert.equal((await recordViolation(tx, event, new Date(+now + 900001))).violations, 1);
});

test('violations accumulate across conversations and missing chat IDs, independently per user',async()=>{
 const tx=database(),now=new Date();
 await recordViolation(tx,{...event,sessionId:'chat-a'},now);
 await recordViolation(tx,{...event,sessionId:'chat-b'},now);
 const third=await recordViolation(tx,{...event,sessionId:''},now);
 assert.equal(third.violations,3);assert.equal(third.expiresAt-now,600000);
 assert.equal((await recordViolation(tx,{...event,sessionId:'new-device'},new Date(+now+1000))).expiresAt,third.expiresAt);
 const other=await recordViolation(tx,{...event,userId:2},now);
 assert.equal(other.violations,1);assert.equal(other.expiresAt,null);
});
