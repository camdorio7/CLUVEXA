'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {createClient} from '../../../../lib/supabase/client';
type Message={id:string;sender_name:string;sender_email:string;message:string;created_at:string};
export default function EmailCenter(){const {id}=useParams<{id:string}>();const [messages,setMessages]=useState<Message[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{const sb=createClient();const {data:{user}}=await sb.auth.getUser();if(!user){setError('Sign in required');setLoading(false);return}
 const [{data:member},{data:owner},{data:module}]=await Promise.all([sb.from('club_users').select('role,active').eq('club_id',id).eq('user_id',user.id).maybeSingle(),sb.rpc('is_super_admin'),sb.from('club_modules').select('licensed,club_enabled').eq('club_id',id).eq('module_key','email_center').maybeSingle()]);
 if(!(owner===true||(member?.active&&['owner','admin'].includes(member.role)))||!module?.licensed||!module?.club_enabled){setError('Email Center requires administrator access and an active license.');setLoading(false);return}
 const {data,error:e}=await sb.from('organization_site_messages').select('id,sender_name,sender_email,message,created_at').eq('club_id',id).order('created_at',{ascending:false}).limit(100);if(e)setError(e.message);else setMessages(data||[]);setLoading(false)})()},[id]);
 return <main className="v6WorkspacePage"><div className="v6PageHead"><div><div className="eyebrow cyan">COMMUNICATIONS</div><h1>Email Center</h1><p>Recent messages from your NADORIO public website contact form.</p></div></div>{loading&&<p>Loading inbox…</p>}{error&&<p role="alert" className="error">{error}</p>}{!loading&&!error&&messages.length===0&&<p>No website inquiries yet.</p>}{messages.map(m=><section className="panel" key={m.id} style={{padding:20,marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:10}}><strong>{m.sender_name}</strong><small>{new Date(m.created_at).toLocaleString()}</small></div><p><a href={`mailto:${m.sender_email}`}>{m.sender_email}</a></p><p style={{whiteSpace:'pre-wrap'}}>{m.message}</p><a className="button secondary" href={`mailto:${m.sender_email}?subject=${encodeURIComponent('Re: Website inquiry')}`}>Reply in email</a></section>)}</main>
}
