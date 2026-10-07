'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import {Building2, ExternalLink} from 'lucide-react';
import {usePathname} from 'next/navigation';
import {createClient} from '../lib/supabase/client';

export default function ClubHeader({id,title,subtitle}:{id:string;title?:string;subtitle?:string}){
  const [club,setClub]=useState<any>(); const path=usePathname();
  useEffect(()=>{createClient().from('clubs').select('name,club_type,plan,status,logo_url').eq('id',id).single().then(({data})=>setClub(data))},[id]);
  const links=[['','Overview'],['/people','People & Access'],['/modules','Modules & Licensing'],['/platforms','Connected Platforms'],['/settings','Branding & Settings']];
  return <>
    <div className="clubbrand">
      <div className="clubIdentity"><div className="clubLogo large">{club?.logo_url?<img src={club.logo_url} alt=""/>:<Building2/>}</div><div><div className="eyebrow">PLATFORM OWNER · ORGANIZATION</div><h1>{title||club?.name||'Club'}</h1>{subtitle&&<div className="muted">{subtitle}</div>}<div className="chips"><span className="chip good">{club?.status||'active'}</span><span className="chip">{club?.plan}</span></div></div></div>
      <div className="platformActions"><Link prefetch className="button secondary" href={`/workspace/${id}`}>Enter Club Workspace <ExternalLink size={15}/></Link></div>
    </div>
    <div className="clubnav ownernav">{links.map(([s,l])=><Link prefetch key={s} className={path===`/clubs/${id}${s}`?'active':''} href={`/clubs/${id}${s}`}>{l}</Link>)}</div>
  </>
}
