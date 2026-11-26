const prisma=require('../prisma');
const jwt=require('jsonwebtoken');
const {createHash}=require('crypto');
const fail=message=>Object.assign(new Error(message),{status:409,publicMessage:message});
async function plan(db,action,ids){
 const unique=[...new Set(ids)].sort(),json=JSON.stringify(unique);
 const selected=await db.$queryRaw`SELECT "id","title","version","status",coalesce("familyId","id") AS "familyId" FROM "KnowledgeDocument" WHERE "id" IN (SELECT jsonb_array_elements_text(${json}::jsonb)) ORDER BY "id"`;
 if(selected.length!==unique.length)throw fail('A selected source no longer exists. Refresh and select the sources again.');
 if(action==='approve'&&selected.some(source=>source.status!=='DRAFT'))throw fail('Select only sources that need review for batch approval.');
 if(action==='archive'&&selected.some(source=>source.status==='ARCHIVED'))throw fail('An already archived source was selected. Refresh your selection.');
 const families=JSON.stringify([...new Set(selected.map(source=>source.familyId))]);
 if(action==='approve'&&new Set(selected.map(source=>source.familyId)).size!==selected.length)throw fail('Approve only one version of each source at a time.');
 const versions=await db.$queryRaw`SELECT "id","title","version","status","contentHash" FROM "KnowledgeDocument" WHERE coalesce("familyId","id") IN (SELECT jsonb_array_elements_text(${families}::jsonb)) ORDER BY "id"`;
 const affected=action==='delete'?versions:selected;
 const affectedIds=JSON.stringify(affected.map(source=>source.id));
 const [counts]=await db.$queryRaw`SELECT (SELECT count(*)::int FROM "KnowledgeChunk" WHERE "documentId" IN (SELECT jsonb_array_elements_text(${affectedIds}::jsonb))) AS passages,(SELECT count(*)::int FROM "SimulationModule" m WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(m."provenance"->'rag'->'sources','[]'::jsonb)) s WHERE s->>'documentId' IN (SELECT jsonb_array_elements_text(${affectedIds}::jsonb)))) AS modules`;
 return {selected,versions,affected,counts,fingerprint:createHash('sha256').update(JSON.stringify(versions)).digest('hex')};
}
const jwtOptions={audience:'knowledge-batch',issuer:'helpdesk-security'};
async function preview(action,ids,userId){
 const result=await plan(prisma,action,ids);
 const token=jwt.sign({purpose:'knowledge-batch',userId,action,ids:[...new Set(ids)].sort(),fingerprint:result.fingerprint},process.env.JWT_ACCESS_SECRET,{...jwtOptions,algorithm:'HS256',expiresIn:'10m'});
 return {action,documents:result.selected.map(({id,title,version,status})=>({id,title,version,status})),affectedVersions:result.affected.length,passages:result.counts.passages,usedByCount:result.counts.modules,retiredVersions:action==='approve'?result.versions.filter(source=>source.status==='APPROVED').length:0,token};
}
async function apply(input,userId){
 let proof;
 try{proof=jwt.verify(input.token,process.env.JWT_ACCESS_SECRET,{...jwtOptions,algorithms:['HS256']});}catch{throw fail('The batch preview expired or changed. Review the selection again.');}
 if(proof.purpose!=='knowledge-batch'||proof.userId!==userId||!['approve','archive','delete'].includes(proof.action))throw fail('Invalid batch preview.');
 if(proof.action==='approve'&&input.reviewConfirmed!==true)throw fail('Confirm that every selected source was reviewed before approval.');
 if(proof.action==='delete'&&input.confirmation!=='DELETE')throw fail('Type DELETE to confirm permanent deletion.');
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('knowledge-ingestion'))`;
  const result=await plan(tx,proof.action,proof.ids);
  if(result.fingerprint!==proof.fingerprint)throw fail('A selected source or version changed. Review the batch again. No changes were made.');
  const ids=JSON.stringify(result.affected.map(source=>source.id));
  if(proof.action==='delete')await tx.$executeRaw`DELETE FROM "KnowledgeDocument" WHERE "id" IN (SELECT jsonb_array_elements_text(${ids}::jsonb))`;
  else{
   if(proof.action==='approve'){
    const retired=JSON.stringify(result.versions.filter(source=>source.status==='APPROVED').map(source=>source.id));
    await tx.$executeRaw`UPDATE "KnowledgeDocument" SET "status"='ARCHIVED',"approvedById"=NULL,"approvedAt"=NULL WHERE "id" IN (SELECT jsonb_array_elements_text(${retired}::jsonb))`;
   }
   const status=proof.action==='approve'?'APPROVED':'ARCHIVED';
   await tx.$executeRaw`UPDATE "KnowledgeDocument" SET "status"=${status},"approvedById"=${status==='APPROVED'?userId:null},"approvedAt"=${status==='APPROVED'?new Date():null} WHERE "id" IN (SELECT jsonb_array_elements_text(${ids}::jsonb))`;
  }
  return {action:proof.action,changed:result.affected.length};
 },{timeout:30000});
}
module.exports={preview,apply};
