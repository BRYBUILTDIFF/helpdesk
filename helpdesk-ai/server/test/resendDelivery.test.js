const {test,beforeEach,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {sendCode}=require('../src/services/adminEmail');
const names=['RESEND_API_KEY','ADMIN_EMAIL_FROM'];
let previous,originalFetch,calls;
beforeEach(()=>{
 previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));originalFetch=global.fetch;calls=[];
 Object.assign(process.env,{RESEND_API_KEY:'test-only-api-key',ADMIN_EMAIL_FROM:'HelpDesk AI <onboarding@resend.dev>'});
 global.fetch=async(url,options)=>{calls.push({url,options});return {ok:true};};
});
afterEach(()=>{global.fetch=originalFetch;for(const name of names){if(previous[name]===undefined)delete process.env[name];else process.env[name]=previous[name];}});
test('Resend sends the verification code to the administrator through HTTPS',async()=>{
 await sendCode('helpdescai@gmail.com','012345');
 assert.equal(calls.length,1);assert.equal(calls[0].url,'https://api.resend.com/emails');
 const {options}=calls[0];assert.equal(options.method,'POST');
 assert.equal(options.headers.Authorization,'Bearer test-only-api-key');assert.ok(options.signal instanceof AbortSignal);
 const body=JSON.parse(options.body);
 assert.equal(body.from,'HelpDesk AI <onboarding@resend.dev>');assert.deepEqual(body.to,['helpdescai@gmail.com']);
 assert.match(body.text,/012345/);assert.match(body.text,/5 minutes/);assert.ok(!options.body.includes('test-only-api-key'));
});
test('missing Resend settings fail before making a network call',async()=>{
 for(const name of names){const value=process.env[name];delete process.env[name];await assert.rejects(()=>sendCode('admin@example.test','123456'),error=>error.status===503&&error.publicMessage.includes('not configured'));process.env[name]=value;}
 assert.equal(calls.length,0);
});
test('invalid recipient, sender header injection, and malformed codes fail before delivery',async()=>{
 await assert.rejects(()=>sendCode('admin@example.test\r\nBcc: attacker@example.test','123456'));
 await assert.rejects(()=>sendCode('admin@example.test','invalid'));
 process.env.ADMIN_EMAIL_FROM='sender@example.test\r\nBcc: attacker@example.test';
 await assert.rejects(()=>sendCode('admin@example.test','123456'));assert.equal(calls.length,0);
});
test('provider rejections fail closed without retries or exposing provider details',async()=>{
 global.fetch=async(url,options)=>{calls.push({url,options});return {ok:false};};
 await assert.rejects(()=>sendCode('admin@example.test','123456'),error=>error.status===503&&error.publicMessage==='Unable to send verification email. Try again later.');assert.equal(calls.length,1);
});
test('network failures and timeouts expose a sanitized error',async()=>{
 global.fetch=async()=>{throw new Error('sensitive provider details');};
 await assert.rejects(()=>sendCode('admin@example.test','123456'),error=>error.status===503&&!error.message.includes('sensitive'));
 global.fetch=async()=>{throw new DOMException('deadline exceeded','TimeoutError');};
 await assert.rejects(()=>sendCode('admin@example.test','123456'),error=>error.status===503&&!error.message.includes('deadline'));
});
test('known provider errors expose safe actionable codes through the HTTP handler',async()=>{
 const handler=require('../src/middleware/errorHandler');
 for(const [status,message,code] of [
  [403,'You can only send testing emails to your own email address (private@example.test).','ADMIN_EMAIL_RECIPIENT_RESTRICTED'],
  [403,'The example.test domain is not verified.','ADMIN_EMAIL_SENDER_UNVERIFIED'],
  [400,'Invalid from field. The email address needs a valid format.','ADMIN_EMAIL_SENDER_INVALID'],
  [401,'API key is invalid: private-provider-value','ADMIN_EMAIL_KEY_INVALID'],
  [429,'Daily quota exceeded','ADMIN_EMAIL_RATE_LIMITED']
 ]){
  global.fetch=async()=>({ok:false,status,json:async()=>({message})});
  let error;try{await sendCode('admin@example.test','123456');}catch(e){error=e;}
  assert.equal(error.code,code);let body,responseStatus;
  handler(error,{}, {status(value){responseStatus=value;return this;},json(value){body=value;return this;}});
  assert.equal(responseStatus,503);assert.equal(body.code,code);assert.ok(!body.message.includes('private@'));assert.ok(!body.message.includes('private-provider-value'));assert.ok(!JSON.stringify(body).includes('123456'));
 }
});
