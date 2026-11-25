const {test}=require('node:test');const assert=require('node:assert/strict');
const {classifierFailure}=require('../src/policy/classifierFailure');
test('classifier failures expose fixed actionable categories and HTTP status only',()=>{
 for(const [error,expected] of [
  [{code:'CLASSIFIER_NOT_CONFIGURED'},{category:'MISSING_API_KEY'}],
  [{code:'CLASSIFIER_INVALID_RESPONSE'},{category:'INVALID_RESPONSE'}],
  [{status:401},{category:'AUTHENTICATION_OR_PERMISSION',status:401}],
  [{status:402},{category:'BILLING',status:402}],
  [{status:429},{category:'RATE_LIMIT_OR_QUOTA',status:429}],
  [{status:404},{category:'MODEL_OR_REQUEST_CONFIGURATION',status:404}],
  [{status:503},{category:'PROVIDER_OUTAGE',status:503}],
  [{name:'APIConnectionTimeoutError'},{category:'TIMEOUT'}],
  [{name:'APIConnectionError'},{category:'NETWORK'}],
  [{name:'AbortError'},{category:'REQUEST_ABORTED'}]
 ]) assert.deepEqual(classifierFailure({...error,message:'secret-key-and-prompt',request:{private:true}}),expected);
 assert.deepEqual(classifierFailure({code:'secret',status:'private',message:'private'}),{category:'UNAVAILABLE'});
});
