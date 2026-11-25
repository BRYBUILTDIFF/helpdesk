const {test}=require('node:test');const assert=require('node:assert/strict');
let row;
require.cache[require.resolve('../src/prisma')]={exports:{simulationModule:{findUnique:async()=>row}}};
const {getSimulationSources}=require('../src/controllers/simulationController');
async function invoke(){let status=200,body;await getSimulationSources({params:{id:'module'}},{status(value){status=value;return this;},json(value){body=value;return this;}},error=>{throw error;});return {status,body};}
test('student sources expose published snapshots and step labels without private provenance',async()=>{
 row={enabled:true,simulation:{surface:'windows-terminal',steps:[{sourceIds:['S1']},{supportType:'ai-added',sourceIds:['S1']}]},provenance:{reviewedById:7,rag:{sources:[{sourceId:'S1',title:'Folder guide',version:2,section:3,text:'Published passage',filename:'private-name.txt',documentId:'internal',contentHash:'secret-hash'}]}}};
 const {body}=await invoke();assert.deepEqual(body.sources,[{sourceId:'S1',title:'Folder guide',version:2,section:3,text:'Published passage'}]);assert.equal(body.steps[1].supportType,'ai-added');assert.deepEqual(body.steps[1].sourceIds,[]);assert.equal(body.reviewedById,undefined);
});
test('missing and unpublished module sources are inaccessible; manual modules are empty',async()=>{
 row=null;assert.equal((await invoke()).status,404);
 row={enabled:false,provenance:{rag:{sources:[{text:'unpublished'}]}}};assert.equal((await invoke()).status,404);
 row={enabled:true,simulation:{surface:'windows-terminal'}};assert.deepEqual((await invoke()).body,{sources:[],steps:[]});
});
