export default function DraftEditorTabs({value,onChange,evidence,terminal}) {
 const tabs=[['edit','Edit steps'],...(evidence?[['evidence','Review evidence']]:[]),...(terminal?[['test','Test simulation']]:[])];
 return <nav className="draft-editor-stages draft-process-flow" aria-label="Simulation creation workflow"><ol>{tabs.map(([id,label],index)=><li key={id}><button type="button" aria-current={value===id?'step':undefined} onClick={()=>onChange(id)}>{label}</button>{index<tabs.length-1?<svg width="28" height="16" viewBox="0 0 28 16" fill="none" stroke="currentColor" aria-hidden="true"><path d="M2 8h23m-6-5 6 5-6 5"/></svg>:null}</li>)}</ol></nav>;
}
