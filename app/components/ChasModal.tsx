'use client'

import React, { useEffect, useMemo, useRef } from 'react'
import ChasAvatar from './ChasAvatar'

type ChasMessage = { id:number; question:string; answer:string; imageDataUrl?:string|null; createdAt?:string }
type TodayJob = { id:number; title:string }
type Props = {
  open:boolean; worker:string; todaysJobs:TodayJob[]; chasMessages:ChasMessage[]; chasInput:string; chasBusy:boolean; chasError:string;
  chasJobId:number|null; chasImageDataUrl:string; onClose:()=>void; onChangeInput:(value:string)=>void; onChangeJobId:(value:number|null)=>void;
  onRemovePhoto:()=>void; onPickPhoto:(file:File)=>void|Promise<void>; onSend:()=>void|Promise<void>
}

function bubbleUser(): React.CSSProperties { return {background:'#111',color:'#fff',padding:'12px 14px',borderRadius:18,maxWidth:'86%',whiteSpace:'pre-wrap',lineHeight:1.45,fontSize:14} }
function bubbleChas(): React.CSSProperties { return {background:'#fffdf5',color:'#111',padding:'12px 14px',borderRadius:18,maxWidth:'86%',whiteSpace:'pre-wrap',lineHeight:1.5,fontSize:14,border:'1px solid #f1e4a3'} }

export default function ChasModal(props:Props) {
  const {open,worker,todaysJobs,chasMessages,chasInput,chasBusy,chasError,chasJobId,chasImageDataUrl,onClose,onChangeInput,onChangeJobId,onRemovePhoto,onPickPhoto,onSend}=props
  const fileRef=useRef<HTMLInputElement|null>(null); const endRef=useRef<HTMLDivElement|null>(null)
  useEffect(()=>{ if(!open)return; const t=window.setTimeout(()=>endRef.current?.scrollIntoView({behavior:'smooth',block:'end'}),50); return()=>window.clearTimeout(t)},[open,chasMessages.length,chasBusy])
  const helperText=useMemo(()=>chasBusy?'Chas is working on it...':'Ask about jobs, plants, pricing, safety or site questions.',[chasBusy])
  if(!open)return null

  return <div onClick={onClose} style={{position:'fixed',inset:0,background:'rgba(0,0,0,.46)',display:'flex',justifyContent:'center',alignItems:'center',padding:12,zIndex:60}}>
    <div onClick={e=>e.stopPropagation()} style={{width:'100%',maxWidth:920,height:'84vh',background:'#fff',borderRadius:22,display:'flex',flexDirection:'column',overflow:'hidden',boxShadow:'0 20px 60px rgba(0,0,0,.22)'}}>
      <div style={{padding:14,background:'linear-gradient(135deg,#111 0%,#1b1b1b 68%,#19300f 100%)',color:'#fff',display:'flex',justifyContent:'space-between',gap:12,alignItems:'center',flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:12}}><ChasAvatar size={58}/><div><div style={{fontWeight:1000,fontSize:19}}>CHAS</div><div style={{fontSize:12,opacity:.82}}>Furlads • Three Counties Property Care</div><div style={{fontSize:12,opacity:.7}}>Helping <b>{worker||'worker'}</b> on site</div></div></div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}><select value={chasJobId??''} onChange={e=>onChangeJobId(e.target.value?Number(e.target.value):null)} style={{padding:'10px 12px',borderRadius:14,border:'1px solid rgba(255,255,255,.18)',background:'#2a2a2a',color:'#fff',minWidth:220}}><option value="">No job context</option>{todaysJobs.map(j=><option key={j.id} value={j.id}>#{j.id} — {j.title}</option>)}</select><button onClick={onClose} style={{padding:'10px 12px',borderRadius:14,border:'1px solid rgba(255,255,255,.2)',background:'transparent',color:'#fff',fontWeight:900}}>Close</button></div>
      </div>
      <div style={{flex:1,padding:14,overflowY:'auto',background:'linear-gradient(180deg,#fafafa,#f5f5f5)'}}>
        {chasMessages.length===0?<div style={{maxWidth:520,margin:'24px auto 0',border:'1px solid #f0e3a2',background:'#fffdf3',borderRadius:18,padding:16,fontSize:14,lineHeight:1.5}}><div style={{display:'flex',gap:12,alignItems:'center'}}><ChasAvatar size={46}/><div><b>Ask Chas anything</b><div style={{marginTop:4}}>Send a message or photo for plant ID, cutting advice, safety help, job guidance or rough site pricing.</div></div></div></div>:null}
        {chasMessages.map(m=><div key={m.id} style={{marginBottom:16}}><div style={{display:'flex',justifyContent:'flex-end'}}><div style={bubbleUser()}>{m.question}{m.imageDataUrl?<img src={m.imageDataUrl} alt="attached" style={{width:240,maxWidth:'100%',borderRadius:14,display:'block',marginTop:10}}/>:null}</div></div><div style={{display:'flex',justifyContent:'flex-start',gap:8,marginTop:8,alignItems:'flex-start'}}><ChasAvatar size={34}/><div style={bubbleChas()}>{m.answer||'...'}</div></div></div>)}
        {chasBusy?<div style={{display:'flex',gap:8,alignItems:'center'}}><ChasAvatar size={34}/><div style={bubbleChas()}><b>Chas is thinking…</b></div></div>:null}<div ref={endRef}/>
      </div>
      <div style={{padding:14,borderTop:'1px solid #ececec',background:'#fff'}}>
        {chasImageDataUrl?<div style={{marginBottom:10,display:'flex',gap:10,alignItems:'center',padding:10,borderRadius:16,background:'#fff8d9'}}><img src={chasImageDataUrl} alt="preview" style={{width:64,height:64,objectFit:'cover',borderRadius:12}}/><div style={{flex:1,fontWeight:800,fontSize:13}}>Photo attached</div><button onClick={onRemovePhoto}>Remove</button></div>:null}
        <div style={{display:'flex',gap:8,alignItems:'flex-end'}}><button type="button" onClick={()=>fileRef.current?.click()} disabled={chasBusy} style={{width:46,height:46,borderRadius:14,border:'1px solid #ddd',background:'#fff',fontSize:20}}>📸</button><input ref={fileRef} type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={async e=>{const f=e.target.files?.[0];if(!f)return;await onPickPhoto(f);e.currentTarget.value=''}}/><textarea value={chasInput} onChange={e=>onChangeInput(e.target.value)} placeholder="Message Chas…" disabled={chasBusy} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();if(!chasBusy)onSend()}}} style={{flex:1,minHeight:58,maxHeight:130,padding:12,borderRadius:16,border:'1px solid #e2e2e2',resize:'none',fontSize:15}}/><button type="button" onClick={onSend} disabled={chasBusy||!chasInput.trim()} style={{minWidth:100,height:46,borderRadius:14,border:0,background:'#111',color:'#fff',fontWeight:1000,opacity:(chasBusy||!chasInput.trim())?.65:1}}>{chasBusy?'Sending…':'Send'}</button></div>
        {chasError?<div style={{marginTop:10,color:'crimson',fontSize:13}}>{chasError}</div>:null}<div style={{marginTop:8,fontSize:12,opacity:.65}}>{helperText}</div>
      </div>
    </div>
  </div>
}