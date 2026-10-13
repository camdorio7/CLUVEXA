'use client';
import {useState} from 'react';
export default function ContactForm({clubId}:{clubId:string}){
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setStatus('');const form=e.currentTarget;const fields=new FormData(form);
  try{const r=await fetch(`/api/site/${clubId}/contact`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.fromEntries(fields))});const result=await r.json();if(!r.ok)throw new Error(result.error||'Could not send message');setStatus('Message received. Thank you!');form.reset();}catch(err){setStatus(err instanceof Error?err.message:'Could not send message')}finally{setBusy(false)}
 }
 return <form onSubmit={submit} style={{maxWidth:560,display:'grid',gap:12}}><label>Name<input name="name" required maxLength={120} style={{display:'block',width:'100%',padding:12}}/></label><label>Email<input name="email" type="email" required maxLength={254} style={{display:'block',width:'100%',padding:12}}/></label><label>Message<textarea name="message" required maxLength={4000} rows={5} style={{display:'block',width:'100%',padding:12}}/></label><input name="website" aria-hidden="true" tabIndex={-1} autoComplete="off" style={{position:'absolute',left:'-9999px'}}/><button type="submit" disabled={busy} style={{background:'var(--club-primary)',color:'var(--club-on-primary)',padding:14,border:0,borderRadius:10,cursor:'pointer'}}>{busy?'Sending…':'Send message'}</button><p role="status">{status}</p></form>
}
