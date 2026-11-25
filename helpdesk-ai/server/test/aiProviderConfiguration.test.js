const {test}=require('node:test');const assert=require('node:assert/strict');
const names=['AI_PROVIDER','AI_MODEL','OPENAI_MODEL','AI_API_KEY','DEEPSEEK_API_KEY','OPENAI_API_KEY'];
test('DeepSeek defaults use the current model and recognize its provider-specific key',()=>{
 const saved=Object.fromEntries(names.map(k=>[k,process.env[k]]));
 try{for(const k of names)delete process.env[k];process.env.AI_PROVIDER=' DeepSeek ';process.env.DEEPSEEK_API_KEY='test-only-provider-key';
 const api=require('../src/utils/openai');assert.equal(api.getAIProvider(),'deepseek');assert.equal(api.getDefaultModel('deepseek'),'deepseek-flash');assert.ok(api.getOpenAIClient());
 process.env.AI_MODEL='custom-model';assert.equal(api.getDefaultModel('deepseek'),'custom-model');
 }finally{for(const k of names){if(saved[k]===undefined)delete process.env[k];else process.env[k]=saved[k];}}
});
