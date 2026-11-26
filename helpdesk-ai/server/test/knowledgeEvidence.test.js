const {test}=require('node:test');const assert=require('node:assert/strict');
let revoked=false,checked;
require.cache[require.resolve('../src/services/knowledgeService')]={exports:{assertSourcesCurrent:async(db,sources)=>{checked=sources;if(revoked)throw Object.assign(new Error('Source was archived'),{status:409});}}};
const evidence=require('../src/services/knowledgeEvidence');
test('evidence preview binds exact passages, query, owner and expiration',async()=>{
 const secret=process.env.JWT_ACCESS_SECRET;process.env.JWT_ACCESS_SECRET='local-evidence-unit-test-secret';
 const sources=[{sourceId:'S1',documentId:'doc',text:'The exact passage the admin saw',version:1}];
 try{
  const token=evidence.createEvidenceToken('Create folder',7,sources);
  assert.deepEqual(await evidence.readEvidenceToken(token,'Create folder',7),sources);assert.deepEqual(checked,sources);
  for(const args of [[token,'Create folder',8],[token,'Different request',7],[token+'tampered','Create folder',7]])await assert.rejects(()=>evidence.readEvidenceToken(...args),error=>error.status===409);
  const now=Date.now;try{Date.now=()=>now()+11*60*1000;await assert.rejects(()=>evidence.readEvidenceToken(token,'Create folder',7),error=>error.status===409);}finally{Date.now=now;}
  revoked=true;await assert.rejects(()=>evidence.readEvidenceToken(token,'Create folder',7),error=>error.status===409);
 }finally{revoked=false;if(secret===undefined)delete process.env.JWT_ACCESS_SECRET;else process.env.JWT_ACCESS_SECRET=secret;}
});
