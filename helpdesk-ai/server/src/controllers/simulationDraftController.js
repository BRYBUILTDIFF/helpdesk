const prisma = require('../prisma');
const { normalizeSimulation, getModuleById } = require('../store/simulationModuleStore');
const { redactSecrets, redactObject } = require('../utils/redact');
const cleanJson = value => JSON.parse(JSON.stringify(value));
const fail = (status, message) => Object.assign(new Error(message), { status, publicMessage: message });

async function createStoredDraft(ownerId, input) {
  if(await prisma.simulationDraft.count({where:{ownerId,state:'DRAFT'}})>=100) throw fail(409,'You have 100 saved drafts. Discard an old draft before creating another.');
  const simulation = normalizeSimulation(input.simulation, input.title);
  if (!simulation) throw fail(400, 'A draft needs at least one step.');
  return prisma.simulationDraft.create({ data: {
    ownerId, moduleId: input.moduleId || null,
    title: redactSecrets(input.title || simulation.title).slice(0, 160),
    category: redactSecrets(input.category || 'General').slice(0, 80),
    difficulty: ['Easy', 'Medium', 'Hard'].includes(input.difficulty) ? input.difficulty : 'Medium',
    sourcePrompt: redactSecrets(input.sourcePrompt).slice(0, 4000) || null,
    simulation: cleanJson(simulation),
    ...(input.generation ? { generation: cleanJson(redactObject(input.generation)) } : {})
  } });
}
async function listDrafts(req, res, next) { try {
  const drafts=await prisma.simulationDraft.findMany({ where: { ownerId: req.user.id, state: 'DRAFT' }, orderBy: { updatedAt: 'desc' }, take: 100 });
  const visible=drafts.filter(draft=>require('../utils/simulationSurfaces').supportsWindowsSimulation(draft.simulation));
  return res.json({drafts:await Promise.all(visible.map(async draft=>{const workflow=await require('../services/authoringWorkflow').state(draft);return {...draft,workflow:{reviewed:workflow.reviewed,status:workflow.status,test:workflow.test}};}))});
} catch (e) { next(e); } }
async function getDraft(req,res,next){try{
  const draft=await prisma.simulationDraft.findFirst({where:{id:req.params.id,ownerId:req.user.id,state:'DRAFT'}});
  if(!draft)throw fail(404,'Draft not found.');
  if(!require('../utils/simulationSurfaces').supportsWindowsSimulation(draft.simulation))throw fail(410,'This historical platform is no longer supported. Create a Windows simulation instead.');
  const workflow=await require('../services/authoringWorkflow').state(draft);
  return res.json({draft:{...draft,test:workflow.test,workflow:{reviewed:workflow.reviewed,status:workflow.status,test:workflow.test}}});
}catch(e){next(e);}}
async function createDraft(req, res, next) { try {
  const module = req.body.moduleId ? await getModuleById(req.body.moduleId) : null;
  if(module?.id.startsWith('authoring-lab-'))throw fail(404,'Module not found.');
  if (req.body.moduleId && !module) throw fail(404, 'Module not found.');
  const stored = module ? await prisma.simulationModule.findUnique({where:{id:module.id},select:{provenance:true}}) : null;
  const input = module ? { ...module, moduleId: module.id, generation: { baseRevision: module.revision, ...(stored?.provenance?.rag ? {rag:stored.provenance.rag,workflow:{reviewHash:stored.provenance.definitionHash}} : {}) } } : {...req.body,generation:undefined};
  const draft=await createStoredDraft(req.user.id,input),workflow=await require('../services/authoringWorkflow').state(draft);
  return res.status(201).json({draft:{...draft,test:workflow.test,workflow:{reviewed:workflow.reviewed,status:workflow.status,test:workflow.test}}});
} catch (e) { next(e); } }
async function updateDraft(req, res, next) { try {
  const version = req.body.version;
  if (!Number.isInteger(version) || version < 1) throw fail(400, 'A draft version is required.');
  const simulation = normalizeSimulation(req.body.simulation);
  if (!simulation) throw fail(400, 'A draft needs at least one step.');
  const draft = await prisma.$transaction(async tx => {
    const changed = await tx.simulationDraft.updateMany({ where: { id: req.params.id, ownerId: req.user.id, version, state: 'DRAFT' }, data: { simulation: cleanJson(simulation), version: { increment: 1 } } });
    if (!changed.count) throw fail(409, 'This draft changed elsewhere. Reopen the saved draft before editing again.');
    return tx.simulationDraft.findUnique({ where: { id: req.params.id } });
  });
  return res.json({ draft });
} catch (e) { next(e); } }
async function discardDraft(req, res, next) { try {
  await prisma.simulationDraft.deleteMany({ where: { id: req.params.id, ownerId: req.user.id, state: 'DRAFT' } });
  return res.json({ discarded: true });
} catch (e) { next(e); } }
async function revisions(req, res, next) { try {
  return res.json({ revisions: await prisma.simulationRevision.findMany({ where: { moduleId: req.params.id }, orderBy: { revision: 'desc' }, take: 100 }) });
} catch (e) { next(e); } }
module.exports = { createStoredDraft, listDrafts, getDraft, createDraft, updateDraft, discardDraft, revisions };
