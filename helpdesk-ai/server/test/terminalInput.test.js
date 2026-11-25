const {test}=require('node:test');const assert=require('node:assert/strict');
const modulePath=require('node:url').pathToFileURL(require('node:path').resolve(__dirname,'../../client/src/pages/users/Modules/terminalInput.mjs')).href;
const editor=import(modulePath);
test('left/right move the insertion cursor without adding escape text',async()=>{
 const {editTerminalInput:edit}=await editor;
 let s={value:'helo',cursor:4};s=edit(s,'\x1b[D');s=edit(s,'\x1b[D');s=edit(s,'l');assert.deepEqual(s,{value:'hello',cursor:3});
 s=edit(s,'\x1b[C');s=edit(s,'!');assert.equal(s.value,'hell!o');
});
test('backspace and delete edit at the cursor instead of the command end',async()=>{
 const {editTerminalInput:edit}=await editor;
 let s={value:'abXcd',cursor:3};s=edit(s,'\x7f');assert.deepEqual(s,{value:'abcd',cursor:2});s=edit(s,'\x1b[3~');assert.deepEqual(s,{value:'abd',cursor:2});
 assert.deepEqual(edit({value:'abc',cursor:0},'\x7f'),{value:'abc',cursor:0});
});
test('home/end, word movement and repeated arrows stay within the command',async()=>{
 const {editTerminalInput:edit}=await editor;
 let s={value:'net user jdoe',cursor:13};s=edit(s,'\x1b[1;5D');assert.equal(s.cursor,9);s=edit(s,'\x1b[1;5D');assert.equal(s.cursor,4);s=edit(s,'\x1b[1;5C');assert.equal(s.cursor,9);
 s=edit(s,'\x1b[H');s=edit(s,'\x1b[D');assert.equal(s.cursor,0);s=edit(s,'\x1b[F');s=edit(s,'\x1b[C');assert.equal(s.cursor,13);
});
test('unhandled escape sequences and control keys never become command text',async()=>{
 const {editTerminalInput:edit}=await editor;
 for(const sequence of ['\x1b[5~','\x1b[6~','\x1bOP','\x03','\t'])assert.deepEqual(edit({value:'help',cursor:4},sequence),{value:'help',cursor:4});
 assert.deepEqual(edit({value:'abcd',cursor:2},'one\ntwo'),{value:'abonetwocd',cursor:8});
});
test('wrapped redraw moves between terminal rows and preserves prompt columns',async()=>{
 const {redrawTerminalInput:redraw}=await editor;
 const result=redraw('C:> ',{value:'abcdefghijkl',cursor:12},{value:'abcXdefghijkl',cursor:4},10);
 assert.ok(result.startsWith('\r\x1b[1A\x1b[5G\x1b[J'));
 assert.ok(result.endsWith('\r\x1b[1A\x1b[9G'));
});
