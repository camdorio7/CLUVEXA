'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {createClient} from '../lib/supabase/client';
export default function Shell({children}:{children:React.ReactNode}){
 const router=useRouter(), path=usePathname(); const [ready,setReady]=useState(false); const [name,setName]=useState('');
 useEffect(()=>{(async()=>{const sb=createClient(); const {data:{user}}=await sb.auth.getUser(); if(!user){router.replace('/login');return} const {data:p}=await sb.from('profiles').select('full_name,platform_role').eq('id',user.id).single(); if(!p||p.platform_role!=='super_admin'){await sb.auth.signOut();router.replace('/login?error=unauthorized');return} setName(p.full_name||user.email||'Super Admin');setReady(true)})()},[router]);
 async function signOut(){await createClient().auth.signOut();router.replace('/login')}
 if(!ready)return <main className="loading">Loading CLUVEXA…</main>;
 const links=[['/dashboard','Overview'],['/clubs','Clubs'],['/members','Members'],['/settings','Platform Settings']];
 return <div className="shell"><aside className="sidebar"><div><div className="brand">CLUVEXA</div><div className="byline">BY CD7 TECHNOLOGIES</div></div><nav className="nav">{links.map(([href,label])=><Link key={href} className={path===href?'active':''} href={href}>{label}</Link>)}</nav><div className="sidefoot"><div>{name}</div><button className="signout" onClick={signOut}>Sign out</button><div>Super Admin Console · v0.3</div></div></aside><main className="main">{children}</main></div>
}
