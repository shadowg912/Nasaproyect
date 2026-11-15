"use client";
import { useEffect, useRef, useState } from "react";
import { useApi } from "@/lib/useApi";
import type { ChatRequest } from "@/lib/types";
export function AiChat(){
  const [open,setOpen]=useState(false),[messages,setMessages]=useState<ChatRequest['messages']>([]),[input,setInput]=useState(''),[busy,setBusy]=useState(false),[unavailable,setUnavailable]=useState(false),[error,setError]=useState('');
  const {data}=useApi<{hasAiKey:boolean}>('/api/status');
  const ctrl=useRef<AbortController|null>(null);
  useEffect(()=>()=>ctrl.current?.abort(),[]);
  async function send(){if(!input.trim()||busy)return;const next:ChatRequest['messages']=[...messages,{role:'user',content:input.trim()}];setMessages(next);setInput('');setBusy(true);setError('');const abort=new AbortController();ctrl.current=abort;
    try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:next}),signal:abort.signal});if(r.status===503){const json=await r.json();if(json.error==='no_api_key'){setUnavailable(true);return;}}if(!r.ok||!r.body)throw new Error('No se pudo consultar el asistente. Inténtalo de nuevo.');const reader=r.body.getReader(),decoder=new TextDecoder();let answer='';setMessages([...next,{role:'assistant',content:''}]);while(true){const {done,value}=await reader.read();if(done)break;answer+=decoder.decode(value,{stream:true});setMessages([...next,{role:'assistant',content:answer}]);}answer+=decoder.decode();setMessages([...next,{role:'assistant',content:answer}]);}
    catch(e){if(!abort.signal.aborted)setError((e as Error).message);}finally{setBusy(false);}
  }
  return <aside className="chat-shell" aria-label="Asistente IA"><button className="btn chat-toggle" aria-expanded={open} aria-controls="ai-panel" onClick={()=>setOpen(!open)}>{open?'Cerrar asistente':'Asistente IA'}</button>{open&&<div id="ai-panel" className="chat-panel"><h2 className="font-semibold">Pregunta sobre los datos</h2>{!data?.hasAiKey||unavailable?<p className="py-4">Asistente IA: disponible cuando se configure la clave</p>:<><div className="max-h-72 space-y-3 overflow-y-auto py-3" role="log" aria-label="Conversación">{messages.map((m,i)=><div key={i} className="border-l-2 border-stone-300 pl-3"><b>{m.role==='user'?'Tú':'Asistente'}</b><p className="whitespace-pre-wrap text-sm">{m.content}</p></div>)}</div>{error&&<p role="alert">{error}</p>}<form onSubmit={e=>{e.preventDefault();void send();}}><label className="block text-sm" htmlFor="ai-question">Tu pregunta</label><textarea id="ai-question" className="input w-full" value={input} onChange={e=>setInput(e.target.value)} maxLength={4000}/><button className="btn" disabled={busy||!input.trim()}>{busy?'Respondiendo…':'Enviar'}</button>{busy&&<button type="button" className="btn" onClick={()=>ctrl.current?.abort()}>Detener</button>}</form></>}</div>}</aside>;
}
