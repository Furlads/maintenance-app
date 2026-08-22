'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import ChasAvatar from '@/app/components/ChasAvatar'

type Msg={id:string;role:'user'|'assistant';text:string;createdAt:string;imageDataUrl?:string}
const makeSession=()=>`chas-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
async function fileToDataUrl(file:File){return await new Promise<string>((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=reject;r.readAsDataURL(file)})}

export default function ChasPage(){
  const [workerId,setWorkerId]=useState<number|null>(null); const [workerName,setWorkerName]=useState(''); const [company,setCompany]=useState('furlads')
  const [sessionId,setSessionId]=useState(''); const [question,setQuestion]=useState(''); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [messages,setMessages]=useState<Msg[]>([]); const [imageDataUrl,setImageDataUrl]=useState('')
  const endRef=useRef<HTMLDivElement|null>(null)
  const isThreeCounties=/three|counties|tcpc/i.test(company); const accent=isThreeCounties?'#93b83d':'#facc15'; const hero=isThreeCounties?'#10240f':'#111111'
  useEffect(()=>{const id=localStorage.getItem('workerId');if(id&&Number(id)>0)setWorkerId(Number(id));setWorkerName(localStorage.getItem('workerName')||'');setCompany(localStorage.getItem('company')||'furlads');setSessionId(makeSession())},[])
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:'smooth'})},[messages,busy])
  function newChat(){setMessages([]);setQuestion('');setError('');setImageDataUrl('');setSessionId(makeSession())}
  async function send(){const q=question.trim();if(!q||busy)return;if(!workerName){setError('No worker is logged in on this device.');return}const user:Msg={id:`u-${Date.now()}`,role:'user',text:q,createdAt:new Date().toISOString(),imageDataUrl:imageDataUrl||undefined};const next=[...messages,user];setMessages(next);setBusy(true);setError('');try{const res=await fetch('/api/chas/ask',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({company,worker:workerName,workerId,sessionId,question:q,imageDataUrl})});const data=await res.json().catch(()=>null);if(!res.ok)throw new Error(data?.error||'Failed to ask Chas.');const text=data?.answer||data?.reply||data?.message||data?.result||'Chas did not return a reply.';setMessages([...next,{id:`a-${Date.now()}`,role:'assistant',text:String(text),createdAt:new Date().toISOString()}]);setQuestion('');setImageDataUrl('')}catch(e:any){setError(String(e?.message||'Failed to get a reply from Chas.'))}finally{setBusy(false)}}

  return <main style={{minHeight:'100dvh',background:'#f3f4f6',padding:'16px 14px 110px',fontFamily:'sans-serif'}}><div style={{maxWidth:760,margin:'0 auto'}}>
    <section style={{background:`linear-gradient(135deg,${hero},#1c1c1c)`,color:'#fff',borderRadius:26,padding:20,marginBottom:14,boxShadow:'0 18px 42px rgba(0,0,0,.16)'}}>
      <div style={{display:'flex',alignItems:'center',gap:14}}><ChasAvatar size={78}/><div><div style={{fontSize:12,fontWeight:900,letterSpacing:'0.1em',textTransform:'uppercase',color:accent}}>AI assistant</div><h1 style={{margin:'4px 0',fontSize:34,lineHeight:1,fontWeight:1000}}>CHAS</h1><div style={{fontSize:13,opacity:.82}}>Built for both Furlads and Three Counties Property Care</div></div></div>
      <p style={{margin:'16px 0 0',fontSize:15,lineHeight:1.5,opacity:.9}}>Ask Chas about jobs, plants, pricing, materials, safety or what to do next on site.</p>
      <div style={{display:'flex',gap:8,marginTop:14,flexWrap:'wrap'}}><Link href="/today" style={{padding:'10px 13px',borderRadius:12,background:accent,color:'#111',textDecoration:'none',fontWeight:900}}>Today</Link><Link href="/worker" style={{padding:'10px 13px',borderRadius:12,background:'rgba(255,255,255,.1)',color:'#fff',textDecoration:'none',fontWeight:900}}>More</Link><button onClick={newChat} style={{padding:'10px 13px',borderRadius:12,border:'1px solid rgba(255,255,255,.2)',background:'transparent',color:'#fff',fontWeight:900}}>New chat</button></div>
    </section>

    <section style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:22,overflow:'hidden'}}>
      <div style={{minHeight:330,maxHeight:'52dvh',overflowY:'auto',padding:16,background:'linear-gradient(#fafafa,#f5f5f5)'}}>
        {messages.length===0?<div style={{display:'flex',gap:12,alignItems:'center',padding:16,borderRadius:18,background:'#fffdf3',border:'1px solid #f0e2a1'}}><ChasAvatar size={52}/><div><b>Ask CHAS anything from site</b><div style={{fontSize:13,color:'#555',marginTop:4}}>Photos are welcome too — plant ID, damage, measurements, access issues or anything you want a second opinion on.</div></div></div>:null}
        {messages.map(m=><div key={m.id} style={{display:'flex',justifyContent:m.role==='user'?'flex-end':'flex-start',gap:8,alignItems:'flex-start',marginTop:12}}>{m.role==='assistant'?<ChasAvatar size={34}/>:null}<div style={{maxWidth:'84%',padding:'12px 14px',borderRadius:18,background:m.role==='user'?'#111':'#fffdf5',color:m.role==='user'?'#fff':'#111',border:m.role==='assistant'?'1px solid #eee0a2':'none',whiteSpace:'pre-wrap',lineHeight:1.5}}>{m.imageDataUrl?<img src={m.imageDataUrl} alt="Attached" style={{width:220,maxWidth:'100%',borderRadius:12,display:'block',marginBottom:8}}/>:null}{m.text}</div></div>)}
        {busy?<div style={{display:'flex',gap:8,alignItems:'center',marginTop:12}}><ChasAvatar size={34}/><div style={{padding:'12px 14px',borderRadius:18,background:'#fffdf5',border:'1px solid #eee0a2'}}>CHAS is replying…</div></div>:null}<div ref={endRef}/>
      </div>
      <div style={{padding:14,borderTop:'1px solid #e5e7eb'}}>
        {imageDataUrl?<div style={{display:'flex',gap:10,alignItems:'center',marginBottom:10,padding:10,background:'#fff8d9',borderRadius:14}}><img src={imageDataUrl} alt="Preview" style={{width:64,height:64,objectFit:'cover',borderRadius:12}}/><span style={{flex:1,fontWeight:800,fontSize:13}}>Photo ready to send</span><button onClick={()=>setImageDataUrl('')}>Remove</button></div>:null}
        <div style={{display:'flex',gap:8,alignItems:'flex-end'}}><label style={{width:46,height:46,border:'1px solid #ddd',borderRadius:14,display:'grid',placeItems:'center',background:'#fff',cursor:'pointer',fontSize:20}}>📸<input type="file" accept="image/*" capture="environment" style={{display:'none'}} onChange={async e=>{const f=e.target.files?.[0];if(f)setImageDataUrl(await fileToDataUrl(f));e.currentTarget.value=''}}/></label><textarea value={question} onChange={e=>setQuestion(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder="Message Chas…" style={{flex:1,minHeight:58,maxHeight:130,border:'1px solid #ddd',borderRadius:14,padding:12,fontSize:15,resize:'none'}}/><button onClick={()=>void send()} disabled={busy||!question.trim()} style={{height:46,padding:'0 18px',border:0,borderRadius:14,background:hero,color:'#fff',fontWeight:1000,opacity:busy||!question.trim()?0.6:1}}>Send</button></div>
        {error?<div style={{marginTop:10,color:'crimson',fontSize:13}}>{error}</div>:null}
      </div>
    </section>
  </div></main>
}