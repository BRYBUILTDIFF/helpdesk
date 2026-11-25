const {test}=require('node:test');
const assert=require('node:assert/strict');
const {testDefinition}=require('../src/controllers/simulationAttemptController');
const runtime=require('../src/services/terminalRuntime');

test('admin terminal test exposes actionable validation errors without creating a receipt',async()=>{
 const simulation=runtime.accountDefinition();
 simulation.steps[1].actionId='unsupported.generated.action';
 let status,body;
 const res={status(value){status=value;return this;},json(value){body=value;return this;}};
 await testDefinition({user:{id:1},body:{simulation,actions:[]}},res,error=>{throw error;});
 assert.equal(status,400);
 assert.equal(body.code,'SIMULATION_VALIDATION_FAILED');
 assert.ok(body.validationErrors.some(message=>message.includes('Step 2: unsupported action')));
 assert.equal(body.message,body.validationErrors.join(' '));
 assert.equal(body.testToken,undefined);
});
