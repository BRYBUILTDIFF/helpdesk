const { listModules, recordModuleCompletion } = require("../store/simulationModuleStore");
const { windowsSimulationsEnabled } = require("../utils/simulationAvailability");

async function getSimulationSources(req,res,next) {
  try {
    const module=await require('../prisma').simulationModule.findUnique({where:{id:req.params.id},select:{enabled:true,simulation:true,provenance:true}});
    if(!module?.enabled || !require('../utils/simulationSurfaces').supportsWindowsSimulation(module.simulation) || (!windowsSimulationsEnabled() && module.simulation?.surface==='windows-os'))return res.status(404).json({message:'Simulation module not found.'});
    const rag=module.provenance?.rag;
    if(!rag)return res.json({sources:[],steps:[]});
    // Only published snapshots and student-facing citation fields. Never return
    // uploader/reviewer IDs, hashes, draft metadata, filenames or original files.
    const sources=(rag.sources||[]).map(s=>({sourceId:s.sourceId,title:s.title,version:s.version,section:s.section,text:s.text}));
    const ids=new Set(sources.map(s=>s.sourceId));
    const steps=(module.simulation?.steps||[]).map(step=>({supportType:step.supportType==='ai-added'?'ai-added':'source-backed',sourceIds:step.supportType==='ai-added'?[]:(step.sourceIds||[]).filter(id=>ids.has(id))}));
    return res.json({sources,steps});
  }catch(error){next(error);}
}

async function listEnabledSimulationModules(_req, res, next) {
  try {
    const modules = await listModules({ onlyEnabled: true });
    return res.status(200).json({ modules: windowsSimulationsEnabled() ? modules : modules.filter(module => module.simulation?.surface !== "windows-os") });
  } catch (err) {
    return next(err);
  }
}

async function completeSimulationModule(req, res, next) {
  try {
    const result = await recordModuleCompletion({
      moduleId: String(req.params.id || "").trim(),
      userId: req.user.id,
      attemptKey: req.body?.attemptKey,
      surface: req.body?.surface,
      stepsCompleted: req.body?.stepsCompleted
    });
    if (!result) return res.status(404).json({ message: "Simulation module not found." });
    return res.status(200).json(result);
  } catch (err) {
    if (err?.status) return res.status(err.status).json({ message: err.message });
    return next(err);
  }
}

module.exports = {
  getSimulationSources,
  listEnabledSimulationModules,
  completeSimulationModule
};
