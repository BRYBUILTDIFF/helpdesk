import DraftEditorTabs from './DraftEditorTabs';
import {SourceCitationPicker} from './RagSourcePanel';
import AdminDraftWalkthrough from './AdminDraftWalkthrough';
import DraftStepList from './DraftStepList';
import { useEffect, useState } from 'react';

export default function DesktopModuleEditor({ definition, onChange, busy, sources, evidencePanel, reviewControl, reviewed=true, test, onStartTest, onPublish, existing, saveStatus }) {
  const [clock,setClock]=useState(Date.now());
  useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),5000);return()=>clearInterval(timer);},[]);
  const tested=!!test?.completed&&new Date(test.expiresAt)>clock;
  const [editorTab,setEditorTab]=useState('edit');
  const [selected, setSelected] = useState(0);
  const [notice, setNotice] = useState('');
  const steps = definition.steps || [];
  const index = Math.max(0, Math.min(selected, steps.length - 1));
  const step = steps[index];
  const update = (patch) => onChange({ ...definition, steps: steps.map((item, i) => i === index ? { ...item, ...patch } : item) });
  const move = (from, to) => {
    if (busy || from === to || from < 0 || to < 0 || from >= steps.length || to >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange({ ...definition, steps: next });
    setSelected(index === from ? to : from < index && to >= index ? index - 1 : from > index && to <= index ? index + 1 : index);
    setNotice(`${item.title || 'Step'} moved to step ${to + 1}.`);
  };
  return <><section className="desktop-module-editor draft-content-editor">
    <AdminDraftWalkthrough notice={notice} />
    <div className="sim-runtime-body draft-workspace-body">
      <DraftStepList steps={steps} selected={index} busy={busy} minimum={3} onSelect={setSelected} onMove={move}
        onAdd={after=>{const next=[...steps];next.splice(after+1,0,{title:'New step',desc:'',instruction:'',action:'',screen:'',result:''});onChange({...definition,steps:next});setSelected(after+1);setNotice('Step added at position '+(after+2)+'.');}}
        onRemove={removed=>{onChange({...definition,steps:steps.filter((_,i)=>i!==removed)});setSelected(index>removed?index-1:Math.min(index,steps.length-2));setNotice('Step '+(removed+1)+' deleted.');}} />
      <section className="sim-runtime-canvas">
        <DraftEditorTabs value={editorTab} onChange={setEditorTab} reviewed={reviewed} tested={tested}/><header hidden={editorTab!=='edit'} className="draft-content-heading"><h3>Step content</h3><span>Step {index+1} of {steps.length}</span></header>
        {step ? <div hidden={editorTab!=='edit'} className="sim-runtime-current terminal-step-editor"><ol><li>
          <label className="draft-title-field draft-full-field">Step title<input name="desktop-module-editor-step-title" value={step.title || ''} disabled={busy} onChange={event => update({ title: event.target.value })} /></label>
          <label className="draft-full-field">Instruction<textarea name="desktop-module-editor-step-instruction" value={step.instruction ?? step.action ?? ''} disabled={busy} onChange={event => update({ instruction: event.target.value, action: event.target.value })} /></label>
          <label className="draft-full-field">Description<textarea name="desktop-module-editor-step-desc" value={step.desc ?? step.description ?? ''} disabled={busy} onChange={event => update({ desc: event.target.value, description: event.target.value })} /></label>
          <label>Scenario / screen<textarea name="desktop-module-editor-step-screen" value={step.screen || ''} disabled={busy} onChange={event => update({ screen: event.target.value })} /></label>
          <label>Expected result<textarea name="desktop-module-editor-step-result" value={step.result || ''} disabled={busy} onChange={event => update({ result: event.target.value })} /></label>

          
        </li></ol></div> : null}
      <section hidden={editorTab!=='evidence'} className="draft-evidence-workspace"><h3>Evidence for step {index+1}: {step?.title}</h3><p>Review the cited passages for every step. Check AI-added instructions independently, then confirm your review below.</p>{evidencePanel}{step?<SourceCitationPicker sources={sources} selected={step.sourceIds||[]} supportType={step.supportType} disabled={busy} onChange={(sourceIds,supportType)=>update({sourceIds,supportType})}/>:null}{reviewControl}</section>
      <section hidden={editorTab!=='test'} className="draft-test-workspace"><h3>Test in the Windows lab</h3><p>Open a private test workspace and follow every step. Mark each step complete, then choose Finish test. This records your confirmation; Windows actions are not automatically verified.</p><button type="button" className="btn-sm" disabled={busy||!reviewed} onClick={onStartTest}>{tested?'Run test again':'Open Windows test lab'}</button><p role="status">{tested?'Test completed: administrator confirmed all lab steps.':test?'The previous test expired. Run the test again.':'No completed test for these steps yet.'}</p></section>
      <section hidden={editorTab!=='publish'} className="draft-publish-workspace"><h3>{reviewed&&tested?'Ready to publish':'Draft needs review or testing'}</h3><p>Environment: Windows lab. Evidence {reviewed?'reviewed':'needs review'}. Lab test {tested?'confirmed by administrator':'required'}.</p><p>{existing?'Students keep using the published version until you publish these changes.':'Publishing makes this module available for students. It does not launch a Windows instance.'}</p></section>
      </section>
    </div>
  </section><footer className="sim-preview-footer draft-editor-footer"><div><span role="status">{saveStatus} · {reviewed&&tested?'Ready to publish':'Draft'}</span><p>Edits save automatically. Changed steps or evidence require review and testing again.</p></div><div className="sim-preview-btn-row">{editorTab!=='edit'?<button type="button" className="btn-sm" disabled={busy} onClick={()=>setEditorTab(({evidence:'edit',test:'evidence',publish:'test'})[editorTab])}>Back</button>:null}{editorTab==='publish'?<button type="button" className="btn-sm" disabled={busy||!reviewed||!tested} onClick={onPublish}>{busy?'Publishing...':existing?'Publish changes':'Publish'}</button>:<button type="button" className="btn-sm" disabled={busy||(editorTab==='evidence'&&!reviewed)||(editorTab==='test'&&!tested)} onClick={()=>setEditorTab(({edit:'evidence',evidence:'test',test:'publish'})[editorTab])}>{editorTab==='edit'?'Continue to evidence':editorTab==='evidence'?'Continue to test':'Continue to publish'}</button>}</div></footer></>;
}
