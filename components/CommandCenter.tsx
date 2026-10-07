'use client';
import Link from 'next/link';
import {useEffect,useMemo,useState} from 'react';
import {AlertTriangle,ArrowRight,CalendarDays,CheckCircle2,Clock3,Home,RefreshCw,Search,ShieldCheck,UsersRound,Wrench} from 'lucide-react';
import {createClient} from '../lib/supabase/client';

type Item={key:string;title:string;detail:string;href:string;priority:'high'|'normal';icon:any};
export default function CommandCenter({id,role}:{id:string;role:string}){
 const [items,setItems]=useState<Item[]>([]); const [stats,setStats]=useState<any>({}); const [q,setQ]=useState(''); const [loading,setLoading]=useState(true); const [warning,setWarning]=useState('');
 const admin=['owner','admin','super_admin','manager'].includes(role);
 async function load(){if(!admin)return;setLoading(true);setWarning('');const sb=createClient();const now=new Date();const start=new Date(now);start.setHours(0,0,0,0);const tomorrow=new Date(start.getTime()+86400000);const in7=new Date(now.getTime()+7*86400000);const in30=new Date(now.getTime()+30*86400000);
  const results=await Promise.all([
   sb.from('member_join_requests').select('id',{count:'exact',head:true}).eq('club_id',id).eq('status','pending'),
   sb.from('staff_correction_requests').select('id',{count:'exact',head:true}).eq('club_id',id).eq('status','pending'),
   sb.from('maintenance_requests').select('id',{count:'exact',head:true}).eq('club_id',id).in('status',['open','in_progress']),
   sb.from('resource_reservations').select('id',{count:'exact',head:true}).eq('club_id',id).gte('starts_at',start.toISOString()).lt('starts_at',tomorrow.toISOString()).eq('status','confirmed'),
   sb.from('club_events').select('id',{count:'exact',head:true}).eq('club_id',id).gte('starts_at',now.toISOString()).lt('starts_at',in7.toISOString()),
   sb.from('members').select('id',{count:'exact',head:true}).eq('club_id',id).eq('status','active').lte('expires_at',in30.toISOString().slice(0,10)).gte('expires_at',now.toISOString().slice(0,10)),
   sb.from('access_log').select('id',{count:'exact',head:true}).eq('club_id',id).gte('checked_in_at',start.toISOString()).lt('checked_in_at',tomorrow.toISOString()),
   sb.from('staff_time_entries').select('id',{count:'exact',head:true}).eq('club_id',id).is('clock_out',null),
   sb.from('organization_action_items').select('id,title,description,href,priority').eq('club_id',id).eq('status','open').order('created_at',{ascending:false}).limit(8)
  ]);
  const [join,corrections,maintenance,reservations,events,members,checkins,staff,actions]=results;const errors=results.map((x:any)=>x.error).filter(Boolean);if(errors.length)setWarning('Some live metrics could not be loaded. Refresh or check this user’s module permissions.');
  const built:Item[]=[]; const add=(n:number|undefined,title:string,detail:string,href:string,priority:'high'|'normal',icon:any)=>{if(n)built.push({key:title,title:`${n} ${title}`,detail,href,priority,icon})};
  add(join.count||0,'applications waiting','Review new membership or organization applications.',`/workspace/${id}/people`,'high',UsersRound);
  add(corrections.count||0,'time corrections','Staff time requests are waiting for review.',`/workspace/${id}/staff`,'high',Clock3);
  add(maintenance.count||0,'maintenance requests','Open facility or property requests need attention.',`/workspace/${id}/industry`,'high',Wrench);
  add(members.count||0,'members expiring soon','Memberships expire within the next 30 days.',`/workspace/${id}/members`,'normal',ShieldCheck);
  (actions.data||[]).forEach((a:any)=>built.push({key:a.id,title:a.title,detail:a.description||'Organization action item',href:a.href||`/workspace/${id}`,priority:a.priority==='high'?'high':'normal',icon:AlertTriangle}));
  setItems(built);setStats({checkins:checkins.count||0,staff:staff.count||0,reservations:reservations.count||0,events:events.count||0});setLoading(false)
 }
 useEffect(()=>{load()},[id,admin]);
 const filtered=useMemo(()=>items.filter(x=>(x.title+' '+x.detail).toLowerCase().includes(q.toLowerCase())),[items,q]);
 if(!admin)return null;
 return <section className="v8CommandCenter"><div className="v8CommandHead"><div><span>LIVE COMMAND CENTER</span><h2>What needs your attention</h2><p>A live view of the work, people and activity across your organization.</p></div><div className="v8Search"><Search/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Filter attention items"/><button type="button" onClick={load} aria-label="Refresh command center"><RefreshCw size={16}/></button></div></div>{warning&&<div className="authError">{warning}</div>}<div className="v8PulseGrid"><div><UsersRound/><span>Today's check-ins</span><b>{loading?'—':stats.checkins||0}</b></div><div><Clock3/><span>Staff on duty</span><b>{loading?'—':stats.staff||0}</b></div><div><Home/><span>Today's reservations</span><b>{loading?'—':stats.reservations||0}</b></div><div><CalendarDays/><span>Events next 7 days</span><b>{loading?'—':stats.events||0}</b></div></div><div className="v8AttentionList">{loading?<div className="v8AllClear"><RefreshCw/><div><b>Loading live operations…</b><p>Checking activity and outstanding work.</p></div></div>:filtered.length?filtered.map((x,i)=>{const I=x.icon;return <Link key={x.key+'-'+i} href={x.href} className={x.priority==='high'?'urgent':''}><span className="v8AttentionIcon"><I/></span><div><b>{x.title}</b><p>{x.detail}</p></div><ArrowRight/></Link>}):<div className="v8AllClear"><CheckCircle2/><div><b>You're all caught up.</b><p>No open attention items are showing right now.</p></div></div>}</div></section>
}
