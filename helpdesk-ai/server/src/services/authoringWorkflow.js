const prisma = require('../prisma');
const runtime = require('./terminalRuntime');
const fail = message => Object.assign(new Error(message), {status:409,publicMessage:message});
const normalize = definition => require('../store/simulationModuleStore').normalizeSimulation(definition);
const labId = (draft,hash) => 'authoring-lab-'+draft.id+'-'+hash.slice(0,12);
async function owned(id,ownerId,db=prisma) {
 const draft=await db.simulationDraft.findFirst({where:{id,ownerId,state:'DRAFT'}});
 if(!draft)throw Object.assign(fail('Draft not found.'),{status:404});
 return draft;
}
async function state(draft,db=prisma) {
 const definition=normalize(draft.simulation),hash=runtime.definitionHash(definition);
 let reviewed=!draft.generation?.rag || draft.generation?.workflow?.reviewHash===hash;
 if(reviewed&&draft.generation?.rag){try{await require('./knowledgeService').assertSourcesCurrent(db,draft.generation.rag.sources);}catch(error){if(error.status===409)reviewed=false;else throw error;}}
 const receipt=await db.simulationTestReceipt.findFirst({where:{actorId:draft.ownerId,definitionHash:hash,expiresAt:{gt:new Date()}},orderBy:{createdAt:'desc'}});
 const tested=!!receipt&&receipt.stepsCompleted===definition.steps.length;
 return {definition,hash,reviewed,status:reviewed&&tested?'READY_TO_PUBLISH':'DRAFT',test:tested?{
  definition,nextStep:receipt.stepsCompleted,mistakes:receipt.mistakes,completed:true,
  output:receipt.events[receipt.events.length-1]?.output||'',expiresAt:receipt.expiresAt,
  testReceiptId:receipt.id,testToken:runtime.signTest(definition,draft.ownerId,receipt.id),
  verification:definition.surface==='windows-os'?'admin-confirmed':'automatic'
 }:null};
}
async function review(id,ownerId,version,confirmed) {
 return prisma.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`authoring:${id}`}))`;
  const draft=await owned(id,ownerId,tx);
  const hash=runtime.definitionHash(normalize(draft.simulation));
  if(confirmed&&draft.generation?.rag){
   require('./ragPublication').checkCitations(normalize(draft.simulation),draft.generation.rag.sources);
   await require('./knowledgeService').assertSourcesCurrent(tx,draft.generation.rag.sources);
  }
  const changed=await tx.simulationDraft.updateMany({where:{id,ownerId,version,state:'DRAFT'},data:{generation:{...draft.generation,workflow:{...draft.generation?.workflow,reviewHash:confirmed?hash:null,reviewedAt:confirmed?new Date().toISOString():null}}}});
  if(!changed.count)throw fail('The draft changed. Save your latest edits and review again.');
  return {reviewed:confirmed};
 });
}
async function prepareLab(id,ownerId,version) {
 const draft=await owned(id,ownerId),workflow=await state(draft);
 if(draft.version!==version||!workflow.reviewed)throw fail('Save the latest draft and review its evidence before testing.');
 if(workflow.definition.surface!=='windows-os')throw fail('This draft uses the terminal test.');
 const moduleId=labId(draft,workflow.hash);
 // A private disabled copy satisfies the existing session relation without changing the published module.
 await prisma.simulationModule.upsert({where:{id:moduleId},update:{},create:{id:moduleId,title:draft.title,category:draft.category,difficulty:draft.difficulty,enabled:false,simulation:workflow.definition,createdById:ownerId,provenance:{authoringTest:{draftId:id,ownerId,definitionHash:workflow.hash}}}});
 return {moduleId,definition:workflow.definition};
}
async function confirmLab(id,ownerId,input) {
 return prisma.$transaction(async tx=>{
  const draft=await owned(id,ownerId,tx),workflow=await state(draft,tx);
  if(draft.version!==input.version||!workflow.reviewed||workflow.definition.surface!=='windows-os')throw fail('The draft changed. Review and test the current version.');
  const session=await tx.simulationSession.findFirst({where:{id:input.sessionId,userId:ownerId,moduleId:labId(draft,workflow.hash),status:{in:['READY','ACTIVE']},expiresAt:{gt:new Date()}}});
  if(!session)throw fail('Open this draft in a live Windows test workspace before confirming the test.');
  const indexes=new Set(input.completedSteps);
  if(input.confirmed!==true||indexes.size!==workflow.definition.steps.length||workflow.definition.steps.some((_,i)=>!indexes.has(i)))throw fail('Follow and confirm every step in the Windows lab before finishing the test.');
  const receipt=await tx.simulationTestReceipt.create({data:{actorId:ownerId,definitionHash:workflow.hash,definition:workflow.definition,events:[{kind:'admin-lab-confirmation',sessionId:session.id,completedSteps:[...indexes],at:new Date().toISOString(),output:'Administrator confirmed all Windows lab steps. OS actions are not automatically verified.'}],mistakes:0,stepsCompleted:indexes.size,expiresAt:new Date(Date.now()+3600000)}});
  return {testReceiptId:receipt.id,verification:'admin-confirmed'};
 });
}
async function publish(id,ownerId,version) {
 const draft=await owned(id,ownerId),workflow=await state(draft);
 if(draft.version!==version)throw fail('The draft changed. Save the latest version before publishing.');
 if(!workflow.reviewed)throw fail('Review the evidence for this version before publishing.');
 if(!workflow.test)throw fail('Complete the test for this version before publishing.');
 const payload={workflowPublish:true,title:draft.title,category:draft.category,difficulty:draft.difficulty,sourcePrompt:draft.sourcePrompt,simulation:workflow.definition,enabled:true,draftId:id,draftVersion:version,baseRevision:draft.generation?.baseRevision,sourceReviewConfirmed:workflow.reviewed,testToken:workflow.test.testToken,testedById:ownerId};
 const store=require('../store/simulationModuleStore');
 const module=draft.moduleId?await store.updateModule(draft.moduleId,payload):await store.createModule(payload);
 return {module};
}
module.exports={owned,state,review,prepareLab,confirmLab,publish};
