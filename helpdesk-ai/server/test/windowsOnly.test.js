const {test}=require('node:test');const assert=require('node:assert/strict');
const {supportsWindowsSimulation,UNSUPPORTED_OS_PATTERN}=require('../src/utils/simulationSurfaces');
const rows=[{id:'windows',title:'Windows exercise',category:'General',simulation:{surface:'windows-terminal',steps:[{title:'Inspect',actionId:'system.identity',type:'command',expectedCommands:['whoami']}] }},{id:'mac',title:'Historical Mac',simulation:{surface:'mac-terminal',steps:[{title:'Mac step'}]}}];
require.cache[require.resolve('../src/prisma')]={exports:{simulationModule:{findMany:async()=>rows,findUnique:async({where})=>rows.find(row=>row.id===where.id)}}};
const store=require('../src/store/simulationModuleStore'),runtime=require('../src/services/terminalRuntime');
test('only Windows surfaces can be normalized or appear in module catalogs',async()=>{
 for(const surface of ['mac-os','mac-terminal','linux']){assert.equal(supportsWindowsSimulation({surface}),false);assert.throws(()=>store.normalizeSimulation({surface,steps:[{title:'Historical'}]}),/Only Windows/);}
 assert.deepEqual((await store.listModules({onlyEnabled:true})).map(row=>row.id),['windows']);assert.equal(await store.getModuleById('mac'),null);
 assert.equal(supportsWindowsSimulation({surface:'windows-os'}),true);
 assert.ok(Object.values(runtime.ACTIONS).every(action=>['windows-terminal','any'].includes(action.surface)));
});
test('unsupported platform requests are detected without confusing MAC addresses with macOS',()=>{
 for(const text of ['Mac Terminal folder commands','macOS printer settings','Mac OS account recovery','Linux terminal','Ubuntu DNS'])assert.equal(UNSUPPORTED_OS_PATTERN.test(text),true,text);
 for(const text of ['Windows Terminal network troubleshooting','Inspect the MAC address on Windows 11','MAC filtering on the network adapter'])assert.equal(UNSUPPORTED_OS_PATTERN.test(text),false,text);
});
