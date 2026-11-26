const {test}=require('node:test');const assert=require('node:assert/strict');const {pathToFileURL}=require('node:url');const path=require('node:path');
const url=pathToFileURL(path.resolve(__dirname,'../../client/src/utils/adminVerification.js')).href;
const proof=(id=7,expires=Date.now()+3600000)=>'header.'+Buffer.from(JSON.stringify({purpose:'admin-mfa',id,exp:Math.floor(expires/1000)})).toString('base64url')+'.signature';
test('admin proof survives module reload, expires, and is isolated by user',async()=>{
 const prior=global.window,values=new Map();
 global.window={sessionStorage:{getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key),key:index=>[...values.keys()][index],get length(){return values.size;}}};
 try{
  const first=await import(url+'?first');const token=proof();first.setAdminVerification(7,token);
  const reload=await import(url+'?refresh');assert.equal(reload.getAdminVerification(7),token);assert.equal(reload.getAdminVerification(8),'');
  const now=Date.now;try{Date.now=()=>now()+3601000;assert.equal(reload.getAdminVerification(7),'');assert.equal(values.size,0);}finally{Date.now=now;}
  values.set('unrelated-setting','keep');reload.setAdminVerification(7,proof());reload.setAdminVerification(8,proof(8));reload.clearAdminVerification();assert.deepEqual([...values.entries()],[['unrelated-setting','keep']]);
  values.set('helpdesk-admin-verification:7',proof(8));assert.equal(reload.getAdminVerification(7),'');
  values.set('helpdesk-admin-verification:7','malformed');assert.equal(reload.getAdminVerification(7),'');
 }finally{global.window=prior;}
});
test('blocked browser storage retains memory proof without crashing',async()=>{
 const prior=global.window;global.window={get sessionStorage(){throw Error('Storage blocked');}};
 try{const api=await import(url+'?blocked');const token=proof();api.setAdminVerification(7,token);assert.equal(api.getAdminVerification(7),token);api.clearAdminVerification();assert.equal(api.getAdminVerification(7),'');}finally{global.window=prior;}
});
