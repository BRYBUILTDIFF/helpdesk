const {test,beforeEach,afterEach}=require('node:test');const assert=require('node:assert/strict');
const previousLocal=process.env.POLICY_LOCAL_CLASSIFIER_ENABLED;process.env.POLICY_LOCAL_CLASSIFIER_ENABLED='false';
let requests,responses,providerError,onRequest;
const decision=(classification='in_scope',confidence=0.99)=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify({classification,confidence,reason:'Classified in conversation context'})}}]});
require.cache[require.resolve('../src/utils/openai')]={exports:{getAIProvider:()=> 'deepseek',getDefaultModel:()=> 'deepseek-flash',getOpenAIClient:()=>({chat:{completions:{create:async(request,options)=>{requests.push({request,options});if(onRequest)onRequest();if(providerError)throw providerError;return responses.shift()||decision();}}}})}};
require.cache[require.resolve('../src/store/policyConfigStore')]={exports:{getPolicyRuntimeConfig:async()=>({messages:{outOfScopeMessage:'Please ask an IT question.'}})}};
require.cache[require.resolve('../src/policy/contentSafety')]={exports:{evaluateContentSafety:async()=>null}};
const {evaluatePromptPolicy}=require('../src/policy/promptPolicy');
const history=[{role:'user',content:'My work VPN will not connect.'},{role:'assistant',content:'Restart the VPN client. Does it work now?'}];
beforeEach(()=>{requests=[];responses=[];providerError=null;onRequest=null;});
afterEach(()=>{onRequest=null;});
process.on('exit',()=>{if(previousLocal===undefined)delete process.env.POLICY_LOCAL_CLASSIFIER_ENABLED;else process.env.POLICY_LOCAL_CLASSIFIER_ENABLED=previousLocal;});
test('follow-up history is quoted data, never assistant turns in the classifier conversation',async()=>{
 const result=await evaluatePromptPolicy('It still does not work',history);
 assert.equal(result.code,'ALLOWED');assert.equal(requests.length,1);
 const {messages}=requests[0].request;assert.deepEqual(messages.map(m=>m.role),['system','user']);
 assert.deepEqual(JSON.parse(messages[1].content),{conversation_history:history,latest_message:'It still does not work'});
 assert.match(messages[0].content,/Do not answer/);assert.equal(requests[0].request.max_tokens,512);
});
test('blank JSON-mode output is retried once with context preserved',async()=>{
 responses=[{choices:[{finish_reason:'stop',message:{content:'   '}}]},decision()];
 assert.equal((await evaluatePromptPolicy('Still offline',history)).code,'ALLOWED');assert.equal(requests.length,2);
 assert.equal(requests[1].request.messages[1].content,requests[0].request.messages[1].content);
 assert.equal(requests[1].options.maxRetries,0);assert.ok(requests[1].options.timeout<=requests[0].options.timeout);
});
test('persistent malformed output fails closed after two attempts',async()=>{
 responses=[{choices:[{message:{content:'Try restarting your computer'}}]},{choices:[{message:{content:'not JSON'}}]}];
 const result=await evaluatePromptPolicy('Still offline',history);
 assert.equal(result.code,'SCOPE_CLASSIFIER_UNAVAILABLE');assert.equal(result.httpStatus,503);assert.equal(requests.length,2);
});
test('valid JSON with invalid confidence is retried rather than accepted',async()=>{
 responses=[decision('in_scope',null),decision('in_scope','0.99')];
 assert.equal((await evaluatePromptPolicy('Still offline',history)).code,'SCOPE_CLASSIFIER_UNAVAILABLE');assert.equal(requests.length,2);
});
test('truncated output is retried even if it contains a parseable object',async()=>{
 const truncated=decision();truncated.choices[0].finish_reason='length';responses=[truncated,decision()];
 assert.equal((await evaluatePromptPolicy('Still offline',history)).code,'ALLOWED');assert.equal(requests.length,2);
});
test('a provider error is not retried and an unrelated follow-up remains out of scope',async()=>{
 providerError=Object.assign(new Error('redacted'),{status:429});
 assert.equal((await evaluatePromptPolicy('Still offline',history)).code,'SCOPE_CLASSIFIER_UNAVAILABLE');assert.equal(requests.length,1);
 providerError=null;responses=[decision('out_of_scope')];
 assert.equal((await evaluatePromptPolicy('Write a love poem',history)).code,'OUT_OF_SCOPE_REDIRECT');assert.equal(requests.length,2);
});
test('invalid-output retries share a deadline and stop when it expires',async()=>{
 const realNow=Date.now;let now=realNow();Date.now=()=>now;
 onRequest=()=>{now+=60001;};responses=[{choices:[{message:{content:''}}]}];
 try{assert.equal((await evaluatePromptPolicy('Still offline',history)).code,'SCOPE_CLASSIFIER_UNAVAILABLE');assert.equal(requests.length,1);}finally{Date.now=realNow;}
});
