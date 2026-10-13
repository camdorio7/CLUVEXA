import {createClient} from '@supabase/supabase-js';
import {notFound} from 'next/navigation';
import ContactForm from './ContactForm';
import {organizationTheme} from '../../../lib/organization-theme';
export const dynamic='force-dynamic';
export default async function PublicSite({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
 const {data:site}=await sb.from('organization_sites').select('*').eq('club_id',id).eq('published',true).maybeSingle();
 if(!site)notFound();
 const {data:club}=await sb.from('clubs').select('name,logo_url,primary_color').eq('id',id).maybeSingle();
 const theme=organizationTheme(club?.primary_color) as React.CSSProperties;
 const services=Array.isArray(site.services)?site.services.filter((v:unknown)=>typeof v==='string').slice(0,20):[];
 return <main style={{...theme,minHeight:'100vh',background:'var(--club-bg)',color:'var(--club-text)',fontFamily:'system-ui, sans-serif'}}>
 <header style={{padding:'20px max(24px, calc((100vw - 1000px)/2))',display:'flex',alignItems:'center',gap:16,borderBottom:'1px solid #9ca3af44'}}>{club?.logo_url&&<img src={club.logo_url} alt="" style={{width:52,height:52,objectFit:'contain'}}/>}<strong>{club?.name||site.title}</strong></header>
 {Array.isArray(site.pages)&&site.pages.length>0&&<nav aria-label="Website pages" style={{maxWidth:1000,margin:'auto',padding:'14px 24px',display:'flex',flexWrap:'wrap',gap:16}}><a href={`/site/${id}`}>Home</a>{site.pages.filter((page:{slug:string;title:string})=>page.slug&&page.title).map((page:{slug:string;title:string})=><a key={page.slug} href={`/site/${id}/${page.slug}`}>{page.title}</a>)}</nav>}
 <div style={{maxWidth:1000,margin:'auto',padding:'64px 24px'}}>
 <section style={{padding:'48px 30px',borderRadius:20,background:'var(--club-primary-soft)'}}><h1 style={{fontSize:'clamp(2rem,5vw,3.6rem)',lineHeight:1.1,margin:0}}>{site.title}</h1><p style={{fontSize:'1.2rem',maxWidth:700}}>{site.tagline}</p><a href="#contact" style={{display:'inline-block',padding:'12px 20px',background:'var(--club-primary)',color:'var(--club-on-primary)',borderRadius:10,textDecoration:'none'}}>Contact us</a></section>
 {site.about&&<section style={{padding:'40px 0'}}><h2>About us</h2><p style={{whiteSpace:'pre-wrap',lineHeight:1.8}}>{site.about}</p></section>}
 {services.length>0&&<section style={{padding:'25px 0'}}><h2>What we offer</h2><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(220px,1fr))',gap:16}}>{services.map((v:string,i:number)=><div key={i} style={{padding:20,border:'1px solid #9ca3af66',borderRadius:12}}>{v}</div>)}</div></section>}
 <section id="contact" style={{padding:'30px 0'}}><h2>Contact us</h2>{site.contact_email&&<p>Email: <a href={`mailto:${site.contact_email}`}>{site.contact_email}</a></p>}{site.phone&&<p>Phone: {site.phone}</p>}{site.address&&<p>{site.address}</p>}<ContactForm clubId={id}/></section>
 </div><footer style={{textAlign:'center',padding:30,borderTop:'1px solid #9ca3af44'}}>Powered by CD7 Technologies · NADORIO</footer></main>
}
