import {createClient} from '@supabase/supabase-js';
import {notFound} from 'next/navigation';
import {PublicOrganizationSite,publicSiteStyles as s,type PublicPage} from '../../../../components/PublicOrganizationSite';
export const dynamic='force-dynamic';
export default async function WebsitePage({params}:{params:Promise<{id:string;slug:string}>}){
 const {id,slug}=await params;if(!/^[0-9a-f-]{36}$/i.test(id)||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))notFound();
 const sb=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
 const {data:site}=await sb.from('organization_sites').select('*').eq('club_id',id).eq('published',true).maybeSingle();if(!site)notFound();
 const page=(Array.isArray(site.pages)?site.pages:[] as PublicPage[]).find((p:PublicPage)=>p.slug===slug);if(!page)notFound();
 const {data:club}=await sb.from('clubs').select('name,logo_url,primary_color').eq('id',id).maybeSingle();
 return <PublicOrganizationSite id={id} site={site} club={club} active={slug}><article className={s.article}><div className={s.eyebrow}>{club?.name||site.title}</div><h1>{page.title}</h1><div className={s.articleBody}>{page.body}</div></article></PublicOrganizationSite>
}
