const runtime = require('./terminalRuntime');

// Resolve only exact executable commands. Never infer actions from instructions.
function resolveActions(definition) {
 return {...definition,steps:(definition.steps||[]).map(step=>{
  let actionId=String(step.actionId||'').trim();
  let action=Object.hasOwn(runtime.ACTIONS,actionId)?runtime.ACTIONS[actionId]:null;
  const supplied=Array.isArray(step.expectedCommands)&&step.expectedCommands.length?step.expectedCommands:typeof step.command==='string'&&step.command.trim()?[step.command]:[];
  if(!action&&supplied.length===1){
   const matches=Object.entries(runtime.ACTIONS).filter(([,entry])=>entry.type==='command'&&runtime.canonicalCommand(entry.command)===runtime.canonicalCommand(supplied[0]));
   if(matches.length===1)[actionId,action]=matches[0];
  }
  if(!action)return step;
  return {...step,actionId,type:step.type||action.type,
   command:step.command??supplied[0]??action.command??'',
   expectedCommands:supplied.length?supplied:action.type==='command'?[action.command]:[],
   expectedOutput:undefined};
 })};
}
const supportedTasks='folder creation/listing, account inspection and recovery, signed-in identity, network configuration inspection, and DNS cache repair';
module.exports={resolveActions,supportedTasks};
