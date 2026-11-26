const {test}=require('node:test'),assert=require('node:assert/strict');
const {changeAdminEmail}=require('../scripts/change-admin-email');
function fixture({role='ADMIN',duplicate=false}={}){
 const calls=[];const user={id:7,email:'old@example.test',role,isActive:true,tokenVersion:3};
 const tx={user:{findUnique:async({where})=>where.email===user.email?user:duplicate?{id:9}:null,updateMany:async input=>{calls.push(['update',input]);return {count:1};}},$executeRaw:async(...input)=>calls.push(['sql',input]),refreshToken:{deleteMany:async input=>calls.push(['revoke',input])},adminAuditLog:{create:async input=>calls.push(['audit',input])}};
 return {db:{$transaction:action=>action(tx)},calls};
}
test('email recovery is read-only by default and rejects wrong roles and occupied recipients',async()=>{
 const f=fixture();assert.equal((await changeAdminEmail(f.db,'old@example.test','new@example.test')).changed,false);assert.equal(f.calls.length,0);
 for(const options of [{role:'USER'},{duplicate:true}]){const bad=fixture(options);await assert.rejects(()=>changeAdminEmail(bad.db,'old@example.test','new@example.test',true));assert.equal(bad.calls.length,0);}
});
test('email recovery changes only recipient and token version, revokes old proofs and sessions, and audits',async()=>{
 const f=fixture();const result=await changeAdminEmail(f.db,'old@example.test','new@example.test',true);assert.equal(result.changed,true);
 assert.deepEqual(f.calls.find(call=>call[0]==='update')[1].data,{email:'new@example.test',tokenVersion:{increment:1}});
 assert.ok(f.calls.some(call=>call[0]==='sql'&&call[1][0].join('').includes('DELETE FROM "AdminSecurity"')));
 assert.deepEqual(f.calls.find(call=>call[0]==='revoke')[1],{where:{userId:7}});
 assert.equal(f.calls.find(call=>call[0]==='audit')[1].data.metadata.operation,'ADMIN_EMAIL_CHANGE');
});
