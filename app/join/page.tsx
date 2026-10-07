'use client';
import {FormEvent,Suspense,useEffect,useState} from 'react';
import {useRouter,useSearchParams} from 'next/navigation';
import {createClient} from '../../lib/supabase/client';
import NadorioLogo from '../../components/NadorioLogo';

function JoinContent(){
  const q=useSearchParams(),router=useRouter(),token=q.get('token')||'';
  const [invite,setInvite]=useState<any>();
  const [loading,setLoading]=useState(true),[name,setName]=useState(''),[email,setEmail]=useState(''),[pass,setPass]=useState(''),[msg,setMsg]=useState(''),[busy,setBusy]=useState(false);
  useEffect(()=>{if(!token){setLoading(false);return;}createClient().from('club_invitations').select('*,clubs(name,logo_url,primary_color)').eq('token',token).eq('status','pending').maybeSingle().then(({data})=>{setInvite(data);setName(data?.full_name||'');setEmail(data?.email||'');setLoading(false)})},[token]);
  async function submit(e:FormEvent){
    e.preventDefault(); if(!invite)return; setMsg('');
    if(email.trim().toLowerCase()!==String(invite.email||'').trim().toLowerCase()){setMsg(`This invitation was sent to ${invite.email}. Please use that email address.`);return;}
    setBusy(true); const sb=createClient();
    const appUrl=(process.env.NEXT_PUBLIC_APP_URL||'https://app.nadorio.com').replace(/\/$/,'');
    const {error}=await sb.auth.signUp({email:email.trim(),password:pass,options:{data:{full_name:name},emailRedirectTo:`${appUrl}/join?token=${token}`}});
    if(error){const sign=await sb.auth.signInWithPassword({email:email.trim(),password:pass});if(sign.error){setMsg(error.message);setBusy(false);return}}
    const {data:club,error:rpcErr}=await sb.rpc('accept_club_invitation',{invite_token:token});
    if(rpcErr){setMsg('Your account is ready. If email confirmation is enabled, confirm your email, then return to this invitation link and sign in.');setBusy(false);return}
    router.replace('/workspace/'+club);
  }
  if(loading)return <main className="joinPage"><div className="joinCard"><div className="joinLoading">Loading your invitation…</div></div></main>;
  if(!token||!invite)return <main className="joinPage"><div className="joinCard"><div className="joinBrand"><NadorioLogo/></div><h1>Invitation unavailable</h1><p className="joinSub">This invitation is invalid, expired, or has already been used. Ask your club administrator to resend it.</p></div></main>;
  return <main className="joinPage"><section className="joinCard">
    <div className="joinBrand"><NadorioLogo/></div>
    <div className="joinClub">{invite?.clubs?.logo_url?<img className="joinLogo" src={invite.clubs.logo_url} alt=""/>:<div className="joinClubMark">{String(invite?.clubs?.name||'N').slice(0,1)}</div>}<div><span>YOU'RE INVITED TO</span><strong>{invite?.clubs?.name||'Your club'}</strong></div></div>
    <h1>Create your NADORIO account</h1>
    <p className="joinSub">Set up your secure login to access your club workspace.</p>
    <form className="joinForm" onSubmit={submit}>
      <label>Full name<input autoComplete="name" value={name} onChange={e=>setName(e.target.value)} placeholder="Your name" required/></label>
      <label>Email address<input type="email" autoComplete="email" inputMode="email" value={email} onChange={e=>setEmail(e.target.value)} required/><small>Use the email address that received this invitation.</small></label>
      <label>Password<input type="password" autoComplete="new-password" minLength={8} value={pass} onChange={e=>setPass(e.target.value)} placeholder="At least 8 characters" required/></label>
      {msg&&<div className="joinError">{msg}</div>}
      <button className="joinButton" disabled={busy}>{busy?'Creating your account…':'Accept Invitation & Create Account'}</button>
    </form>
    <div className="joinTrust"><span>Secure account setup</span><span>•</span><span>Powered by NADORIO</span></div>
  </section></main>;
}
export default function Join(){return <Suspense fallback={<main className="joinPage"><div className="joinCard"><div className="joinLoading">Loading your invitation…</div></div></main>}><JoinContent/></Suspense>}
