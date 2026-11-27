const {test}=require('node:test');const assert=require('node:assert/strict');const runtime=require('../src/services/terminalRuntime');
let captured,offline=false,noSources=false,badCitations=false,badExecutable=false,badOutput=false,mixedSupport=false,allAiAdded=false;
const sources=[{sourceId:'S1',documentId:'source-1',chunkId:'chunk-1',title:'Account recovery guide',filename:'account.txt',version:1,section:1,text:'Open the administrator session, inspect and unlock the account, reset its password and verify login.',contentHash:'hash'}];
require.cache[require.resolve('../src/services/knowledgeService')]={exports:{retrieveKnowledge:async()=>noSources?[]:sources}};
require.cache[require.resolve('../src/controllers/simulationDraftController')]={exports:{createStoredDraft:async(ownerId,input)=>({id:'saved-draft',ownerId,...input})}};
let generationCalls=0, minimalFields=false, aliasId=false, repairOnce=false, unsupportedActions=false, unavailableTask=false, guiDraft=false;
require.cache[require.resolve('../src/utils/openai')]={exports:{getAIProvider:()=> 'test',getDefaultModel:()=> 'test-model',getOpenAIClient:()=>offline?null:{chat:{completions:{create:async options=>{
 captured=options;generationCalls++;
 let definition=guiDraft?{title:'Windows desktop guide',surface:'windows-os',steps:['Open Settings','Inspect the printer','Verify printing'].map(title=>({title,instruction:title,sourceIds:['S1'],supportType:'source-backed'}))}:runtime.accountDefinition();
 definition.steps=definition.steps.map(step=>{
  const result={...step,sourceIds:allAiAdded||(mixedSupport&&step.actionId==='account.inspect')?[]:[badCitations?'S9':'S1'],...(allAiAdded||(mixedSupport&&step.actionId==='account.inspect')?{supportType:'ai-added'}:{}),...(badOutput?{expectedOutput:'Invented AI output'}:{}),...(badExecutable&&step.actionId==='account.inspect'?{command:'mkdir MyNewFolder',expectedCommands:['mkdir MyNewFolder']}: {})};
  if(minimalFields){delete result.type;delete result.command;delete result.expectedCommands;}
  if(aliasId&&step.actionId==='account.inspect')result.actionId='account.read-alias';
  if((unsupportedActions||(repairOnce&&generationCalls===1))&&step.actionId==='account.inspect'){result.actionId='network.unimplemented';result.command='unsupported-test-command';result.expectedCommands=['unsupported-test-command'];}
  return result;
 });
 return {choices:[{message:{content:JSON.stringify(unavailableTask?{unsupportedTerminalTask:true}:{title:'Account recovery',category:'Account',difficulty:'Easy',simulation:definition})}}]};
}}}}}};
const controller=require('../src/controllers/adminController');
const invoke=async(sourcePrompt='Windows Terminal unlock locked domain account using PowerShell',surface)=>{generationCalls=0;let payload;const response={status(){return this;},json(data){payload=data;return this;}};await controller.generateSimulationModuleDraft({user:{id:1},body:{mode:'from_prompt',sourcePrompt,...(surface?{surface}:{})}},response,error=>{throw error;});return payload;};
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

test('Wi-Fi troubleshooting variants pass alignment and still require approved evidence',async()=>{
 noSources=true;
 try{for(const prompt of ['HOW CAN I FIX WIFI ON MY COMPUTER?','How can I fix Wi-Fi on Windows 11?','Fix wi fi on my computer','Fix wireless on my computer','Troubleshoot wifi using PowerShell']){
  await assert.rejects(invoke(prompt),error=>error.status===422,'Wi-Fi prompts must reach retrieval instead of domain rejection');
 }}finally{noSources=false;}
});
test('unsupported platforms, physical repairs, unrelated tasks and short requests retain clear rejection reasons',async()=>{
 for(const [prompt,reason] of [['Create a folder on Ubuntu','unsupported platform'],['Replace a broken laptop screen','physical hardware repair'],['Write a poem about summer','supported IT troubleshooting domain'],['folder','too short']]){
  const result=await invoke(prompt);
  assert.equal(result.code,'SIMULATION_PROMPT_UNSUPPORTED');
  assert.ok(result.message.includes(reason),result.message);
  assert.equal(result.draft,undefined);
 }
});
test('Mac simulation prompts are rejected before retrieval or generation',async()=>{
 for(const prompt of ['Create a folder in Mac Terminal','Recover account permissions on macOS']){
  const result=await invoke(prompt);assert.equal(result.code,'SIMULATION_PROMPT_UNSUPPORTED');assert.equal(result.draft,undefined);assert.match(result.message,/Windows Terminal and Windows 11/);
 }
 const result=await invoke('Windows Terminal inspect MAC address network');assert.ok(result.draft);
});
test('AI cannot pair a folder command with an account action in a saved draft',async()=>{
 badExecutable=true;
 try{await assert.rejects(invoke,error=>error.status===422&&error.publicMessage.includes('Step 2: expectedCommands'));}
 finally{badExecutable=false;}
});

test('known actions derive missing fields and exact commands resolve unknown IDs',async()=>{
 minimalFields=true;
 try{const result=await invoke();assert.equal(generationCalls,1);assert.deepEqual(runtime.validateDefinition(result.draft.simulation),[]);assert.equal(result.draft.simulation.steps[0].type,'checkpoint');}finally{minimalFields=false;}
 aliasId=true;
 try{const result=await invoke();assert.equal(generationCalls,1);assert.equal(result.draft.simulation.steps[1].actionId,'account.inspect');}finally{aliasId=false;}
});

test('invalid executable generation receives exactly one automatic correction',async()=>{
 repairOnce=true;
 try{const result=await invoke();assert.equal(generationCalls,2);assert.equal(result.draft.generationMeta.generationAttempts,2);assert.deepEqual(runtime.validateDefinition(result.draft.simulation),[]);assert.ok(JSON.parse(captured.messages[2].content).validationErrors.some(error=>error.includes('unsupported action')));assert.equal(JSON.parse(captured.messages[1].content).referencePassages[0].sourceId,'S1');}finally{repairOnce=false;}
 unsupportedActions=true;
 try{await assert.rejects(invoke,error=>error.status===422&&error.publicMessage.includes('one automatic correction'));assert.equal(generationCalls,2);}finally{unsupportedActions=false;}
 unavailableTask=true;
 try{await assert.rejects(invoke,error=>error.status===422&&error.publicMessage.includes('does not implement'));assert.equal(generationCalls,1);}finally{unavailableTask=false;}
});

test('an expired AI request deadline prevents generation and correction calls',async()=>{
 await require('../src/services/aiRequestContext').context.run({signal:AbortSignal.abort()},async()=>{await assert.rejects(invoke,error=>error.status===504);assert.equal(generationCalls,0);});
});

test('Windows desktop prompts route to the lab and explicit environment selection is honored',async()=>{
 guiDraft=true;
 try{for(const prompt of ['Windows 11 printer offline troubleshooting','Fix a stuck print queue in Windows 11','Inspect startup applications in Task Manager']){const result=await invoke(prompt);assert.equal(result.recommendedSurface,'windows-os');assert.equal(result.draft.simulation.surface,'windows-os');assert.equal(generationCalls,1);}}finally{guiDraft=false;}
 const terminal=await invoke('Windows 11 network troubleshooting','windows-terminal');assert.equal(terminal.recommendedSurface,'windows-terminal');
 guiDraft=true;
 try{const desktop=await invoke('Printer troubleshooting using Windows Terminal','windows-os');assert.equal(desktop.recommendedSurface,'windows-os');}finally{guiDraft=false;}
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




