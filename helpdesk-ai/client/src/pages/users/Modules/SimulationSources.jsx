import ModalCloseButton from '../../../components/ModalCloseButton';
import {useEffect,useId,useRef,useState} from 'react';
import {useAxios} from '../../../hooks/useAxios';
import './simulation-sources.css';

export default function SimulationSources({moduleId,stepIndex=0}) {
 const api=useAxios();
 const reader=useRef(null),readerTrigger=useRef(null);
 const readerTitleId=useId();
 const [open,setOpen]=useState(false),[data,setData]=useState(null),[error,setError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{reader.current?.close();setOpen(false);setData(null);setError('');},[moduleId]);
 useEffect(()=>{
  if(!moduleId||!open||data)return;
  let active=true;setError('');
  api.get('/api/simulations/modules/'+encodeURIComponent(moduleId)+'/sources').then(({data:result})=>{if(active)setData(result);}).catch(()=>{if(active)setError('Sources could not be loaded. Please retry.');});
  return()=>{active=false;};
 },[api,moduleId,open,data,retry]);
 if(!moduleId)return null;
 const step=data?.steps?.[stepIndex],ids=new Set(step?.sourceIds||[]);
 const ordered=[...(data?.sources||[])].sort((a,b)=>Number(ids.has(b.sourceId))-Number(ids.has(a.sourceId)));
 const preview=ordered.slice(0,2);
 const title=source=>source.title.replace(/_/g,' ');
 return <><details className="student-simulation-sources" open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary>Sources for this simulation</summary>
  {error?<p role="alert">{error} <button type="button" onClick={()=>setRetry(value=>value+1)}>Retry</button></p>:!data?<p role="status">Loading sources...</p>:<>
   {step?.supportType==='ai-added'?<p className="student-source-notice"><strong>AI-added explanation</strong> / reviewed by an administrator.</p>:null}
   {!data.sources.length?<p>No published source passages are available for this simulation.</p>:<><p className="student-source-caption">{data.sources.length} published {data.sources.length===1?'passage':'passages'}{data.sources.length>2?' / showing 2':''}</p>
   {preview.map(source=><article key={source.sourceId} className={'student-source-preview '+(ids.has(source.sourceId)?'is-current-step':'')}>
    <h4>{title(source)}</h4><p className="student-source-meta">Version {source.version} / section {source.section}{ids.has(source.sourceId)?' / Supports this step':''}</p>
    <p className="student-source-excerpt">{source.text.replace(/\s+/g,' ').slice(0,160)}{source.text.replace(/\s+/g,' ').length>160?'…':''}</p>
   </article>)}<button type="button" ref={readerTrigger} className="student-source-view-all" onClick={()=>reader.current.showModal()}>View all sources and full passages <span aria-hidden="true">↗</span></button></>}
  </>}
 </details><dialog ref={reader} className="student-source-reader" aria-labelledby={readerTitleId} onClose={()=>readerTrigger.current?.focus()}>
  <header><div><h2 id={readerTitleId}>Sources for this simulation</h2><p>Published document passages / {data?.sources.length||0} passages</p></div><ModalCloseButton aria-label="Close sources" onClick={()=>reader.current.close()}/></header>
  <div className="student-source-reader-body">{ordered.map(source=><article key={source.sourceId}>
   <h3>{title(source)}</h3><p className="student-source-meta">Version {source.version} / section {source.section}{ids.has(source.sourceId)?' / Supports the current step':''}</p><blockquote>{source.text}</blockquote>
  </article>)}</div>
 </dialog></>;
}
