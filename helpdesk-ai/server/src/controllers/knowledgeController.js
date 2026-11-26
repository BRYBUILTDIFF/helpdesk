const multer = require('multer');
const service = require('../services/knowledgeService');
const { extractKnowledge, MAX_BYTES } = require('../services/knowledgeExtraction');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES, files: 10, fields: 0, parts: 10 } }).array('files', 10);
function receiveFiles(req, res, next) {
  upload(req, res, error => error ? res.status(400).json({ message: 'Upload up to 10 Word .docx or TXT files, at most 2 MB each.' }) : next());
}
async function list(req, res, next) { try { res.json({ documents: await service.listKnowledge() }); } catch (e) { next(e); } }
async function detail(req, res, next) { try { res.json({ document: await service.getKnowledge(req.params.id) }); } catch (e) { next(e); } }
async function ingest(req, res, next) {
  try {
    if (!req.files?.length) return res.status(400).json({ message: 'Choose Word .docx or TXT source files.' });
    const results = [];
    for (const file of req.files) {
      try { results.push({ ok: true, document: await service.saveKnowledge(await extractKnowledge(file), req.user.id) }); }
      catch (e) { if (!e.status || e.status >= 500) throw e; results.push({ ok: false, filename: file.originalname.slice(0, 180), message: e.publicMessage,existingDocumentId:e.existingDocumentId }); }
    }
    res.status(200).json({ results });
  } catch (e) { next(e); }
}
async function status(req, res, next) { try { if(req.body.title!==undefined)await service.renameKnowledge(req.params.id,req.body.title);else await service.changeKnowledgeStatus(req.params.id, req.body.status, req.user.id); res.json({ updated: true }); } catch (e) { next(e); } }
async function version(req,res,next){try{
  if(req.files?.length!==1)return res.status(400).json({message:'Choose exactly one Word or TXT file for the new version.'});
  const document=await service.saveKnowledge(await extractKnowledge(req.files[0]),req.user.id,req.params.id);
  return res.status(201).json({document});
}catch(e){if(e.existingDocumentId)return res.status(e.status).json({message:e.publicMessage,existingDocumentId:e.existingDocumentId});next(e);}}
async function search(req, res, next) { try {
  const query=require('../utils/redact').redactSecrets(req.body.query).trim();
  const sources=await service.retrieveKnowledge(query);
  res.json({sources,evidenceToken:sources.length?require('../services/knowledgeEvidence').createEvidenceToken(query,req.user.id,sources):null});
} catch (e) { next(e); } }
async function deletionPreview(req,res,next){try{res.json(await service.sourceDeletionPreview(req.params.id));}catch(e){next(e);}}
async function remove(req,res,next){try{res.json(await service.deleteKnowledge(req.params.id,req.body.documentIds));}catch(e){next(e);}}
module.exports = { receiveFiles, list, detail, ingest, status, search,version,deletionPreview,remove };
