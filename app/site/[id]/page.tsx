import {createClient} from '@supabase/supabase-js';
import {notFound} from 'next/navigation';
import ContactForm from './ContactForm';
import {PublicOrganizationSite,publicSiteStyles as s} from '../../../components/PublicOrganizationSite';
export const dynamic='force-dynamic';
export default async function PublicSite({params}:{params:Promise<{id:string}>}){
 const {id}=await params;if(!/^[0-9a-f-]{36}$/i.test(id))notFound();
 const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
 const {data:site}=await sb.from('organization_sites').select('*').eq('club_id',id).eq('published',true).maybeSingle();if(!site)notFound();
 const {data:club}=await sb.from('clubs').select('name,logo_url,primary_color').eq('id',id).maybeSingle();
 const services=(Array.isArray(site.services)?site.services:[]).filter((v:unknown):v is string=>typeof v==='string'&&!!v.trim()).slice(0,20);
 const pages=(Array.isArray(site.pages)?site.pages:[]).filter((p:{slug?:string;title?:string})=>p&&p.slug&&p.title);
 return <PublicOrganizationSite id={id} site={site} club={club}>
 <section className={s.hero}><div className={s.heroInner}><div className={s.eyebrow}>Welcome to {club?.name||site.title}</div><h1>{site.title}</h1>{site.tagline&&<p>{site.tagline}</p>}<a className={s.button} href="#contact">Get in touch ↗</a></div></section>
 {site.about&&<section className={s.content}><div className={s.intro}><div className={s.eyebrow}>Discover our organization</div><h2>Welcome</h2><p>{site.about}</p></div></section>}
 {(services.length>0||pages.length>0)&&<section className={s.features}><div className={s.featuresInner}><div className={s.sectionHead}><div className={s.eyebrow}>Explore</div><h2>What we offer</h2></div><div className={s.grid}>{services.map((v:string,i:number)=><div className={s.feature} key={`service-${i}`}><h3>{v}</h3></div>)}{pages.map((p:{slug:string;title:string})=><div className={s.feature} key={p.slug}><h3>{p.title}</h3><a href={`/site/${id}/${p.slug}`}>Learn more ↗</a></div>)}</div></div></section>}
 <section className={s.contact} id="contact"><div className={s.contactInner}><div><div className={s.eyebrow}>Stay connected</div><h2>Contact us</h2>{site.contact_email&&<p><a href={`mailto:${site.contact_email}`}>{site.contact_email}</a></p>}{site.phone&&<p>{site.phone}</p>}{site.address&&<p>{site.address}</p>}</div><div><ContactForm clubId={id}/></div></div></section>
 </PublicOrganizationSite>
}
