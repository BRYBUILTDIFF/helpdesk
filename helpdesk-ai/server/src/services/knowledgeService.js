const { randomUUID, createHash } = require('node:crypto');
const prisma = require('../prisma');
const { chunkText } = require('./knowledgeExtraction');
const fail = (status, message) => Object.assign(new Error(message), { status, publicMessage: message });
const searchTerms = query => [...new Set((String(query).toLowerCase().match(/[a-z0-9][a-z0-9-]{2,40}/g) || []).filter(term => !new Set('create generate simulation steps scenario troubleshooting guide please help how what using with from this that have does about want need'.split(' ')).has(term)))].slice(0, 16);
async function listKnowledge() {
  return prisma.$queryRaw`SELECT d."id",d."title",d."filename",d."format",d."version",d."familyId",d."status",d."createdAt",d."approvedAt",length(d."text") AS "characters",(SELECT count(*)::int FROM "KnowledgeChunk" c WHERE c."documentId"=d."id") AS "passages",(SELECT count(*)::int FROM "SimulationModule" m WHERE m."provenance"->'rag'->'sources' @> jsonb_build_array(jsonb_build_object('documentId',d."id"))) AS "usedByCount" FROM "KnowledgeDocument" d ORDER BY d."createdAt" DESC LIMIT 200`;
}
async function getKnowledge(id) {
  const [document] = await prisma.$queryRaw`SELECT * FROM "KnowledgeDocument" WHERE "id"=${id}`;
  if (!document) throw fail(404, 'Knowledge source not found.');
  const usedBy=await prisma.$queryRaw`SELECT "id","title","enabled" FROM "SimulationModule" WHERE "provenance"->'rag'->'sources' @> jsonb_build_array(jsonb_build_object('documentId',${id})) ORDER BY "title"`;
  const versions=await prisma.$queryRaw`SELECT "id","title","version","status","createdAt" FROM "KnowledgeDocument" WHERE coalesce("familyId","id")=${document.familyId||document.id} ORDER BY "version" DESC`;
  return {...document,usedBy,versions};
}
async function saveKnowledge(input, actorId, previousId) {
  const id = randomUUID(), hash = createHash('sha256').update(input.text).digest('hex');
  const chunks = chunkText(input.text);
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('knowledge-ingestion'))`;
    let familyId=id,version=1,title=input.title;
    if(previousId){
      const [previous]=await tx.$queryRaw`SELECT "id","familyId","title" FROM "KnowledgeDocument" WHERE "id"=${previousId}`;
      if(!previous)throw fail(404,'The source to update no longer exists. Refresh the library.');
      familyId=previous.familyId||previous.id;title=previous.title;
      const [latest]=await tx.$queryRaw`SELECT max("version") AS "version" FROM "KnowledgeDocument" WHERE coalesce("familyId","id")=${familyId}`;
      version=latest.version+1;
    }
    const [quota] = await tx.$queryRaw`SELECT count(*)::int AS "documents",coalesce(sum(length("text")),0)::int AS "characters" FROM "KnowledgeDocument"`;
    if (quota.documents >= 200 || quota.characters + input.text.length > 5000000) throw fail(409, 'The knowledge library storage limit has been reached. Contact the database owner to review retention.');
    const [duplicate] = await tx.$queryRaw`SELECT "id" FROM "KnowledgeDocument" WHERE "contentHash"=${hash}`;
    if (duplicate) {const error=fail(409, 'This content already exists. Open the existing source; restore it to draft if archived.');error.existingDocumentId=duplicate.id;throw error;}
    await tx.$executeRaw`INSERT INTO "KnowledgeDocument" ("id","title","filename","format","text","contentHash","uploadedById","familyId","version") VALUES (${id},${title},${input.filename},${input.format},${input.text},${hash},${actorId},${familyId},${version})`;
    for (const chunk of chunks) await tx.$executeRaw`INSERT INTO "KnowledgeChunk" ("id","documentId","ordinal","text","searchText") VALUES (${randomUUID()},${id},${chunk.ordinal},${chunk.text},${title + '\n' + chunk.text})`;
    return { id, title, filename: input.filename, version, status: 'DRAFT', passages: chunks.length };
  }, { timeout: 20000 });
}
async function changeKnowledgeStatus(id, status, actorId) {
  if (!['DRAFT','APPROVED','ARCHIVED'].includes(status)) throw fail(400, 'Invalid source status.');
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('knowledge-ingestion'))`;
    const [source]=await tx.$queryRaw`SELECT "id","familyId" FROM "KnowledgeDocument" WHERE "id"=${id}`;
    if(!source)throw fail(404,'Knowledge source not found.');
    if(status==='APPROVED')await tx.$executeRaw`UPDATE "KnowledgeDocument" SET "status"='ARCHIVED',"approvedById"=NULL,"approvedAt"=NULL WHERE coalesce("familyId","id")=${source.familyId||source.id} AND "id"<>${id} AND "status"='APPROVED'`;
    await tx.$executeRaw`UPDATE "KnowledgeDocument" SET "status"=${status},"approvedById"=${status === 'APPROVED' ? actorId : null},"approvedAt"=${status === 'APPROVED' ? new Date() : null} WHERE "id"=${id}`;
  });
}
async function renameKnowledge(id,title){
  const safe=require('../utils/security').plainDescription(title).trim().slice(0,180);
  if(!safe)throw fail(400,'A document title is required.');
  await prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('knowledge-ingestion'))`;
    const changed=await tx.$executeRaw`UPDATE "KnowledgeDocument" SET "title"=${safe} WHERE "id"=${id}`;
    if(!changed)throw fail(404,'Knowledge source not found.');
    await tx.$executeRaw`UPDATE "KnowledgeChunk" SET "searchText"=${safe} || E'\n' || "text" WHERE "documentId"=${id}`;
  });
}
async function sourceDeletionPreview(id,db=prisma){
  const [source]=await db.$queryRaw`SELECT "id","title",coalesce("familyId","id") AS "familyId" FROM "KnowledgeDocument" WHERE "id"=${id}`;
  if(!source)throw fail(404,'Knowledge source not found.');
  const versions=await db.$queryRaw`SELECT "id","version","status" FROM "KnowledgeDocument" WHERE coalesce("familyId","id")=${source.familyId} ORDER BY "version"`;
  const documentIds=JSON.stringify(versions.map(version=>version.id));
  const [chunks]=await db.$queryRaw`SELECT count(*)::int AS "count" FROM "KnowledgeChunk" WHERE "documentId" IN (SELECT jsonb_array_elements_text(${documentIds}::jsonb))`;
  const modules=await db.$queryRaw`SELECT "id","title","enabled" FROM "SimulationModule" m WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(m."provenance"->'rag'->'sources','[]'::jsonb)) s WHERE s->>'documentId' IN (SELECT jsonb_array_elements_text(${documentIds}::jsonb))) ORDER BY "title"`;
  const [drafts]=await db.$queryRaw`SELECT count(*)::int AS "count" FROM "SimulationDraft" d WHERE d."state"='DRAFT' AND EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(d."generation"->'rag'->'sources','[]'::jsonb)) s WHERE s->>'documentId' IN (SELECT jsonb_array_elements_text(${documentIds}::jsonb)))`;
  return {id:source.id,title:source.title,versions,passages:chunks.count,modules,draftCount:drafts.count};
}
async function deleteKnowledge(id,expectedDocumentIds){
  return prisma.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('knowledge-ingestion'))`;
    const preview=await sourceDeletionPreview(id,tx);
    const current=preview.versions.map(version=>version.id).sort();
    if(!Array.isArray(expectedDocumentIds)||JSON.stringify([...new Set(expectedDocumentIds)].sort())!==JSON.stringify(current))throw fail(409,'Source versions changed. Close this confirmation and review the deletion again.');
    // Publication takes shared locks on source rows. Deletion waits for those
    // transactions; source chunks are removed by the existing cascade FK.
    const ids=JSON.stringify(current);
    const deleted=await tx.$executeRaw`DELETE FROM "KnowledgeDocument" WHERE "id" IN (SELECT jsonb_array_elements_text(${ids}::jsonb))`;
    return {deletedVersions:deleted,deletedPassages:preview.passages};
  });
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
module.exports = { listKnowledge, getKnowledge, saveKnowledge, changeKnowledgeStatus, renameKnowledge, sourceDeletionPreview, deleteKnowledge, retrieveKnowledge, assertSourcesCurrent, searchTerms };
