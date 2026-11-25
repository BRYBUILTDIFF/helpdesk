import './knowledge-sources.css';
export function SourceCitationPicker({sources,selected=[],supportType,onChange,disabled}) {
 if(!sources?.length)return null;
 const aiAdded=supportType==='ai-added';
 return <fieldset className="knowledge-citation-picker"><legend>Step evidence</legend>
 <p className={aiAdded?'knowledge-ai-added':'knowledge-step-supported'}>{aiAdded?'AI-added: requires review':'Source-backed: verify the selected evidence'}</p>
 <label className="knowledge-checkbox"><input type="checkbox" checked={aiAdded} disabled={disabled} onChange={e=>onChange([],e.target.checked?'ai-added':'source-backed')}/>This step adds information beyond the uploaded sources.</label>
 {aiAdded?<p>Check this step independently. It has no document citation and must still pass simulation validation.</p>:sources.map(source=><label key={source.sourceId} className="knowledge-checkbox"><input type="checkbox" checked={selected.includes(source.sourceId)} disabled={disabled} onChange={e=>onChange(e.target.checked?[...selected,source.sourceId]:selected.filter(id=>id!==source.sourceId),'source-backed')}/>{source.sourceId} / {source.filename} / section {source.section}</label>)}
 </fieldset>;
}
export function SourceReviewConfirmation({reviewed,onReview}) {
 return <label className="knowledge-checkbox draft-final-review"><input type="checkbox" checked={reviewed} onChange={e=>onReview(e.target.checked)}/>I reviewed the evidence and checked the AI-added steps.</label>;
}
export default function RagSourcePanel({rag}) {
 if(!rag?.sources?.length)return null;
 return <section className="rag-source-panel" aria-label="Simulation source review"><details><summary>Read retrieved passages ({rag.sources.length})</summary><p>Use these passages to check the selected step. Check AI-added instructions independently.</p>{rag.sources.map(source=><article key={source.sourceId}><h3>{source.sourceId} / {source.title}</h3><p>{source.filename} / version {source.version} / section {source.section}</p><blockquote>{source.text}</blockquote></article>)}</details></section>;
}
