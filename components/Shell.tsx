'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {usePathname,useRouter} from 'next/navigation';
import {Building2,ChartNoAxesCombined,LayoutDashboard,Settings,ShieldCheck,Users,PlugZap,CreditCard} from 'lucide-react';
import {createClient} from '../lib/supabase/client';
import NadorioLogo from './NadorioLogo';
export default function Shell({children}:{children:React.ReactNode}){
 const router=useRouter(), path=usePathname(); const [ready,setReady]=useState(false); const [name,setName]=useState('');
 useEffect(()=>{(async()=>{const sb=createClient(); const {data:{user}}=await sb.auth.getUser(); if(!user){router.replace('/login');return} const [{data:p},{data:isSuper}]=await Promise.all([sb.from('profiles').select('full_name,platform_role').eq('id',user.id).maybeSingle(),sb.rpc('is_super_admin')]); if(isSuper!==true&&p?.platform_role!=='super_admin'){const {data:cu}=await sb.from('club_users').select('club_id').eq('user_id',user.id).eq('active',true).limit(1).maybeSingle(); if(cu?.club_id){router.replace('/workspace/'+cu.club_id);return} await sb.auth.signOut();router.replace('/login?error=unauthorized');return} setName(p?.full_name||user.email||'Platform Owner');setReady(true)})()},[router]);
 async function signOut(){await createClient().auth.signOut();router.replace('/login')}
 if(!ready)return <main className="loading darkload">Loading NADORIO…</main>;
 const links=[['/dashboard','Overview',LayoutDashboard],['/clubs','Organizations',Building2],['/members','Platform Users',Users],['/settings','Platform Settings',Settings]] as const;
 return <div className="shell"><aside className="sidebar"><div className="cd7brand"><img src="/cd7-technologies.png" alt="CD7 Technologies"/></div><div className="platformLabel">PLATFORM OWNER</div><nav className="nav">{links.map(([href,label,Icon])=><Link key={href} className={path===href?'active':''} href={href}><Icon size={18}/><span>{label}</span></Link>)}</nav><div className="sideGroup"><div className="platformLabel">PLATFORM CONTROL</div><Link href="/clubs"><ShieldCheck size={17}/> Module Licensing</Link><Link href="/clubs"><PlugZap size={17}/> Integrations</Link><Link href="/clubs"><CreditCard size={17}/> Plans</Link><Link href="/dashboard"><ChartNoAxesCombined size={17}/> Analytics</Link></div><div className="sidefoot"><NadorioLogo/><div className="ownerName">{name}</div><div>CD7 Platform Owner</div><button className="signout" onClick={signOut}>Sign out</button><div className="version">NADORIO 2.0</div></div></aside><main className="main">{children}</main></div>
}
