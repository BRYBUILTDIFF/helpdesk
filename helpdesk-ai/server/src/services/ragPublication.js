const { definitionHash } = require('./terminalRuntime');
const { assertSourcesCurrent } = require('./knowledgeService');
const conflict = message => Object.assign(new Error(message), { status: 409, publicMessage: message });
function checkCitations(simulation, sources) {
  const ids = new Set(sources.map(source => source.sourceId));
  if (!simulation?.steps?.length || simulation.steps.some(step => {
    if (!Array.isArray(step.sourceIds)) return true;
    if (step.supportType === 'ai-added') return step.sourceIds.length !== 0;
    return (step.supportType && step.supportType !== 'source-backed') || !step.sourceIds.length || step.sourceIds.some(id => !ids.has(id));
  })) throw conflict('Source-backed steps need valid supporting passage IDs. AI-added steps must be explicitly marked and have no source citations.');
  if (!simulation.steps.some(step => step.supportType !== 'ai-added' && step.sourceIds.length)) throw conflict('At least one step must be supported by retrieved knowledge. Add relevant sources or revise the request.');
}
async function publicationProvenance(tx, payload, simulation, current) {
  let draft;
  if (payload.draftId) {
    draft = await tx.simulationDraft.findUnique({ where: { id: payload.draftId } });
    if (!draft || draft.ownerId !== payload.testedById || draft.state !== 'DRAFT' || draft.version !== payload.draftVersion) throw conflict('The saved draft changed. Reopen it before saving.');
  }
  const rag = draft?.generation?.rag;
  if (rag) {
    if (payload.sourceReviewConfirmed !== true) throw conflict('Review the source support for the current steps and confirm it before saving.');
    checkCitations(simulation, rag.sources);
    await assertSourcesCurrent(tx, rag.sources);
    return { rag, reviewedById: payload.testedById, reviewedAt: new Date().toISOString(), definitionHash: definitionHash(simulation) };
  }
  if (current?.provenance?.rag) {
    // Existing RAG modules must retain their server-owned provenance when edited.
    if (payload.simulation) throw conflict('Edit this source-backed module through its saved draft so sources and review are preserved.');
    if (payload.enabled === true) {
      if (current.provenance.definitionHash !== definitionHash(simulation)) throw conflict('The source review does not match this definition. Reopen, review, and test the module.');
      await assertSourcesCurrent(tx, current.provenance.rag.sources);
    }
    return current.provenance;
  }
  return null;
}
module.exports = { publicationProvenance, checkCitations };
