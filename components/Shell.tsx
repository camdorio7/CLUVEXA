'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {Building2,ChartNoAxesCombined,LayoutDashboard,Settings,ShieldCheck,Users,PlugZap,CreditCard,Boxes,LifeBuoy} from 'lucide-react';
import {createClient} from '../lib/supabase/client';
import NadorioLogo from './NadorioLogo';

const OWNER_CACHE='nadorio:platform-owner';
export default function Shell({children}:{children:React.ReactNode}){
 const router=useRouter(), path=usePathname();
 const cached=typeof window!=='undefined'?(()=>{try{return JSON.parse(sessionStorage.getItem(OWNER_CACHE)||'null')}catch{return null}})():null;
 const [ready,setReady]=useState(Boolean(cached?.authorized));
 const [name,setName]=useState(cached?.name||'');
 useEffect(()=>{
   ['/dashboard','/clubs','/members','/settings','/module-licensing','/marketplace','/integrations','/billing','/analytics','/support','/security'].forEach(h=>router.prefetch(h));
   (async()=>{const sb=createClient(); const {data:{user}}=await sb.auth.getUser(); if(!user){try{sessionStorage.removeItem(OWNER_CACHE)}catch{} router.replace('/login');return} const [{data:p},{data:isSuper}]=await Promise.all([sb.from('profiles').select('full_name,platform_role').eq('id',user.id).maybeSingle(),sb.rpc('is_super_admin')]); if(isSuper!==true&&p?.platform_role!=='super_admin'){try{sessionStorage.removeItem(OWNER_CACHE)}catch{} const {data:cu}=await sb.from('club_users').select('club_id').eq('user_id',user.id).eq('active',true).limit(1).maybeSingle(); if(cu?.club_id){router.replace('/workspace/'+cu.club_id);return} await sb.auth.signOut();router.replace('/login?error=unauthorized');return} const display=p?.full_name||user.email||'Platform Owner';setName(display);setReady(true);try{sessionStorage.setItem(OWNER_CACHE,JSON.stringify({authorized:true,name:display}))}catch{}})()
 },[router]);
 async function signOut(){try{sessionStorage.removeItem(OWNER_CACHE)}catch{} await createClient().auth.signOut();router.replace('/login')}
 if(!ready)return <main className="workspaceBoot" aria-label="Opening NADORIO"/>;
 const links=[['/dashboard','Overview',LayoutDashboard],['/clubs','Organizations',Building2],['/members','Platform Users',Users],['/settings','Platform Settings',Settings]] as const;
 return <div className="shell"><aside className="sidebar"><div className="cd7brand"><img src="/cd7-technologies.png" alt="CD7 Technologies"/></div><div className="platformLabel">PLATFORM OWNER</div><nav className="nav">{links.map(([href,label,Icon])=><Link prefetch key={href} className={path===href?'active':''} href={href}><Icon size={18}/><span>{label}</span></Link>)}</nav><div className="sideGroup"><div className="platformLabel">PLATFORM CONTROL</div><Link prefetch className={path==="/module-licensing"?"active":""} href="/module-licensing"><ShieldCheck size={17}/> Module Licensing</Link><Link prefetch className={path==="/marketplace"?"active":""} href="/marketplace"><Boxes size={17}/> Module Marketplace</Link><Link prefetch className={path==="/integrations"?"active":""} href="/integrations"><PlugZap size={17}/> Integrations</Link><Link prefetch className={path==="/billing"?"active":""} href="/billing"><CreditCard size={17}/> Plans & Billing</Link><Link prefetch className={path==="/analytics"?"active":""} href="/analytics"><ChartNoAxesCombined size={17}/> Analytics</Link><Link prefetch className={path==="/support"?"active":""} href="/support"><LifeBuoy size={17}/> Support</Link><Link prefetch className={path==="/security"?"active":""} href="/security"><ShieldCheck size={17}/> Security</Link></div><div className="sidefoot"><NadorioLogo/><div className="ownerName">{name}</div><div>CD7 Platform Owner</div><button className="signout" onClick={signOut}>Sign out</button><div className="version">NADORIO 6.5</div></div></aside><main className="main routeContent">{children}</main></div>
}
