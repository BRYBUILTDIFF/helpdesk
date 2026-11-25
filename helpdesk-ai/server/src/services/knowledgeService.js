const { randomUUID, createHash } = require('node:crypto');
const prisma = require('../prisma');
const { chunkText } = require('./knowledgeExtraction');
const fail = (status, message) => Object.assign(new Error(message), { status, publicMessage: message });
const searchTerms = query => [...new Set((String(query).toLowerCase().match(/[a-z0-9][a-z0-9-]{2,40}/g) || []).filter(term => !new Set('create generate simulation steps scenario troubleshooting guide please help how what using with from this that have does about want need'.split(' ')).has(term)))].slice(0, 16);
async function listKnowledge() {
  return prisma.$queryRaw`SELECT d."id",d."title",d."filename",d."format",d."version",d."status",d."createdAt",d."approvedAt",length(d."text") AS "characters",(SELECT count(*)::int FROM "KnowledgeChunk" c WHERE c."documentId"=d."id") AS "passages" FROM "KnowledgeDocument" d ORDER BY d."createdAt" DESC LIMIT 200`;
}
async function getKnowledge(id) {
  const [document] = await prisma.$queryRaw`SELECT * FROM "KnowledgeDocument" WHERE "id"=${id}`;
  if (!document) throw fail(404, 'Knowledge source not found.');
  return document;
}
async function saveKnowledge(input, actorId) {
  const id = randomUUID(), hash = createHash('sha256').update(input.text).digest('hex');
  const chunks = chunkText(input.text);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('knowledge-ingestion'))`;
    const [quota] = await tx.$queryRaw`SELECT count(*)::int AS "documents",coalesce(sum(length("text")),0)::int AS "characters" FROM "KnowledgeDocument"`;
    if (quota.documents >= 200 || quota.characters + input.text.length > 5000000) throw fail(409, 'The knowledge library storage limit has been reached. Contact the database owner to review retention.');
    const [duplicate] = await tx.$queryRaw`SELECT "id" FROM "KnowledgeDocument" WHERE "contentHash"=${hash}`;
    if (duplicate) throw fail(409, 'This source content has already been uploaded, including archived sources.');
    await tx.$executeRaw`INSERT INTO "KnowledgeDocument" ("id","title","filename","format","text","contentHash","uploadedById") VALUES (${id},${input.title},${input.filename},${input.format},${input.text},${hash},${actorId})`;
    for (const chunk of chunks) await tx.$executeRaw`INSERT INTO "KnowledgeChunk" ("id","documentId","ordinal","text","searchText") VALUES (${randomUUID()},${id},${chunk.ordinal},${chunk.text},${input.title + '\n' + chunk.text})`;
    return { id, title: input.title, filename: input.filename, status: 'DRAFT', passages: chunks.length };
  }, { timeout: 20000 });
}
async function changeKnowledgeStatus(id, status, actorId) {
  if (!['DRAFT','APPROVED','ARCHIVED'].includes(status)) throw fail(400, 'Invalid source status.');
  const changed = await prisma.$executeRaw`UPDATE "KnowledgeDocument" SET "status"=${status},"approvedById"=${status === 'APPROVED' ? actorId : null},"approvedAt"=${status === 'APPROVED' ? new Date() : null} WHERE "id"=${id}`;
  if (!changed) throw fail(404, 'Knowledge source not found.');
}
async function retrieveKnowledge(query) {
  const terms = searchTerms(query);
  if (!terms.length) return [];
  const expression = terms.join(' OR ');
  const rows = await prisma.$queryRaw`
    WITH matches AS (
      SELECT c."id",c."documentId",c."ordinal",c."text",d."title",d."filename",d."version",d."contentHash",
        ts_rank_cd(to_tsvector('english',c."searchText"),websearch_to_tsquery('english',${expression})) AS "rank",
        row_number() OVER (PARTITION BY d."id" ORDER BY ts_rank_cd(to_tsvector('english',c."searchText"),websearch_to_tsquery('english',${expression})) DESC,c."ordinal") AS position
      FROM "KnowledgeChunk" c JOIN "KnowledgeDocument" d ON d."id"=c."documentId"
      WHERE d."status"='APPROVED' AND to_tsvector('english',c."searchText") @@ websearch_to_tsquery('english',${expression})
    ) SELECT * FROM matches WHERE position<=2 ORDER BY "rank" DESC,"documentId","ordinal" LIMIT 6`;
  return rows.map((row, i) => ({ sourceId: 'S' + (i + 1), chunkId: row.id, documentId: row.documentId, title: row.title, filename: row.filename, version: row.version, contentHash: row.contentHash, section: row.ordinal, text: row.text, rank: Number(row.rank) }));
}
async function assertSourcesCurrent(db, sources) {
  if (!Array.isArray(sources) || !sources.length || sources.length > 6) throw fail(409, 'This draft has no valid source snapshot. Generate it again.');
  for (const source of sources) {
    const [row] = await db.$queryRaw`SELECT "status","version","contentHash" FROM "KnowledgeDocument" WHERE "id"=${source.documentId} FOR SHARE`;
    if (!row || row.status !== 'APPROVED' || row.version !== source.version || row.contentHash !== source.contentHash) throw fail(409, 'A source was unapproved, archived, or changed. Generate a new draft from current approved sources.');
  }
}
module.exports = { listKnowledge, getKnowledge, saveKnowledge, changeKnowledgeStatus, retrieveKnowledge, assertSourcesCurrent, searchTerms };
