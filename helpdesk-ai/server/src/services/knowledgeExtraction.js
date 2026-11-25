const mammoth = require('mammoth');
const yauzl = require('yauzl');
const path = require('node:path');
const { redactSecrets } = require('../utils/redact');
const fail = message => Object.assign(new Error(message), { status: 400, publicMessage: message });
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TEXT = 200000;
function checkArchive(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true, validateEntrySizes: true }, (error, zip) => {
      if (error) return reject(fail('Unreadable Word document. Save it as a standard .docx file.'));
      let entries = 0, expanded = 0, actualExpanded = 0, hasDocument = false, settled = false;
      const stop = error => { if (settled) return; settled = true; zip.close(); error ? reject(error) : resolve(); };
      zip.on('error', () => stop(fail('Damaged Word document.')));
      zip.on('entry', entry => {
        entries++; expanded += entry.uncompressedSize;
        if (entry.generalPurposeBitFlag & 1 || entries > 1000 || expanded > 8 * 1024 * 1024) return stop(fail('Word document is encrypted or exceeds extraction limits.'));
        if (entry.fileName === 'word/document.xml') hasDocument = true;
        // Drain with a hard output bound as well: forged ZIP size metadata is not trusted.
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError) return stop(fail('The Word archive is damaged.'));
          stream.on('data', data => {
            actualExpanded += data.length;
            if (actualExpanded > 8 * 1024 * 1024) {
              stream.destroy();
              stop(fail('Word document exceeds extraction limits.'));
            }
          });
          stream.on('error', () => stop(fail('The Word archive is damaged.')));
          stream.on('end', () => { if (!settled) zip.readEntry(); });
        });
      });
      zip.on('end', () => stop(hasDocument ? null : fail('The file does not contain a Word document.')));
      zip.readEntry();
    });
  });
}
async function extractKnowledge(file) {
  const filename = path.basename(String(file.originalname || '').replace(/\\/g, '/')).replace(/[\x00-\x1f<>]/g, '').slice(0, 180);
  const format = path.extname(filename).slice(1).toLowerCase();
  if (!['txt', 'docx'].includes(format)) throw fail('Upload Word .docx or UTF-8 .txt files. Save legacy .doc as .docx first.');
  if (!file.buffer?.length || file.buffer.length > MAX_BYTES) throw fail('Each source must be nonempty and at most 2 MB.');
  let text;
  if (format === 'docx') {
    await checkArchive(file.buffer);
    try { text = (await mammoth.extractRawText({ buffer: file.buffer }, { externalFileAccess: false })).value; }
    catch { throw fail('Unable to extract text from this Word document.'); }
  } else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(file.buffer); }
    catch { throw fail('Text documents must use UTF-8 encoding.'); }
  }
  if (text.includes('\0')) throw fail('The file is not a readable text document.');
  text = redactSecrets(text).replace(/\r\n?/g, '\n').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '').trim();
  if (!text || text.length > MAX_TEXT) throw fail('Extracted text must contain 1 to 200,000 characters. Image-only files are not supported.');
  return { filename, format, title: filename.replace(/\.(docx|txt)$/i, ''), text };
}
function chunkText(text) {
  // Overlapping bounded passages retain stable section numbers for source inspection.
  const chunks = [];
  for (let start = 0; start < text.length;) {
    let end = Math.min(text.length, start + 1200);
    if (end < text.length) { const boundary = text.lastIndexOf('\n', end); if (boundary > start + 600) end = boundary; }
    if (text.slice(start, end).trim()) chunks.push({ text: text.slice(start, end).trim(), ordinal: chunks.length + 1 });
    if (end === text.length) break;
    start = end - 120;
  }
  return chunks;
}
module.exports = { extractKnowledge, chunkText, checkArchive, MAX_BYTES };
