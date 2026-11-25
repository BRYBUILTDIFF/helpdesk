const {test}=require('node:test');const assert=require('node:assert/strict');const runtime=require('../src/services/terminalRuntime');
let captured,offline=false,noSources=false,badCitations=false,badExecutable=false,badOutput=false,mixedSupport=false,allAiAdded=false;
const sources=[{sourceId:'S1',documentId:'source-1',chunkId:'chunk-1',title:'Account recovery guide',filename:'account.txt',version:1,section:1,text:'Open the administrator session, inspect and unlock the account, reset its password and verify login.',contentHash:'hash'}];
require.cache[require.resolve('../src/services/knowledgeService')]={exports:{retrieveKnowledge:async()=>noSources?[]:sources}};
require.cache[require.resolve('../src/controllers/simulationDraftController')]={exports:{createStoredDraft:async(ownerId,input)=>({id:'saved-draft',ownerId,...input})}};
require.cache[require.resolve('../src/utils/openai')]={exports:{getAIProvider:()=> 'test',getDefaultModel:()=> 'test-model',getOpenAIClient:()=>offline?null:{chat:{completions:{create:async options=>{captured=options;return {choices:[{message:{content:JSON.stringify({title:'Account recovery',category:'Account',difficulty:'Easy',simulation:{...runtime.accountDefinition(),steps:runtime.accountDefinition().steps.map(step=>({...step,sourceIds:allAiAdded||(mixedSupport&&step.actionId==='account.inspect')?[]:[badCitations?'S9':'S1'],...(allAiAdded||(mixedSupport&&step.actionId==='account.inspect')?{supportType:'ai-added'}:{}),...(badOutput?{expectedOutput:'Invented AI output'}:{}),...(badExecutable&&step.actionId==='account.inspect'?{command:'mkdir MyNewFolder',expectedCommands:['mkdir MyNewFolder']}: {})}))}})}}]};}}}}}};
const controller=require('../src/controllers/adminController');
const invoke=async(sourcePrompt='Windows Terminal unlock locked domain account using PowerShell')=>{let payload;const response={status(){return this;},json(data){payload=data;return this;}};await controller.generateSimulationModuleDraft({user:{id:1},body:{mode:'from_prompt',sourcePrompt}},response,error=>{throw error;});return payload;};
test('AI generation includes executable action contract and preserves assessments in its draft',async()=>{
 const result=await invoke();assert.ok(captured.messages[0].content.includes('expectedCommands'));assert.ok(captured.messages[0].content.includes('account.unlock'));assert.equal(result.draft.simulation.steps[0].type,'checkpoint');assert.equal(result.draft.simulation.steps[2].actionId,'account.unlock');assert.deepEqual(result.draft.simulation.steps[2].expectedCommands,['Unlock-ADAccount -Identity jdoe']);assert.deepEqual(runtime.validateDefinition(result.draft.simulation),[]);assert.equal(result.draft.generationSource,'ai');assert.equal(result.draftRecord.ownerId,1);assert.equal(result.draftRecord.generation.promptVersion,'simulation-rag-v1');
 let state=runtime.initialState();
 for(const step of result.draft.simulation.steps){const action=runtime.execute(step.actionId,state);assert.equal(step.expectedOutput,action.output);state=action.state;}
});
test('unavailable AI fails closed rather than creating an ungrounded template',async()=>{
 offline=true;try{await assert.rejects(invoke,error=>error.status===503);}finally{offline=false;}
});
test('no evidence prevents generation and invented citations are rejected',async()=>{
 noSources=true;try{await assert.rejects(invoke,error=>error.status===422);}finally{noSources=false;}
 badCitations=true;try{await assert.rejects(invoke,error=>error.status===503);}finally{badCitations=false;}
});
test('retrieved passages are data in the generation request and persisted in the saved draft',async()=>{
 const result=await invoke();const input=JSON.parse(captured.messages[1].content);assert.equal(input.referencePassages[0].sourceId,'S1');assert.ok(captured.messages[0].content.includes('untrusted reference DATA'));assert.deepEqual(result.draftRecord.generation.rag.sources,sources);assert.deepEqual(result.draft.simulation.steps[0].sourceIds,['S1']);
});
test('file-management prompts reach source-backed generation instead of the old domain rejection',async()=>{
 for(const prompt of ['Create and verify a folder in Windows Terminal','Manage files and directories in Windows Terminal']){
  const result=await invoke(prompt);
  assert.ok(result.draftRecord);
  assert.equal(JSON.parse(captured.messages[1].content).request,prompt);
 }
});
test('unsupported platforms, physical repairs, unrelated tasks and short requests retain clear rejection reasons',async()=>{
 for(const [prompt,reason] of [['Create a folder on Ubuntu','unsupported platform'],['Replace a broken laptop screen','physical hardware repair'],['Write a poem about summer','supported IT troubleshooting domain'],['folder','too short']]){
  const result=await invoke(prompt);
  assert.equal(result.code,'SIMULATION_PROMPT_UNSUPPORTED');
  assert.ok(result.message.includes(reason),result.message);
  assert.equal(result.draft,undefined);
 }
});
test('AI cannot pair a folder command with an account action in a saved draft',async()=>{
 badExecutable=true;
 try{await assert.rejects(invoke,error=>error.status===422&&error.publicMessage.includes('Step 2: expectedCommands'));}
 finally{badExecutable=false;}
});
test('generated expected outputs come from the simulator rather than AI text',async()=>{
 badOutput=true;
 try{
  const result=await invoke();
  assert.equal(result.draft.simulation.steps[0].expectedOutput,'Simulated administrator session opened.');
  assert.match(result.draft.simulation.steps[1].expectedOutput,/LockedOut: true/);
  assert.match(result.draft.simulation.steps[4].expectedOutput,/LockedOut: false/);
  assert.deepEqual(runtime.validateDefinition(result.draft.simulation),[]);
 }finally{badOutput=false;}
});
test('mixed source-backed and AI-added generation preserves honest evidence labels',async()=>{
 mixedSupport=true;
 try{
  const result=await invoke();
  assert.equal(result.draft.simulation.steps[1].supportType,'ai-added');
  assert.deepEqual(result.draft.simulation.steps[1].sourceIds,[]);
  assert.equal(result.draft.simulation.steps[0].supportType,'source-backed');
  assert.ok(captured.messages[0].content.includes('may supplement'));
  assert.deepEqual(runtime.validateDefinition(result.draft.simulation),[]);
 }finally{mixedSupport=false;}
 allAiAdded=true;
 try{await assert.rejects(invoke,error=>error.status===503);}
 finally{allAiAdded=false;}
});




