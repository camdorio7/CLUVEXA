'use client';
import {FormEvent,Suspense,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {createClient} from '../../lib/supabase/client';
import CluvexaLogo from '../../components/CluvexaLogo';

function JoinContent(){
  const q=useSearchParams(),router=useRouter(),token=q.get('token')||'';
  const [invite,setInvite]=useState<any>(),[name,setName]=useState(''),[pass,setPass]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!token)return;createClient().from('club_invitations').select('*,clubs(name,logo_url,primary_color)').eq('token',token).eq('status','pending').maybeSingle().then(({data})=>{setInvite(data);setName(data?.full_name||'')})},[token]);
  async function submit(e:FormEvent){e.preventDefault();if(!invite)return;setBusy(true);const sb=createClient();const {error}=await sb.auth.signUp({email:invite.email,password:pass,options:{data:{full_name:name}}});if(error){const sign=await sb.auth.signInWithPassword({email:invite.email,password:pass});if(sign.error){setMsg(error.message);setBusy(false);return}}const {data:club,error:rpcErr}=await sb.rpc('accept_club_invitation',{invite_token:token});if(rpcErr){setMsg('Account created. If email confirmation is enabled, confirm your email, return to this invitation link, and sign in.');setBusy(false);return}router.replace('/workspace/'+club)}
  if(!token)return <main className="login"><div className="loginCard">Invalid invitation link.</div></main>;
  return <main className="login"><form className="loginCard" onSubmit={submit}><CluvexaLogo/>{invite?.clubs?.logo_url&&<img className="joinLogo" src={invite.clubs.logo_url} alt=""/>}<h1>Join {invite?.clubs?.name||'your club'}</h1><p className="muted">Create your CLUVEXA login for {invite?.email||'the invited email'}.</p><label>Name</label><input value={name} onChange={e=>setName(e.target.value)} required/><label>Email</label><input value={invite?.email||''} disabled/><label>Password</label><input type="password" minLength={8} value={pass} onChange={e=>setPass(e.target.value)} required/><button className="button gradient" disabled={busy}>{busy?'Creating…':'Create Account & Join'}</button>{msg&&<div className="error">{msg}</div>}</form></main>;
}

export default function Join(){
  return <Suspense fallback={<main className="login"><div className="loginCard">Loading invitation…</div></main>}><JoinContent/></Suspense>;
}
