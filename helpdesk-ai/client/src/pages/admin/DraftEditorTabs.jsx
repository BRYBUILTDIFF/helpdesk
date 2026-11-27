export default function DraftEditorTabs({value,onChange,reviewed,tested}) {
 const tabs=[['edit','Edit steps'],['evidence','Review evidence'],['test','Test simulation'],['publish','Publish']];
 return <nav className="draft-editor-stages draft-process-flow" aria-label="Simulation creation workflow"><ol>{tabs.map(([id,label],index)=><li key={id}><button type="button" disabled={(id==='test'&&reviewed===false)||(id==='publish'&&(!reviewed||!tested))} aria-current={value===id?'step':undefined} onClick={()=>onChange(id)}>{label}</button>{index<tabs.length-1?<svg width="28" height="16" viewBox="0 0 28 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M2 8h23m-6-5 6 5-6 5"/></svg>:null}</li>)}</ol></nav>;
}
