const {test}=require('node:test');
const assert=require('node:assert/strict');
const {extractKnowledge,chunkText}=require('../src/services/knowledgeExtraction');
const JSZip=require('jszip');
test('TXT extraction normalizes text, redacts credentials and rejects invalid formats',async()=>{
 const result=await extractKnowledge({originalname:'../guide.txt',buffer:Buffer.from('VPN guide\r\n\r\napi_key=private-value\r\nInspect the connection.')});
 assert.equal(result.filename,'guide.txt');assert.ok(result.text.includes('[REDACTED]'));assert.ok(!result.text.includes('private-value'));
 for(const file of [{originalname:'old.doc',buffer:Buffer.from('text')},{originalname:'x.txt',buffer:Buffer.from([255,254,0])},{originalname:'x.txt',buffer:Buffer.from('')},{originalname:'x.docx',buffer:Buffer.from('broken')}])await assert.rejects(()=>extractKnowledge(file));
});
test('Word documents extract raw paragraphs without executing document markup',async()=>{
 const zip=new JSZip();zip.file('word/document.xml','<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Printer guide</w:t></w:r></w:p><w:p><w:r><w:t>Check the printer connection.</w:t></w:r></w:p></w:body></w:document>');
 const result=await extractKnowledge({originalname:'printer.docx',buffer:await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'})});
 assert.match(result.text,/Printer guide/);assert.match(result.text,/Check the printer/);assert.ok(!result.text.includes('<w:'));
});
test('oversized expanded Word archives are rejected before extraction',async()=>{
 const zip=new JSZip();zip.file('word/document.xml','x'.repeat(9*1024*1024));
 const buffer=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
 await assert.rejects(()=>extractKnowledge({originalname:'large.docx',buffer}),/extraction limits/);
 const forged=Buffer.from(buffer);const central=forged.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));forged.writeUInt32LE(1,central+24);forged.writeUInt32LE(1,22);
 await assert.rejects(()=>extractKnowledge({originalname:'forged.docx',buffer:forged}),/damaged/i);
});
test('chunks remain bounded, nonempty and cover a long document',()=>{
 const input='Printer troubleshooting. '.repeat(500);const chunks=chunkText(input);
 assert.ok(chunks.length>1);assert.ok(chunks.every((chunk,i)=>chunk.text.length<=1200&&chunk.ordinal===i+1));assert.ok(chunks.at(-1).text.endsWith('troubleshooting.'));
});
