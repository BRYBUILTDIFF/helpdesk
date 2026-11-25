const {test}=require('node:test');
const assert=require('node:assert/strict');
require.cache[require.resolve('../src/store/policyEventStore')]={exports:{listPolicyEvents:async()=>[
 {message:'Windows Terminal unlock locked account',code:'ALLOWED',blocked:false,userEmail:'student@example.test',at:'2026-11-26T00:00:00Z'},
 {message:'Windows Terminal unlock locked account',code:'ALLOWED',blocked:false,userEmail:'other@example.test',at:'2026-11-26T01:00:00Z'},
 {message:'blocked request',code:'BLOCKED',blocked:true,at:'2026-11-26T02:00:00Z'}
]}};
require.cache[require.resolve('../src/store/promptInsightDismissalStore')]={exports:{isPromptInsightDismissed:()=>{throw Error('Read-only monitoring must ignore dismissals');},dismissPromptInsight:()=>{throw Error('Must not mutate monitoring');}}};
require.cache[require.resolve('../src/store/simulationModuleStore')]={exports:{listModules:()=>{throw Error('Existing modules must not hide user prompt patterns');}}};
const controller=require('../src/controllers/adminController');
test('read-only prompt monitoring groups requests without hiding existing or dismissed topics',async()=>{
 let body;
 await controller.getSimulationPromptInsights({query:{limit:200}},{status(){return this;},json(value){body=value;return this;}},error=>{throw error;});
 assert.equal(body.insights.length,1);
 assert.equal(body.insights[0].occurrences,2);
 assert.equal(body.insights[0].uniqueUsers,2);
 assert.equal(body.countsAreRecentSample,true);
});
test('legacy dismissal endpoint cannot modify the suggestion queue',async()=>{
 let status,body;
 await controller.disregardSimulationPromptInsight({}, {status(value){status=value;return this;},json(value){body=value;return this;}});
 assert.equal(status,410);assert.match(body.message,/read-only/);
});
