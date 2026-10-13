'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {createClient} from '../../../../lib/supabase/client';
type Site={club_id:string;title:string;tagline:string;about:string;services:string[];contact_email:string;phone:string;address:string;published:boolean};
export default function SiteBuilder(){
 const {id}=useParams<{id:string}>();const [site,setSite]=useState<Site>({club_id:id,title:'Welcome',tagline:'',about:'',services:[],contact_email:'',phone:'',address:'',published:false});
 const [ready,setReady]=useState(false),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[authorized,setAuthorized]=useState(false);
 useEffect(()=>{(async()=>{const sb=createClient();const {data:{user}}=await sb.auth.getUser();if(!user){setMessage('Sign in required');setReady(true);return}
 const [{data:membership},{data:owner},{data:module},{data:existing}]=await Promise.all([
 sb.from('club_users').select('role,active').eq('club_id',id).eq('user_id',user.id).maybeSingle(),sb.rpc('is_super_admin'),
 sb.from('club_modules').select('licensed,club_enabled').eq('club_id',id).eq('module_key','website_builder').maybeSingle(),
 sb.from('organization_sites').select('*').eq('club_id',id).maybeSingle()]);
 if(!(owner===true||(membership?.active&&['owner','admin'].includes(membership.role)))||!module?.licensed||!module?.club_enabled){setMessage('Website Builder requires an active license and administrator access.');setReady(true);return}
 setAuthorized(true);if(existing)setSite({...existing,services:Array.isArray(existing.services)?existing.services:[]});setReady(true)})()},[id]);
 function change<K extends keyof Site>(key:K,value:Site[K]){setSite(s=>({...s,[key]:value}))}
 async function save(published:boolean){setSaving(true);setMessage('');try{const {error}=await createClient().from('organization_sites').upsert({...site,club_id:id,published,updated_at:new Date().toISOString()},{onConflict:'club_id'});if(error)throw error;change('published',published);setMessage(published?'Website published.':'Draft saved / website unpublished.')}catch(e){setMessage(e instanceof Error?e.message:'Could not save website')}finally{setSaving(false)}}
 return <main className="v6WorkspacePage" style={{maxWidth:1050}}><div className="v6PageHead"><div><div className="eyebrow cyan">NADORIO WEBSITE BUILDER</div><h1>Public website</h1><p>Create a simple business website using your organization branding.</p></div>{authorized&&<Link className="button secondary" target="_blank" href={`/site/${id}`}>View website ↗</Link>}</div>{message&&<p role="status" className="successMsg">{message}</p>}{!ready&&<p>Loading…</p>}{authorized&&<div style={{display:'grid',gap:18}}>
 <section className="panel" style={{padding:20}}><h2>Homepage</h2>{([['title','Website title'],['tagline','Short introduction'],['about','About your organization']] as const).map(([key,label])=><div className="field" key={key}><label>{label}</label><textarea rows={key==='about'?5:2} maxLength={key==='about'?5000:key==='title'?160:500} value={site[key]} onChange={e=>change(key,e.target.value)}/></div>)}</section>
 <section className="panel" style={{padding:20}}><h2>Services and highlights</h2><p className="muted">One item per line (up to 20).</p><textarea aria-label="Services" rows={5} value={site.services.join('\n')} onChange={e=>change('services',e.target.value.split('\n').slice(0,20))}/></section>
 <section className="panel" style={{padding:20}}><h2>Contact details</h2>{([['contact_email','Email'],['phone','Phone'],['address','Address']] as const).map(([key,label])=><div className="field" key={key}><label>{label}</label><input value={site[key]} onChange={e=>change(key,e.target.value)}/></div>)}</section>
 <section className="panel" style={{padding:20}}><h2>Publishing</h2><p className="muted">{site.published?'Currently published.':'Currently a draft.'} Drafts are private.</p><div style={{display:'flex',gap:10,flexWrap:'wrap'}}><button className="button secondary" disabled={saving} onClick={()=>save(false)}>Save draft / Unpublish</button><button className="button gradient" disabled={saving||!site.title.trim()} onClick={()=>save(true)}>Save & Publish</button></div></section>
 </div>}</main>
}
