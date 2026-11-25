const {test}=require('node:test');const assert=require('node:assert/strict');
const {publicationProvenance,checkCitations}=require('../src/services/ragPublication');
const sources=[{sourceId:'S1',documentId:'doc-1',version:1,contentHash:'hash',text:'Approved procedure'}];
const simulation={surface:'windows-os',title:'Test',steps:[{title:'Inspect',sourceIds:['S1']}]};
const draft={id:'draft',ownerId:1,version:2,state:'DRAFT',generation:{rag:{method:'postgres-full-text',sources}}};
const tx={simulationDraft:{findUnique:async()=>draft},$queryRaw:async()=>[{status:'APPROVED',version:1,contentHash:'hash'}]};
test('mixed RAG steps allow explicit AI additions while rejecting fabricated support',async()=>{
 const mixed={...simulation,steps:[{title:'Document procedure',supportType:'source-backed',sourceIds:['S1']},{title:'AI explanation',supportType:'ai-added',sourceIds:[]}]};
 assert.doesNotThrow(()=>checkCitations(mixed,sources));
 for(const step of [{sourceIds:[]},{supportType:'ai-added',sourceIds:['S1']},{supportType:'ai-added',sourceIds:['S9']},{supportType:'unknown',sourceIds:['S1']}])assert.throws(()=>checkCitations({...mixed,steps:[mixed.steps[0],step]},sources));
 assert.throws(()=>checkCitations({...mixed,steps:[mixed.steps[1]]},sources),/At least one step/);
 const p=await publicationProvenance(tx,{draftId:'draft',draftVersion:2,testedById:1,sourceReviewConfirmed:true},mixed);
 assert.equal(p.definitionHash,require('../src/services/terminalRuntime').definitionHash(mixed));
 const normalized=require('../src/store/simulationModuleStore').normalizeSimulation(mixed);
 assert.equal(normalized.steps[1].supportType,'ai-added');
 assert.deepEqual(normalized.steps[1].sourceIds,[]);
});
test('RAG publication requires a current owned draft and explicit source review',async()=>{
 const input={draftId:'draft',draftVersion:2,testedById:1};
 await assert.rejects(()=>publicationProvenance(tx,input,simulation),/Review the source/);
 await assert.rejects(()=>publicationProvenance(tx,{...input,testedById:2,sourceReviewConfirmed:true},simulation),/draft changed/);
 const provenance=await publicationProvenance(tx,{...input,sourceReviewConfirmed:true},simulation);
 assert.equal(provenance.reviewedById,1);assert.deepEqual(provenance.rag.sources,sources);assert.ok(provenance.definitionHash);
});
test('invalid citations and revoked sources block publication',async()=>{
 assert.throws(()=>checkCitations({...simulation,steps:[{sourceIds:['S9']}]},sources));
 const revoked={...tx,$queryRaw:async()=>[{status:'DRAFT',version:1,contentHash:'hash'}]};
 await assert.rejects(()=>publicationProvenance(revoked,{draftId:'draft',draftVersion:2,testedById:1,sourceReviewConfirmed:true},simulation),/unapproved/);
});
test('manual modules stay manual; source-backed modules cannot discard provenance through direct edits',async()=>{
 assert.equal(await publicationProvenance(tx,{},simulation),null);
 await assert.rejects(()=>publicationProvenance(tx,{simulation},simulation,{provenance:{rag:{sources}}}),/saved draft/);
});
