import {createClient} from '@supabase/supabase-js';
import {notFound} from 'next/navigation';
import Link from 'next/link';
import {organizationTheme} from '../../../../lib/organization-theme';
export const dynamic='force-dynamic';
type Page={slug:string;title:string;body:string};
export default async function WebsitePage({params}:{params:Promise<{id:string;slug:string}>}){
 const {id,slug}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id)||!(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)))notFound();
 const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
 const {data:site}=await sb.from('organization_sites').select('title,pages,published').eq('club_id',id).eq('published',true).maybeSingle();
 if(!site)notFound();
 const pages:Page[]=Array.isArray(site.pages)?site.pages:[];
 const page=pages.find(p=>p.slug===slug);
 if(!page)notFound();
 const {data:club}=await sb.from('clubs').select('name,logo_url,primary_color').eq('id',id).maybeSingle();
 return <main style={{...organizationTheme(club?.primary_color),minHeight:'100vh',background:'var(--club-bg)',color:'var(--club-text)',fontFamily:'system-ui,sans-serif'}}>
 <header style={{padding:'20px max(24px, calc((100vw - 1000px)/2))',borderBottom:'1px solid #9ca3af44',display:'flex',alignItems:'center',gap:14}}>{club?.logo_url&&<img src={club.logo_url} alt="" style={{width:44,height:44,objectFit:'contain'}}/>}<strong>{club?.name||site.title}</strong></header>
 <nav aria-label="Website pages" style={{maxWidth:1000,margin:'auto',padding:'16px 24px',display:'flex',gap:18,flexWrap:'wrap'}}><Link href={`/site/${id}`}>Home</Link>{pages.map(p=><Link key={p.slug} href={`/site/${id}/${p.slug}`}>{p.title}</Link>)}</nav>
 <article style={{maxWidth:900,margin:'auto',padding:'48px 24px 90px'}}><h1 style={{fontSize:'clamp(2rem,5vw,3.5rem)'}}>{page.title}</h1><div style={{whiteSpace:'pre-wrap',lineHeight:1.85,fontSize:'1.08rem'}}>{page.body}</div></article>
 <footer style={{textAlign:'center',padding:30,borderTop:'1px solid #9ca3af44'}}>Powered by CD7 Technologies · NADORIO</footer></main>
}
