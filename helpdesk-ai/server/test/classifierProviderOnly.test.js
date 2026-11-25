const {test}=require('node:test');const assert=require('node:assert/strict');
test('Render can skip local Ollama without bypassing provider classification',async()=>{
 const previous=process.env.POLICY_LOCAL_CLASSIFIER_ENABLED;process.env.POLICY_LOCAL_CLASSIFIER_ENABLED='false';let called=0;
 global.fetch=async()=>{throw Error('Local Ollama must not be contacted');};
 require.cache[require.resolve('../src/utils/openai')]={exports:{getAIProvider:()=> 'deepseek',getDefaultModel:()=> 'deepseek-flash',getOpenAIClient:()=>({chat:{completions:{create:async request=>{called++;assert.equal(request.model,'deepseek-flash');assert.deepEqual(request.thinking,{type:'disabled'});return {choices:[{message:{content:JSON.stringify({classification:'in_scope',confidence:0.99,reason:'IT support'})}}]};}}}})}};
 try{const {classifyWithDeepSeek}=require('../src/policy/promptPolicy');assert.equal((await classifyWithDeepSeek('Printer offline',[],{})).classification,'in_scope');assert.equal(called,1);}finally{if(previous===undefined)delete process.env.POLICY_LOCAL_CLASSIFIER_ENABLED;else process.env.POLICY_LOCAL_CLASSIFIER_ENABLED=previous;}
});
