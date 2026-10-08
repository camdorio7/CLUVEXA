import {WorkspaceNavigation} from './WorkspaceNavigation';
import {StaffExpenses} from './StaffExpenses';
import {PrivateContactDetails,AdminPrivateContacts,MemberExports} from './MemberExports';
import {offerFile} from './file-export';
import {MyActivity,TimeCorrectionRequests} from './MemberActivity';
import {Time12,NHDateTime,LongShiftAlerts,WeeklyReports,ClubSearch,EventReminderLog,clock12} from './FinishTools';
import {nhDay,nhHour,nhToISO} from './club-time';
import {Timesheets,AdminRoles} from './TimeClock';
import {DirectorySettings} from './AccountTools';
import {StaffWorkspace,StaffLogin,ShiftNotes} from './StaffWorkspace';
import {StaffLookup, CheckInCorrections, AttendanceSummaries, StaffHelp, RenterReminderSettings} from './ClubTools';
import {useLiveRefresh} from './useLiveRefresh';
import {mergeCleanFields} from './live-refresh';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, CalendarDays, Camera, ChevronRight, Image as ImageIcon, MonitorPlay, Maximize2, CircleUserRound, Clock3, CloudSun, Flag, Home, LogIn, LogOut, MapPin, Menu, Megaphone, Pencil, Plus, Save, Send, Settings, ShieldCheck, Sparkles, Trophy, Utensils, Users, X, CreditCard, WalletCards, BarChart3, UserCheck, QrCode, Share2, Copy, Mail, MessageCircle, ClipboardList, History } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from './main';
import { clubDate, passBucket, matchesSearch, readAdminRows } from './admin-utils';
import { AttendanceDashboard, ScanStation, StaffOperations, RenterMyPasses, OperationsAudit, DailyReportSettings } from './Operations';
import { signalSignIn } from './operations-utils';

const HOLES = Array.from({length:18},(_,i)=>i+1);
const FRONT_NINE=HOLES.slice(0,9); const BACK_NINE=HOLES.slice(9);
const nav = [
  ['home','Home',Home],['events','Events',CalendarDays],['tournaments','Tournaments',Trophy],
  ['scorecard','My Scorecard',Flag],['guest','Guest Passes',CreditCard],['gallery','Gallery',Camera],['directory','Member Directory',Users],['member','My LINDEX',CircleUserRound],['club','Club Info',Users]
];
const blankScores = () => Object.fromEntries(HOLES.map(h=>[h,'']));
const fmtDate = d => d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}) : '';
const fmtTime = t => {
  if(!t) return '';
  const [hour='0',minute='0'] = String(t).split(':');
  const d = new Date(2000,0,1,Number(hour),Number(minute));
  return d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit',hour12:true});
};
const errText = e => e?.message || String(e);
const oneSignalAppId = import.meta.env.VITE_ONESIGNAL_APP_ID || '';
const PUBLIC_SITE_URL = 'https://linderhofmembers.com';
const IS_NATIVE_IOS = typeof navigator !== 'undefined' && /LINDEX-iOS/i.test(navigator.userAgent || '');

function withOneSignal(callback, onError){
  if(!oneSignalAppId||typeof window==='undefined'){
    onError?.(new Error('OneSignal App ID is missing.'));
    return;
  }

  // OneSignal is initialized once in index.html using the official v16 deferred
  // pattern. React only consumes the initialized instance; it never calls init().
  if(window.__lindexOneSignal){
    Promise.resolve(callback(window.__lindexOneSignal)).catch(onError);
    return;
  }
  if(window.__lindexOneSignalError){
    onError?.(window.__lindexOneSignalError);
    return;
  }

  let settled=false;
  const cleanup=()=>{
    window.removeEventListener('lindex-onesignal-ready',ready);
    window.removeEventListener('lindex-onesignal-error',failed);
    window.clearTimeout(timer);
  };
  const ready=()=>{
    if(settled)return; settled=true; cleanup();
    const sdk=window.__lindexOneSignal;
    if(!sdk){onError?.(new Error('OneSignal loaded without an SDK instance.'));return}
    Promise.resolve(callback(sdk)).catch(onError);
  };
  const failed=()=>{
    if(settled)return; settled=true; cleanup();
    onError?.(window.__lindexOneSignalError||new Error('OneSignal could not initialize.'));
  };
  const timer=window.setTimeout(()=>{
    if(settled)return; settled=true; cleanup();
    onError?.(new Error('OneSignal did not initialize. Check the browser console for the exact error.'));
  },10000);
  window.addEventListener('lindex-onesignal-ready',ready,{once:true});
  window.addEventListener('lindex-onesignal-error',failed,{once:true});
}

function calculateClubIndex(rounds=[]){
  const ordered=[...rounds].sort((a,b)=>new Date(b.played_on||b.created_at||0)-new Date(a.played_on||a.created_at||0));
  // LINDEX Club Index: an 18-hole round stands on its own. Two 9-hole rounds
  // are paired together to create one 18-hole equivalent. This keeps the system
  // simple while avoiding the volatility of blindly doubling a single nine.
  const equivalents=[];
  const nineHole=[];
  for(const round of ordered){
    const differential=Number(round.differential);
    if(!Number.isFinite(differential))continue;
    const holes=Number(round.holes_played||9);
    if(holes>=18) equivalents.push({value:differential,label:`18-hole ${differential>=0?'+':''}${differential}`});
    else nineHole.push({value:differential,date:round.played_on||round.created_at});
  }
  for(let i=0;i+1<nineHole.length;i+=2){
    const value=nineHole[i].value+nineHole[i+1].value;
    equivalents.push({value,label:`9+9 ${value>=0?'+':''}${value}`});
  }
  // Keep results ordered roughly by recency: direct 18-hole rounds and 9+9 pairs
  // are all recent-history inputs; the 20-equivalent cap keeps the index responsive.
  const recent=equivalents.slice(0,20);
  const values=recent.map(x=>x.value);
  const count=values.length;
  if(count<3)return {index:null,count,used:0,selected:[],equivalents:recent,pendingNine:nineHole.length%2};
  let used=1,adjustment=0;
  if(count===3){used=1;adjustment=-2}
  else if(count===4){used=1;adjustment=-1}
  else if(count===5){used=1}
  else if(count===6){used=2;adjustment=-1}
  else if(count<=8){used=2}
  else if(count<=11){used=3}
  else if(count<=14){used=4}
  else if(count<=16){used=5}
  else if(count<=18){used=6}
  else if(count===19){used=7}
  else used=8;
  const selected=[...values].sort((a,b)=>a-b).slice(0,used);
  const average=selected.reduce((sum,value)=>sum+value,0)/selected.length;
  const index=Math.max(-10,Math.min(54,Math.round((average+adjustment)*10)/10));
  return {index,count,used,selected,equivalents:recent,pendingNine:nineHole.length%2,adjustment};
}


function membershipLevelLabel(level){
  if(level==='social')return 'Social Member';
  if(level==='owner')return 'Owner';
  return 'Full Golf Member';
}
function membershipLevelShort(level){
  if(level==='social')return 'Social';
  if(level==='owner')return 'Owner';
  return 'Full Golf';
}

function App(){
  const [page,setPage]=useState(new URLSearchParams(window.location.search).has('admin')?'admin':'home'), [menu,setMenu]=useState(false), [session,setSession]=useState(null), [profile,setProfile]=useState(null), [passwordRecovery,setPasswordRecovery]=useState(false);
  const [events,setEvents]=useState([]), [tournaments,setTournaments]=useState([]), [scores,setScores]=useState([]), [rounds,setRounds]=useState([]), [members,setMembers]=useState([]), [announcements,setAnnouncements]=useState([]), [clubSettings,setClubSettings]=useState(null), [galleryImages,setGalleryImages]=useState([]), [tvMembers,setTvMembers]=useState([]);
  const [toast,setToast]=useState(''), [loading,setLoading]=useState(true);
  const isAdmin=profile?.role==='admin' && profile?.membership_status==='active';
  const isStaff=profile?.role==='staff' && profile?.membership_status==='active';
  const isActive=profile?.membership_status==='active' || isAdmin;
  const membershipLevel=profile?.membership_level||'full_golf';
  const hasGolfAccess=isAdmin || (isActive && ['full_golf','owner'].includes(membershipLevel));
  const notify=m=>{setToast(m);setTimeout(()=>setToast(''),3500)};

  async function loadPublic(){
    const [e,t,s,a,c,g,tm]=await Promise.all([
      supabase.from('events').select('*').order('event_date'),
      supabase.from('tournaments').select('*').order('tournament_date'),
      supabase.from('tournament_scores').select('*').eq('approved',true).order('net_score'),
      supabase.from('announcements').select('*').eq('published',true).order('created_at',{ascending:false}),
      supabase.from('club_settings').select('*').eq('id','main').maybeSingle(),
      supabase.from('gallery_images').select('*').eq('active',true).order('sort_order').order('created_at',{ascending:false}),
      supabase.from('tv_member_spotlights').select('*').eq('active',true).order('sort_order').order('created_at')
    ]);
    if(!e.error)setEvents(e.data||[]); if(!t.error)setTournaments(t.data||[]); if(!s.error)setScores(s.data||[]); if(!a.error)setAnnouncements(a.data||[]); if(!c.error)setClubSettings(c.data||null); if(!g.error)setGalleryImages(g.data||[]); if(!tm.error)setTvMembers(tm.data||[]);
  }
  useLiveRefresh(['events','tournaments','tournament_scores','announcements','club_settings','gallery_images','tv_member_spotlights'],loadPublic,{interval:30000});
  async function loadMembers(){
    if(!session){setMembers([]);return}
    const result=await supabase.from('profiles').select('id,full_name,division,handicap_index,membership_status,membership_level,good_standing,role,avatar_url,privacy_show_photo,privacy_show_club_index,privacy_show_division').eq('membership_status','active').order('full_name');
    setMembers(result.data||[]);
  }
  async function loadProfile(user){
    if(!user){setProfile(null);setRounds([]);return}
    const [p,r]=await Promise.all([
      supabase.from('profiles').select('*').eq('id',user.id).maybeSingle(),
      supabase.from('private_rounds').select('*').eq('user_id',user.id).order('played_on',{ascending:false})
    ]);
    const history=r.data||[];
    const calculated=calculateClubIndex(history);
    let nextProfile=p.data||null;
    if(nextProfile&&calculated.index!=null&&Number(nextProfile.handicap_index)!==calculated.index){
      const updated=await supabase.from('profiles').update({handicap_index:calculated.index}).eq('id',user.id).select('*').maybeSingle();
      if(!updated.error&&updated.data)nextProfile=updated.data;
    }
    setProfile(nextProfile);
    setRounds(history);
  }
  useEffect(()=>{
    const recoveryHint = window.location.hash.includes('type=recovery') || new URLSearchParams(window.location.search).get('type')==='recovery';
    if(recoveryHint){setPasswordRecovery(true);setPage('member');}
    (async()=>{const {data}=await supabase.auth.getSession();setSession(data.session);await Promise.all([loadPublic(),loadProfile(data.session?.user)]);if(data.session){const m=await supabase.from('profiles').select('id,full_name,division,handicap_index,membership_status,membership_level,good_standing,role,avatar_url,privacy_show_photo,privacy_show_club_index,privacy_show_division').eq('membership_status','active').order('full_name');setMembers(m.data||[])}setLoading(false)})();
    const {data:{subscription}}=supabase.auth.onAuthStateChange(async(event,s)=>{
      setSession(s);
      if(event==='PASSWORD_RECOVERY'){
        setPasswordRecovery(true);
        setPage('member');
      }
      await loadProfile(s?.user);
      if(s){const m=await supabase.from('profiles').select('id,full_name,division,handicap_index,membership_status,membership_level,good_standing,role,avatar_url,privacy_show_photo,privacy_show_club_index,privacy_show_division').eq('membership_status','active').order('full_name');setMembers(m.data||[])}else setMembers([])
    });
    return()=>subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    // Explicit navigation contract for the native iOS app.
    // Values map directly to the existing LINDEX page IDs used by selectPage().
    const requested=new URLSearchParams(window.location.search).get('iosPage');
    const iosPages={
      home:'home',
      events:'events',
      scorecard:'scorecard',
      directory:'directory',
      guest:'guest',
      member:'member'
    };
    if(requested && iosPages[requested]){
      setPage(iosPages[requested]);
      setMenu(false);
      window.scrollTo({top:0});
    }
  },[]);

  useEffect(()=>{
    if(!session?.user?.id)return;
    withOneSignal(async OneSignal=>{await OneSignal.login(session.user.id)});
  },[session?.user?.id]);

  useEffect(()=>{
    if(profile && !hasGolfAccess && ['scorecard','tournaments'].includes(page))setPage('home');
  },[profile?.membership_level,profile?.membership_status,page,hasGolfAccess]);

  const leaderboard=useMemo(()=>({
    Men:scores.filter(x=>x.division==='Men').slice(0,10), Women:scores.filter(x=>x.division==='Women').slice(0,10)
  }),[scores]);

  useEffect(()=>{if(!loading&&isStaff&&(window.location.pathname==='/'||window.location.pathname==='')&&!window.location.search)window.location.replace('/staff')},[loading,isStaff]);
  const selectPage=p=>{setPage(p);setMenu(false);window.scrollTo({top:0,behavior:'smooth'})};
  const cleanPath=window.location.pathname.replace(/\/+$/,'')||'/';
  const tvMode=cleanPath==='/tv';
  const verifyMode=cleanPath==='/verify';
  const guestVerifyMode=cleanPath==='/guest-verify';
  const guestPassMode=cleanPath==='/guest-pass';
  const renterPoolSignInMode=cleanPath==='/sign-in';
  const publicGuestPurchaseMode=cleanPath==='/guest-passes'||cleanPath==='/renters';
  const privacyMode=cleanPath==='/privacy';
  const termsMode=cleanPath==='/terms';
  if(cleanPath==='/staff')return loading?<div className="staff-shell"><div className="card">Loading staff workspace…</div></div>:!session?<StaffLogin/>:<StaffWorkspace profile={profile} events={events} tournaments={tournaments} clubSettings={clubSettings}/>;
  if(cleanPath==='/admin')return loading?<div className="staff-shell"><div className="card">Loading administration…</div></div>:!session?<StaffLogin admin/>:<div className="staff-shell admin-shell"><header className="staff-header"><a className="staff-brand" href="/admin"><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><span>LINDEX<small>ADMINISTRATION</small><span className="cd7-admin-credit">Powered by CD7 Technologies</span></span></a><div><b>{profile?.full_name||session.user.email}</b><a href="/staff">Staff workspace</a><a href="/?iosPage=member">My account</a><button className="secondary small" onClick={async()=>{const {error}=await supabase.auth.signOut({scope:'local'});if(error)notify(error.message)}}>Sign out</button></div></header>{isAdmin?<Admin profile={profile} events={events} announcements={announcements} tournaments={tournaments} clubSettings={clubSettings} members={members} galleryImages={galleryImages} tvMembers={tvMembers} reload={async()=>{await loadPublic();await loadMembers()}} notify={notify}/>:<div className="card"><h2>Administrator access required</h2><p>This area is for active administrator accounts.</p></div>}{toast&&<div className="toast">{toast}</div>}</div>;
  if(privacyMode)return <PrivacyPolicy/>;
  if(termsMode)return <TermsOfUse/>;
  if(tvMode)return <TVMode loading={loading} events={events} announcements={announcements} clubSettings={clubSettings} galleryImages={galleryImages} tvMembers={tvMembers}/>;
  if(verifyMode)return <MemberVerification/>;
  if(guestVerifyMode)return <GuestPassVerification/>;
  if(guestPassMode)return <GuestPassPublic/>;
  if(renterPoolSignInMode)return <RenterPoolSignIn clubSettings={clubSettings}/>;
  if(publicGuestPurchaseMode)return <PublicGuestPurchase/>;
  return <div className="app">
    <aside className={menu?'sidebar open':'sidebar'}>
      <button className="close" onClick={()=>setMenu(false)}><X/></button>
      <div className="brand"><img src="/assets/lindex-app-icon.png"/><h1>LINDEX</h1><p>YOUR DIGITAL CLUBHOUSE</p><a className="cd7-brand-credit" href="https://cd7technologies.com" target="_blank" rel="noopener noreferrer"><span>Powered by</span> <strong>CD7 Technologies</strong><span aria-hidden="true"> ↗</span></a></div>
      <nav>{nav.filter(([id])=>(!session||id!=='gallery')&&(hasGolfAccess||!['tournaments','scorecard'].includes(id))).map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>selectPage(id)}><Icon size={18}/>{label}</button>)}{(isAdmin||isStaff)&&<button className={page==='admin'?'active':''} onClick={()=>window.location.assign(isStaff?'/staff':'/admin')}><ShieldCheck size={18}/>{isStaff?'Staff':'Admin'}</button>}</nav>
      <div className="side-foot"><b>LINDEX</b><br/>by Linderhof Country Club<br/>Your Digital Clubhouse</div>
    </aside>
    <main>
      <header><button className="menu" onClick={()=>setMenu(true)}><Menu/></button><div><small>LINDEX • Linderhof Country Club</small><h2>{[...nav,['admin','Admin']].find(x=>x[0]===page)?.[1]}</h2></div><div className={`status ${isActive?'ok':''}`}>{session?(isActive?(isAdmin?'Admin':membershipLevelLabel(membershipLevel)):'Pending Approval'):'Guest'}</div></header>
      <div className="content">
        {loading?<div className="card">Loading portal…</div>:<>
          {page==='home'&&<HomePage signedIn={!!session} announcements={announcements} events={events} go={selectPage} profile={profile} active={isActive} hasGolfAccess={hasGolfAccess} clubSettings={clubSettings}/>} 
          {page==='events'&&<Events events={events} session={session} profile={profile} notify={notify}/>} 
          {page==='tournaments'&&(hasGolfAccess?<Tournaments tournaments={tournaments} leaderboard={leaderboard} session={session} profile={profile} reload={loadPublic} notify={notify}/>:<AccessRestricted title="Tournaments"/>)} 
          {page==='guest'&&<GuestPasses session={session} profile={profile} active={isActive} notify={notify}/>}
          {page==='scorecard'&&(hasGolfAccess?<Scorecard session={session} active={isActive} rounds={rounds} reload={async()=>{await loadProfile(session?.user);await loadMembers()}} notify={notify}/>:<AccessRestricted title="Scorecard"/>)} 
          {page==='gallery'&&!session&&<Gallery galleryImages={galleryImages}/>}
          {page==='directory'&&<MemberDirectory session={session} active={isActive} members={members}/>}
          {page==='member'&&<Member session={session} profile={profile} rounds={rounds} reload={()=>loadProfile(session?.user)} notify={notify} forceRecovery={passwordRecovery} onRecoveryComplete={()=>setPasswordRecovery(false)} hasGolfAccess={hasGolfAccess}/>} 
          {page==='club'&&<Club clubSettings={clubSettings}/>}
          {page==='admin'&&(isAdmin||isStaff)&&<Admin profile={profile} staffMode={isStaff} events={events} announcements={announcements} tournaments={tournaments} clubSettings={clubSettings} members={members} galleryImages={galleryImages} tvMembers={tvMembers} reload={async()=>{await loadPublic();await loadMembers()}} notify={notify}/>} 
        </>}
        <footer className="portal-legal-footer"><a href="/privacy">Privacy Policy</a><br/><a className="cd7-powered-link" href="https://cd7technologies.com" target="_blank" rel="noopener noreferrer">Powered by CD7 Technologies</a></footer>
      </div>
    </main>
    <nav className="mobile-bottom-nav">
      {[['home','Home',Home],['events','Events',CalendarDays],['scorecard','Score',Flag],['directory','Members',Users],['member','Profile',CircleUserRound]].filter(([id])=>hasGolfAccess||id!=='scorecard').map(([id,label,Icon])=><button key={id} className={page===id?'active':''} onClick={()=>selectPage(id)}><Icon size={20}/><span>{label}</span></button>)}
    </nav>
    {toast&&<div className="toast">{toast}</div>}
  </div>
}


function TVMode({loading,events,announcements,clubSettings,galleryImages=[],tvMembers=[]}){
  const [weather,setWeather]=useState(null);
  const [slide,setSlide]=useState(0);
  const [now,setNow]=useState(new Date());
  const [isFullscreen,setIsFullscreen]=useState(Boolean(document.fullscreenElement));
  const [fullscreenError,setFullscreenError]=useState('');
  const enterFullscreen=async()=>{
    setFullscreenError('');
    try{
      if(document.fullscreenElement)return;
      const el=document.documentElement;
      const request=el.requestFullscreen||el.webkitRequestFullscreen||el.msRequestFullscreen;
      if(!request)throw new Error('Full screen is not supported by this browser. Try F11 or the browser menu.');
      await request.call(el);
    }catch(err){
      setFullscreenError(err?.message||'Could not enter full screen. Try F11 or the browser menu.');
    }
  };
  useEffect(()=>{
    const onFullscreenChange=()=>setIsFullscreen(Boolean(document.fullscreenElement||document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange',onFullscreenChange);
    document.addEventListener('webkitfullscreenchange',onFullscreenChange);
    fetch('https://api.open-meteo.com/v1/forecast?latitude=44.0878&longitude=-71.2817&current=temperature_2m,weather_code,wind_speed_10m&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York')
      .then(r=>r.ok?r.json():null).then(d=>setWeather(d?.current||null)).catch(()=>{});
    const clock=setInterval(()=>setNow(new Date()),30000);
    const refresh=setInterval(()=>window.location.reload(),5*60*1000);
    return()=>{clearInterval(clock);clearInterval(refresh);document.removeEventListener('fullscreenchange',onFullscreenChange);document.removeEventListener('webkitfullscreenchange',onFullscreenChange)};
  },[]);
  const seconds=Math.max(8,Math.min(60,Number(clubSettings?.tv_slide_seconds||18)));
  const dayKeys=['sunday_hours','monday_hours','tuesday_hours','wednesday_hours','thursday_hours','friday_hours','saturday_hours'];
  const hours=clubSettings?.[dayKeys[nhDay()]]||((nhDay()>=1&&nhDay()<=4)?'2:00 PM – Close':'12:00 PM – Close');
  const future=events.filter(e=>(e.tv_visible!==false)&&(!e.event_date||e.event_date>=clubDate()));
  const eventGroups=[];for(let i=0;i<future.length;i+=3)eventGroups.push(future.slice(i,i+3));
  const photos=(galleryImages.length?galleryImages.map(x=>x.image_url):[clubSettings?.gallery_image_1_url||'/assets/course-aerial-1.png',clubSettings?.gallery_image_2_url||'/assets/pool.jpg',clubSettings?.gallery_image_3_url||'/assets/course-aerial-2.jpg']).filter(Boolean).slice(0,6);
  const slides=[
    {id:'welcome',content:<div className="tv-welcome"><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><small>LINDEX • LINDERHOF COUNTRY CLUB</small><h1>LINDEX</h1><h2>YOUR DIGITAL CLUBHOUSE</h2><p>{clubSettings?.tv_custom_message||'Welcome to LINDEX'}</p></div>},
    clubSettings?.tv_show_status!==false&&{id:'status',content:<div className="tv-content"><div className="tv-kicker">Live at Linderhof</div><h2>Today at the Club</h2><div className="tv-status-grid"><div><Flag/><small>Course</small><b>{clubSettings?.course_status||'Open'}</b><span>{clubSettings?.course_status_note||'Enjoy your round.'}</span></div><div><CloudSun/><small>Weather</small><b>{weather?`${Math.round(weather.temperature_2m)}°F`:'Bartlett, NH'}</b><span>{weather?.wind_speed_10m!=null?`Wind ${Math.round(weather.wind_speed_10m)} mph`:'White Mountains'}</span></div><div><Clock3/><small>Clubhouse</small><b>{hours}</b><span>{clubSettings?.hours_note||'Members and guests welcome.'}</span></div></div></div>},
    clubSettings?.tv_show_special!==false&&clubSettings?.daily_special&&{id:'special',content:<div className="tv-content tv-special"><div className="tv-kicker">From the clubhouse</div><Utensils/><h2>Today’s Special</h2><h3>{clubSettings.daily_special}</h3><p>{clubSettings.daily_special_note||'Available while supplies last.'}</p></div>},
    ...((clubSettings?.tv_show_events!==false)?eventGroups.map((group,groupIndex)=>({id:`events-${groupIndex}`,content:<div className="tv-content"><div className="tv-kicker">Coming Up</div><h2>Upcoming Events{eventGroups.length>1?` • ${groupIndex+1}/${eventGroups.length}`:''}</h2><div className="tv-event-list">{group.map(e=><article key={e.id}><div className="tv-date"><b>{e.event_date?new Date(`${e.event_date}T12:00:00`).toLocaleDateString(undefined,{day:'2-digit'}):'--'}</b><span>{e.event_date?new Date(`${e.event_date}T12:00:00`).toLocaleDateString(undefined,{month:'short'}):'Soon'}</span></div><div><small>{e.event_type||'Club Event'}</small><h3>{e.title}</h3><p>{e.description||fmtDate(e.event_date)}</p></div></article>)}</div></div>})):[]),
    ...((clubSettings?.tv_show_events!==false)?future.filter(e=>e.image_url).map((e,i)=>({id:`event-flyer-${e.id||i}`,content:<div className="tv-content tv-event-flyer-slide"><div className="tv-event-flyer-copy"><div className="tv-kicker">Upcoming Event</div><h2>{e.title}</h2><p className="tv-event-flyer-meta">{fmtDate(e.event_date)}{e.event_time?` • ${fmtTime(e.event_time)}`:''}</p>{e.description&&<p className="tv-event-flyer-description">{e.description}</p>}</div><div className="tv-event-flyer-frame"><img src={e.image_url} alt={`${e.title} flyer`}/></div></div>})):[]),
    clubSettings?.tv_show_announcements!==false&&announcements.length>0&&{id:'announcements',content:<div className="tv-content"><div className="tv-kicker">Club News</div><h2>Latest Announcements</h2><div className="tv-news-list">{announcements.slice(0,3).map((a,i)=><article key={a.id}><span>{i+1}</span><div><h3>{a.title}</h3><p>{a.message}</p></div></article>)}</div></div>},
    clubSettings?.tv_show_photos!==false&&photos.length>0&&{id:'photos',content:<div className="tv-content tv-photo-slide"><div><div className="tv-kicker">Around the Club</div><h2>Life at Linderhof</h2></div><div className="tv-photo-grid">{photos.map((src,i)=><img src={src} alt={`Linderhof ${i+1}`} key={`${src}-${i}`}/>)}</div></div>},
    clubSettings?.tv_show_members!==false&&tvMembers.length>0&&{id:'members',content:<div className="tv-content"><div className="tv-kicker">Member Spotlight</div><h2>Meet Our Members</h2><div className="tv-member-grid">{tvMembers.slice(0,3).map(member=><article key={member.id}><div className="tv-member-photo">{member.photo_url?<img src={member.photo_url} alt={member.display_name}/>:<span>{(member.display_name||'L').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()}</span>}</div><div><small>{member.division||'Linderhof Member'}</small><h3>{member.display_name}</h3>{member.club_index!=null&&<p><b>Club Index {member.club_index}</b></p>}{member.subtitle&&<p>{member.subtitle}</p>}</div></article>)}</div></div>}
  ].filter(Boolean);
  useEffect(()=>{setSlide(0)},[slides.length]);
  useEffect(()=>{if(slides.length<2)return;const timer=setInterval(()=>setSlide(v=>(v+1)%slides.length),seconds*1000);return()=>clearInterval(timer)},[slides.length,seconds]);
  if(loading)return <div className="tv-mode tv-loading">Loading Linderhof TV…</div>;
  const active=slides[slide%slides.length]||slides[0];
  return <div className="tv-mode" style={{'--tv-hero':`url("${clubSettings?.hero_image_url||'/assets/image-1.jpg'}")`}}>
    <div className="tv-background"></div><div className="tv-shade"></div>
    {!isFullscreen&&<div className="tv-fullscreen-prompt"><button onClick={enterFullscreen}><Maximize2 size={24}/><span><b>Enter Full Screen</b><small>Hide the browser bar for clubhouse TV</small></span></button>{fullscreenError&&<p>{fullscreenError}</p>}</div>}
    <header className="tv-header"><div><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><span>LINDEX <small>• Linderhof Country Club</small></span></div><div className="tv-clock"><b>{now.toLocaleTimeString('en-US',{timeZone:'America/New_York',hour:'numeric',minute:'2-digit',hour12:true})}</b><span>{now.toLocaleDateString('en-US',{timeZone:'America/New_York',weekday:'long',month:'long',day:'numeric'})}</span></div></header>
    <main className="tv-stage" key={active?.id}>{active?.content}</main>
    <footer className="tv-footer"><div className="tv-dots">{slides.map((s,i)=><button aria-label={`Show ${s.id}`} key={s.id} className={i===slide?'active':''} onClick={()=>setSlide(i)}/>)}</div><div className="tv-footer-brand"><span className="tv-site-address">linderhofmembers.com</span><a className="tv-cd7-credit" href="https://cd7technologies.com" target="_blank" rel="noopener noreferrer">Powered by CD7 Technologies</a></div></footer>
    <div className="tv-progress" key={`${slide}-${seconds}`} style={{animationDuration:`${seconds}s`}}></div>
  </div>;
}

function HomePage({signedIn,announcements,events,go,profile,active,hasGolfAccess,clubSettings}){
  const [weather,setWeather]=useState(null);
  useEffect(()=>{
    fetch('https://api.open-meteo.com/v1/forecast?latitude=44.0878&longitude=-71.2817&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York')
      .then(r=>r.ok?r.json():null).then(d=>setWeather(d?.current||null)).catch(()=>{});
  },[]);
  const now=new Date();
  const greeting=nhHour()<12?'Good morning':nhHour()<17?'Good afternoon':'Good evening';
  const firstName=profile?.full_name?.trim()?.split(/\s+/)[0];
  const day=nhDay();
  const dayKeys=['sunday_hours','monday_hours','tuesday_hours','wednesday_hours','thursday_hours','friday_hours','saturday_hours'];
  const clubhouseHours=clubSettings?.[dayKeys[day]] || ((day>=1&&day<=4)?'2:00 PM – Close':'12:00 PM – Close');
  const weatherText=weather?`${Math.round(weather.temperature_2m)}°F`:'Bartlett, NH';
  const featuredEvent=clubSettings?.featured_event_id?events.find(e=>e.id===clubSettings.featured_event_id):null;
  const nextEvent=featuredEvent||events.find(e=>!e.event_date||e.event_date>=clubDate())||events[0];
  const courseStatus=clubSettings?.course_status||'Open';
  const courseStatusNote=clubSettings?.course_status_note||'Enjoy your round.';
  const dailySpecial=clubSettings?.daily_special||'';
  return <>
    <section className="dashboard-hero" style={{backgroundImage:`url(${clubSettings?.hero_image_url||'/assets/image-1.jpg'})`}}>
      <div className="dashboard-overlay"></div>
      <div className="dashboard-hero-copy">
        <span className="eyebrow"><Sparkles size={15}/> LINDEX • Your Digital Clubhouse</span>
        <h1>{greeting}{firstName?`, ${firstName}`:''}.</h1>
        <p>Your club, your golf, and everything happening at Linderhof — all in one place.</p>
        <div className="hero-actions">
          {hasGolfAccess&&<button className="primary hero-button" onClick={()=>go('scorecard')}><Flag size={18}/> Enter Today's Score</button>}
          <button className="glass-button" onClick={()=>go('events')}><CalendarDays size={18}/> Browse Events</button>
        </div>
      </div>
      <div className="hero-badge"><img src={clubSettings?.crest_image_url||"/assets/linderhof-crest.png"} alt="Linderhof crest"/></div>
    </section>

    <section className="dashboard-snapshot">
      <article className="snapshot-card featured-status">
        <div className="snapshot-icon"><Flag/></div><div><small>Course Status</small><h3>{courseStatus}</h3><p>{courseStatusNote}</p></div><span className="live-dot">Live</span>
      </article>
      <article className="snapshot-card">
        <div className="snapshot-icon"><CloudSun/></div><div><small>Current Weather</small><h3>{weatherText}</h3><p><MapPin size={13}/> Bartlett, New Hampshire</p></div>
      </article>
      <article className="snapshot-card">
        <div className="snapshot-icon"><Clock3/></div><div><small>Clubhouse Today</small><h3>{clubhouseHours}</h3><p>Members and guests welcome.</p></div>
      </article>
      <article className="snapshot-card">
        <div className="snapshot-icon"><CircleUserRound/></div><div><small>Membership</small><h3>{active?(membershipLevelLabel(profile?.membership_level)):'Guest Access'}</h3><p>{hasGolfAccess&&profile?.handicap_index!=null?`Club Index: ${profile.handicap_index}`:profile?.membership_level==='social'?'Social access — golf features are not included.':'Sign in to view your profile.'}</p></div>
      </article>
    </section>

    <section className="section dashboard-section">
      <div className="section-title"><div><small>Member shortcuts</small><h3>Quick Actions</h3></div></div>
      <div className="quick-action-grid">
        {hasGolfAccess&&<button onClick={()=>go('scorecard')}><Flag/><span><b>Enter Score</b><small>Save a 9 or 18-hole round</small></span><ChevronRight/></button>}
        <button onClick={()=>go('events')}><CalendarDays/><span><b>Club Events</b><small>See what is coming up</small></span><ChevronRight/></button>
        <button onClick={()=>go('directory')}><Users/><span><b>Member Directory</b><small>Find members and club indexes</small></span><ChevronRight/></button>
        {!signedIn&&<button onClick={()=>go('gallery')}><Camera/><span><b>Photo Gallery</b><small>See life around the club</small></span><ChevronRight/></button>}
      </div>
    </section>

    <section className="section dashboard-section">
      <div className="section-title"><div><small>Coming up</small><h3>Next at Linderhof</h3></div><button className="text-link" onClick={()=>go('events')}>View all <ChevronRight size={16}/></button></div>
      {nextEvent?<article className="next-event-card">
        <div className="date-block"><b>{nextEvent.event_date?new Date(`${nextEvent.event_date}T12:00:00`).toLocaleDateString(undefined,{day:'2-digit'}):'--'}</b><span>{nextEvent.event_date?new Date(`${nextEvent.event_date}T12:00:00`).toLocaleDateString(undefined,{month:'short'}):'Soon'}</span></div>
        <div className="next-event-copy"><span className="pill">{nextEvent.event_type||'Club Event'}</span><h3>{nextEvent.title}</h3><p>{nextEvent.description||'More details will be shared soon.'}</p><small>{fmtDate(nextEvent.event_date)}{nextEvent.event_time?` • ${fmtTime(nextEvent.event_time)}`:''}</small></div>
        <button className="secondary" onClick={()=>go('events')}>Event Details <ChevronRight size={16}/></button>
      </article>:<div className="card empty-premium"><CalendarDays/><div><h4>No upcoming events yet</h4><p>New club events will appear here as soon as they are published.</p></div></div>}
    </section>

    {dailySpecial&&<section className="section dashboard-section">
      <div className="section-title"><div><small>From the clubhouse</small><h3>Today’s Special</h3></div></div>
      <article className="daily-special-card"><div className="snapshot-icon"><Utensils/></div><div><span>Clubhouse Special</span><h4>{dailySpecial}</h4><p>{clubSettings?.daily_special_note||'Available while supplies last.'}</p></div></article>
    </section>}

    <section className="section dashboard-section">
      <div className="section-title"><div><small>Photo highlights</small><h3>Around the Club</h3></div><button className="text-link" onClick={()=>go('gallery')}>View gallery <ChevronRight size={16}/></button></div>
      <div className="home-photo-grid">
        {[clubSettings?.gallery_image_1_url||'/assets/course-aerial-1.png',clubSettings?.gallery_image_2_url||'/assets/pool.jpg',clubSettings?.gallery_image_3_url||'/assets/course-aerial-2.jpg'].map((src,i)=><button key={src+i} onClick={()=>go('gallery')}><img src={src} alt={`Linderhof photo ${i+1}`}/></button>)}
      </div>
    </section>

    <section className="section dashboard-section">
      <div className="section-title"><div><small>Club updates</small><h3>Latest Announcements</h3></div></div>
      <div className="announcement-grid">{announcements.length?announcements.slice(0,3).map((a,i)=><article className={`announcement-card ${i===0?'lead':''}`} key={a.id}><span>{i===0?'Featured Update':'Club Notice'}</span><h4>{a.title}</h4><p>{a.message}</p></article>):<article className="announcement-card lead"><span>Welcome</span><h4>The digital clubhouse is open</h4><p>Announcements, events, scores, and tournament updates will be posted here throughout the season.</p></article>}</div>
    </section>
  </>
}
function Events({events,session,profile,notify}){
  const today=new Date(`${clubDate()}T12:00:00`);
  const [rsvps,setRsvps]=useState({});
  const [availability,setAvailability]=useState({});
  async function loadAvailability(){const {data}=await supabase.rpc('event_availability');if(data)setAvailability(Object.fromEntries(data.map(r=>[r.id,r])))}
  useEffect(()=>{loadAvailability()},[]);useLiveRefresh(['events','event_rsvps'],loadAvailability);

  const [drafts,setDrafts]=useState({});
  const [savingRsvps,setSavingRsvps]=useState({});
  const loadRsvps=async()=>{
    if(!session?.user?.id){setRsvps({});return}
    const {data}=await supabase.from('event_rsvps').select('*').eq('user_id',session.user.id);
    setRsvps(Object.fromEntries((data||[]).map(x=>[x.event_id,x])));
  };
  useEffect(()=>{loadRsvps()},[session?.user?.id]);
  const updateDraft=(id,patch)=>setDrafts(prev=>({...prev,[id]:{attendee_count:prev[id]?.attendee_count??rsvps[id]?.attendee_count??1,...patch}}));
  async function saveRsvp(event,status='going'){
    if(!session?.user?.id)return notify?.('Sign in to sign up.');
    if(profile?.membership_status!=='active')return notify?.('Your membership must be active to sign up.');
    if(savingRsvps[event.id])return;
    const count=Number(drafts[event.id]?.attendee_count??rsvps[event.id]?.attendee_count??1);
    if(status==='going'&&(!Number.isInteger(count)||count<1||count>10))return notify?.('Enter a whole number from 1 to 10.');
    setSavingRsvps(prev=>({...prev,[event.id]:true}));
    try{
      const payload={event_id:event.id,user_id:session.user.id,status,attendee_count:status==='going'?count:1,payment_status:rsvps[event.id]?.payment_status==='paid'?'paid':(event.square_url?'pending':'not_required'),updated_at:new Date().toISOString()};
      const {error}=await supabase.from('event_rsvps').upsert(payload,{onConflict:'event_id,user_id'});
      if(error)throw error;
      await loadRsvps();await loadAvailability();
      notify?.(status==='going'?`Saved: ${count} ${count===1?'person':'people'} attending.`:'Sign-up canceled. Contact the clubhouse if you already paid.');
    }catch(error){notify?.(errText(error))}
    finally{setSavingRsvps(prev=>({...prev,[event.id]:false}))}
  }
  const [month,setMonth]=useState(new Date(today.getFullYear(),today.getMonth(),1));
  const [selectedDate,setSelectedDate]=useState(null);
  const year=month.getFullYear(), monthIndex=month.getMonth();
  const firstDay=new Date(year,monthIndex,1).getDay();
  const daysInMonth=new Date(year,monthIndex+1,0).getDate();
  const monthLabel=month.toLocaleDateString(undefined,{month:'long',year:'numeric'});
  const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const eventsByDate=useMemo(()=>events.reduce((map,event)=>{if(event.event_date)(map[event.event_date]??=[]).push(event);return map},{}),[events]);
  const selectedEvents=selectedDate?(eventsByDate[selectedDate]||[]):[];
  const visibleEvents=selectedDate?selectedEvents:events.filter(e=>!e.event_date||e.event_date>=clubDate());
  const calendarCells=[...Array(firstDay).fill(null),...Array.from({length:daysInMonth},(_,i)=>i+1)];

  function addToCalendar(event){
    if(!event.event_date)return;
    const compact=value=>value.replace(/[-:]/g,'');
    const startTime=(event.event_time||'12:00').slice(0,5);
    let startISO;try{startISO=nhToISO(`${event.event_date}T${startTime}`)}catch(e){notify(e.message);return}
    const icsTime=v=>new Date(v).toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');
    const start=icsTime(startISO),end=icsTime(new Date(new Date(startISO).getTime()+7200000));
    const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
    const ics=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Linderhof Country Club//Member Portal//EN','BEGIN:VEVENT',`UID:${event.id||crypto.randomUUID()}@linderhofmembers.com`,`DTSTAMP:${new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'')}`,`DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${escape(event.title)}`,`DESCRIPTION:${escape(event.description||'Linderhof Country Club event')}`,'LOCATION:Linderhof Country Club, Bartlett, NH','END:VEVENT','END:VCALENDAR'].join('\r\n');
    offerFile(new Blob([ics],{type:'text/calendar;charset=utf-8'}),`${(event.title||'linderhof-event').replace(/[^a-z0-9]+/gi,'-').toLowerCase()}.ics`);
  }

  return <section>
    <div className="section-title"><div><small>Club calendar</small><h3>Events at Linderhof</h3></div></div>
    <div className="calendar-layout">
      <div className="card club-calendar">
        <div className="calendar-head"><button className="calendar-arrow" onClick={()=>setMonth(new Date(year,monthIndex-1,1))} aria-label="Previous month">‹</button><div><small>Browse events</small><h3>{monthLabel}</h3></div><button className="calendar-arrow" onClick={()=>setMonth(new Date(year,monthIndex+1,1))} aria-label="Next month">›</button></div>
        <div className="calendar-weekdays">{['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(day=><span key={day}>{day}</span>)}</div>
        <div className="calendar-grid">{calendarCells.map((day,index)=>{
          if(!day)return <span className="calendar-empty" key={`empty-${index}`}/>;
          const current=new Date(year,monthIndex,day), key=dateKey(current), dayEvents=eventsByDate[key]||[];
          const isToday=dateKey(today)===key, isSelected=selectedDate===key;
          return <button key={key} className={`calendar-day ${isToday?'today':''} ${isSelected?'selected':''} ${dayEvents.length?'has-event':''}`} onClick={()=>setSelectedDate(isSelected?null:key)}><b>{day}</b>{dayEvents.length>0&&<span>{dayEvents.length}</span>}</button>
        })}</div>
        <div className="calendar-legend"><span><i className="event-dot"/> Event date</span>{selectedDate&&<button className="text-link" onClick={()=>setSelectedDate(null)}>Show all upcoming</button>}</div>
      </div>

      <div className="calendar-agenda">
        <div className="section-title compact"><div><small>{selectedDate?'Selected date':'Coming up'}</small><h3>{selectedDate?fmtDate(selectedDate):'Upcoming Events'}</h3></div></div>
        <div className="event-stack">{visibleEvents.length?visibleEvents.map(e=><article className="card event calendar-event" key={e.id}>{e.image_url&&<img src={e.image_url} alt=""/>}<div className="pad"><span className="pill">{e.event_type||'Club Event'}</span><h3>{e.title}</h3><p><b>{fmtDate(e.event_date)}</b>{e.event_time?` • ${fmtTime(e.event_time)}`:''}</p>{e.description&&<p>{e.description}</p>}{e.location&&<p>Location: {e.location}</p>}{e.rsvp_deadline&&<p>RSVP by {fmtDate(e.rsvp_deadline.slice(0,10))} at {clock12(e.rsvp_deadline.slice(11,16))} · NH time</p>}<div className="calendar-event-actions"><button className="secondary small" onClick={()=>addToCalendar(e)}>Add to Calendar</button>{e.square_url&&(!session||profile?.membership_status!=='active')&&<a className="primary small" href={e.square_url} target="_blank" rel="noreferrer">Prepay with Square <ChevronRight size={15}/></a>}</div>{(e.price||e.audience)&&<small className="calendar-event-meta">{[e.price,e.audience].filter(Boolean).join(' • ')}</small>}{session&&profile?.membership_status==='active'&&<div className="event-rsvp-box event-signup-simple"><div className="event-rsvp-head"><b>Event Sign-Up</b><span>{availability[e.id]?.closed?'Registration closed':availability[e.id]?.remaining===0?'Event full':availability[e.id]?.remaining!=null?`${availability[e.id].remaining} places remaining`:''}</span>{rsvps[e.id]?.status==='going'&&<span>{rsvps[e.id].attendee_count} attending</span>}</div><div className="event-signup-controls"><label>Number of people attending<input aria-label={`Number attending ${e.title}`} type="number" min="1" max="10" step="1" disabled={savingRsvps[e.id]} value={drafts[e.id]?.attendee_count??rsvps[e.id]?.attendee_count??1} onChange={x=>updateDraft(e.id,{attendee_count:x.target.value})}/></label><button className="primary" disabled={savingRsvps[e.id]||((availability[e.id]?.closed||availability[e.id]?.remaining===0)&&rsvps[e.id]?.status!=='going')} onClick={()=>saveRsvp(e,'going')}>{savingRsvps[e.id]?'Saving…':rsvps[e.id]?.status==='going'?'Update Sign-Up':'Sign Up'}</button>{e.square_url&&<a className="square-pay-btn" href={e.square_url} target="_blank" rel="noreferrer">Pay with Square <ChevronRight size={16}/></a>}</div>{e.square_url&&<p className="muted">{rsvps[e.id]?.payment_status==='paid'?'Payment confirmed by club staff.':'Save your sign-up, then complete payment through Square. Signing up does not confirm payment.'}</p>}{rsvps[e.id]?.status==='going'&&<button className="text-link" disabled={savingRsvps[e.id]} onClick={()=>saveRsvp(e,'not_going')}>Cancel sign-up</button>}</div>}</div></article>):<Empty text={selectedDate?'No events scheduled for this date.':'No upcoming events have been published yet.'}/>}</div>
      </div>
    </div>
  </section>
}
function Tournaments({tournaments,leaderboard,session,profile,reload,notify}){const [tid,setTid]=useState(''),[gross,setGross]=useState(27);async function submit(){if(!session||!profile)return notify('Sign in first.');if(profile.membership_status!=='active')return notify('Your membership is awaiting approval.');if(!tid)return notify('Choose a tournament.');const net=Math.round(Number(gross)-Number(profile.handicap_index||0)/2);const {error}=await supabase.from('tournament_scores').upsert({tournament_id:tid,user_id:session.user.id,player_name:profile.full_name,division:profile.division,gross_score:Number(gross),playing_handicap:Math.round(Number(profile.handicap_index||0)/2),net_score:net,approved:false},{onConflict:'tournament_id,user_id'});if(error)return notify(errText(error));notify('Score submitted for admin approval.');reload()}
return <><section><div className="section-title"><div><small>Competition center</small><h3>Tournaments</h3></div></div><div className="grid two">{tournaments.map(t=><div className="card" key={t.id}><span className="pill">{fmtDate(t.tournament_date)}</span><h3>{t.name}</h3><p>{t.description}</p></div>)}</div></section><section className="section"><div className="card"><h3>Submit Tournament Score</h3><div className="form-row"><select value={tid} onChange={e=>setTid(e.target.value)}><option value="">Choose tournament</option>{tournaments.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select><input type="number" min="9" max="99" value={gross} onChange={e=>setGross(e.target.value)}/><button className="primary" onClick={submit}>Submit Score</button></div><p className="muted">Tournament scores become public only after administrator approval.</p></div></section><section className="section"><div className="section-title"><div><small>Approved scores</small><h3>Leaderboards</h3></div></div><div className="grid two"><Leaderboard title="Men's Leaderboard" rows={leaderboard.Men}/><Leaderboard title="Women's Leaderboard" rows={leaderboard.Women}/></div></section></>}
function Leaderboard({title,rows}){return <div className="card"><h3>{title}</h3>{rows.length?<div className="table">{rows.map((r,i)=><div className="tr" key={r.id}><b>{i+1}</b><span>{r.player_name}</span><span>Gross {r.gross_score}</span><strong>Net {r.net_score}</strong></div>)}</div>:<p className="muted">No approved scores yet.</p>}</div>}
function GolfDashboard({rounds=[]}){
  const stats=useMemo(()=>{
    const nine=rounds.filter(r=>Number(r.holes_played||9)<18&&Number.isFinite(Number(r.gross_score)));
    const eighteen=rounds.filter(r=>Number(r.holes_played||9)>=18&&Number.isFinite(Number(r.gross_score)));
    const avg=list=>list.length?(list.reduce((a,r)=>a+Number(r.gross_score),0)/list.length).toFixed(1):'—';
    const best=list=>list.length?Math.min(...list.map(r=>Number(r.gross_score))):'—';
    const recent=[...rounds].slice(0,8).reverse();
    const index=calculateClubIndex(rounds);
    return {nine,eighteen,avg9:avg(nine),avg18:avg(eighteen),best9:best(nine),best18:best(eighteen),recent,index};
  },[rounds]);
  return <section className="golf-dashboard"><div className="section-title"><div><small>My Golf</small><h3>Golf Dashboard</h3></div></div><div className="golf-metric-grid"><article><small>LINDEX CLUB INDEX</small><strong>{stats.index.index??'—'}</strong><span>{stats.index.count} 18-hole equivalents</span></article><article><small>ROUNDS PLAYED</small><strong>{rounds.length}</strong><span>{stats.nine.length} nine • {stats.eighteen.length} eighteen</span></article><article><small>BEST 9</small><strong>{stats.best9}</strong><span>Par 27</span></article><article><small>BEST 18</small><strong>{stats.best18}</strong><span>Par 54</span></article><article><small>9-HOLE AVG</small><strong>{stats.avg9}</strong><span>All saved 9-hole rounds</span></article><article><small>18-HOLE AVG</small><strong>{stats.avg18}</strong><span>All saved 18-hole rounds</span></article></div>{stats.recent.length>0&&<div className="card golf-trend-card"><div><small>RECENT FORM</small><h3>Score Trend</h3></div><div className="golf-trend">{stats.recent.map((r,i)=>{const holes=Number(r.holes_played||9);const par=holes>=18?54:27;const over=Number(r.gross_score)-par;const height=Math.max(18,Math.min(100,36+over*5));return <div key={r.id||i}><span style={{height:`${height}px`}} title={`${r.gross_score} (${over>=0?'+':''}${over})`}></span><small>{Number(r.gross_score)}</small></div>})}</div><p className="muted">Your most recent saved rounds. For 9-hole rounds, par is 27; for 18 holes, par is 54.</p></div>}</section>
}

function Scorecard({session,active,rounds,reload,notify}){
  const [scores,setScores]=useState(blankScores());
  const [date,setDate]=useState(new Date().toISOString().slice(0,10));
  const [entryMode,setEntryMode]=useState('hole');
  const [quickTotal,setQuickTotal]=useState('');

  const frontComplete=FRONT_NINE.every(h=>scores[h]!=='');
  const backAny=BACK_NINE.some(h=>scores[h]!=='');
  const backComplete=BACK_NINE.every(h=>scores[h]!=='');
  const holeGross=Object.values(scores).reduce((a,b)=>a+(b===''?0:Number(b)),0);
  const holeCount=backComplete?18:9;
  const quickHoles=entryMode==='quick18'?18:9;
  const holesPlayed=entryMode==='hole'?holeCount:quickHoles;
  const par=holesPlayed===18?54:27;
  const gross=entryMode==='hole'?holeGross:(quickTotal===''?0:Number(quickTotal));
  const diff=(gross-par).toFixed(1);
  const currentIndex=calculateClubIndex(rounds);

  async function save(){
    if(!session)return notify('Sign in to save rounds.');
    if(!active)return notify('Your membership is awaiting approval.');

    let savedScores=scores;
    if(entryMode==='hole'){
      if(!frontComplete)return notify('Complete the front nine.');
      if(backAny&&!backComplete)return notify('Complete holes 10–18 or clear them to save a 9-hole round.');
    }else{
      const total=Number(quickTotal);
      if(!quickTotal||!Number.isFinite(total))return notify(`Enter your ${quickHoles}-hole total score.`);
      if(!Number.isInteger(total))return notify('Enter a whole-number total score.');
      if(total<quickHoles||total>quickHoles*12)return notify(`Enter a ${quickHoles}-hole total between ${quickHoles} and ${quickHoles*12}.`);
      savedScores={entry_mode:'quick_total',holes_played:quickHoles,total_score:total};
    }

    const payload={
      user_id:session.user.id,
      played_on:date,
      course_rating:par,
      slope_rating:113,
      scores:savedScores,
      gross_score:gross,
      differential:Number(diff),
      holes_played:holesPlayed
    };
    const result=await supabase.from('private_rounds').insert(payload).select('*').single();
    if(result.error)return notify(errText(result.error));

    const calculated=calculateClubIndex([result.data,...rounds]);
    if(calculated.index!=null){
      const update=await supabase.from('profiles').update({handicap_index:calculated.index}).eq('id',session.user.id);
      if(update.error)return notify(`Round saved, but the index could not update: ${errText(update.error)}`);
    }

    setScores(blankScores());
    setQuickTotal('');
    notify(calculated.index==null?`${holesPlayed}-hole round saved. Add more rounds to establish your club index.`:`${holesPlayed}-hole round saved. Club index updated to ${calculated.index}.`);
    await reload();
  }

  const render=(arr,title)=><div><h4>{title}</h4><div className='holes'>{arr.map(h=><div className='hole' key={h}><b>Hole {h}</b><small>Par 3</small><label>Score<input type='number' min='1' max='12' value={scores[h]} onChange={e=>setScores({...scores,[h]:e.target.value})}/></label></div>)}</div></div>;

  return <>
    <GolfDashboard rounds={rounds}/>
    <section>
      <div className='section-title'><div><small>Private to your account</small><h3>Scorecard</h3></div></div>
      <div className='card scorecard'>
        <div className='score-entry-modes' role='group' aria-label='Score entry mode'>
          <button className={entryMode==='hole'?'active':''} onClick={()=>setEntryMode('hole')}><b>Hole-by-Hole</b><small>Full 9 or 18-hole scorecard</small></button>
          <button className={entryMode==='quick9'?'active':''} onClick={()=>setEntryMode('quick9')}><b>Quick 9</b><small>Enter one 9-hole total</small></button>
          <button className={entryMode==='quick18'?'active':''} onClick={()=>setEntryMode('quick18')}><b>Quick 18</b><small>Enter one 18-hole total</small></button>
        </div>

        <div className='score-head'>
          <label>Date<input type='date' value={date} onChange={e=>setDate(e.target.value)}/></label>
          <div><b>{gross||'—'}</b><span>Gross</span></div>
          <div><b>{gross?(gross-par>0?`+${gross-par}`:gross-par):'—'}</b><span>To Par</span></div>
          <div><b>{gross?diff:'—'}</b><span>Differential</span></div>
        </div>

        <div className='index-summary'><div><small>Linderhof Club Index</small><strong>{currentIndex.index??'Not established'}</strong></div><p>{currentIndex.index==null?`You need ${Math.max(0,3-currentIndex.count)} more 18-hole equivalent round${Math.max(0,3-currentIndex.count)===1?'':'s'} to establish an index.`:`Calculated from ${currentIndex.count} recent 18-hole equivalent round${currentIndex.count===1?'':'s'}.`}</p></div>

        {entryMode==='hole'?<>
          {render(FRONT_NINE,'Front 9')}
          {render(BACK_NINE,'Back 9')}
        </>:<div className='quick-score-panel'>
          <div className='quick-score-copy'>
            <span className='pill'>{quickHoles} Holes • Par {par}</span>
            <h3>Enter your total score</h3>
            <p>No need to type every hole. This round still counts toward your score history and Linderhof Club Index, but it will not have hole-by-hole statistics.</p>
          </div>
          <label className='quick-total-field'>Total Score<input type='number' inputMode='numeric' min={quickHoles} max={quickHoles*12} value={quickTotal} onChange={e=>setQuickTotal(e.target.value)} placeholder={quickHoles===9?'e.g. 31':'e.g. 62'}/></label>
        </div>}

        <button className='primary' onClick={save}>Finish Round</button>
      </div>
    </section>
    <section className='section'>
      <div className='card'><h3>Round History</h3>{rounds.length?<div className='table'>{rounds.map(r=><div className='tr' key={r.id}><span>{fmtDate(r.played_on)}</span><span>{r.holes_played||9} Holes{r.scores?.entry_mode==='quick_total'?' • Quick':''}</span><span>Gross {r.gross_score}</span><strong>Diff {r.differential}</strong></div>)}</div>:<p className='muted'>No private rounds saved yet.</p>}</div>
    </section>
  </>
}
function Gallery({galleryImages=[]}){
  const [settings,setSettings]=useState(null);
  useEffect(()=>{supabase.from('club_settings').select('gallery_image_1_url,gallery_image_2_url,gallery_image_3_url,pool_image_url,clubhouse_image_url').eq('id','main').maybeSingle().then(({data})=>setSettings(data||null))},[]);
  const legacy=[settings?.gallery_image_1_url||'/assets/course-aerial-1.png',settings?.gallery_image_2_url||'/assets/pool.jpg',settings?.gallery_image_3_url||'/assets/course-aerial-2.jpg',settings?.pool_image_url,settings?.clubhouse_image_url].filter(Boolean);
  const images=galleryImages.length?galleryImages.map(x=>({src:x.image_url,caption:x.caption||''})):legacy.map(src=>({src,caption:''}));
  return <section><div className="section-title"><div><small>Around the club</small><h3>Photo Gallery</h3></div><span className="directory-count">{images.length} photos</span></div><div className="gallery gallery-modern">{images.map((item,i)=><figure key={`${item.src}-${i}`}><img src={item.src} alt={item.caption||`Linderhof gallery ${i+1}`}/>{item.caption&&<figcaption>{item.caption}</figcaption>}</figure>)}</div></section>
}

function GuestPasses({session,profile,active,notify}){
  const [categories,setCategories]=useState([]),[passes,setPasses]=useState([]),[usage,setUsage]=useState({used:0,remaining:0,eligible:false,reason:''}),[form,setForm]=useState({guest_name:'',visit_date:new Date().toISOString().slice(0,10),category_id:'',unit_number:profile?.unit_number||'',owner_member_name:profile?.full_name||''}),[saving,setSaving]=useState(false);
  const [usageState,setUsageState]=useState('loading');
  const [usageError,setUsageError]=useState('');
  const loadVersion=useRef(0);
  async function load(){
    const version=++loadVersion.current;
    setUsageState('loading');setUsageError('');
    try{
      const [cats,own,result]=await Promise.all([
        supabase.from('guest_pass_categories').select('*').eq('active',true).order('sort_order').order('name'),
        session?.user?.id?supabase.from('guest_pass_requests').select('*').eq('user_id',session.user.id).order('created_at',{ascending:false}):Promise.resolve({data:[]}),
        session?.user?.id?supabase.rpc('get_member_guest_visit_status'):Promise.resolve({data:[]})
      ]);
      if(version!==loadVersion.current)return;
      const nextCats=cats.data||[];setCategories(nextCats);setPasses(own.data||[]);
      if(cats.error||own.error)notify(errText(cats.error||own.error));
      setForm(v=>({...v,category_id:v.category_id||nextCats[0]?.id||''}));
      if(result.error)throw result.error;
      const nextUsage=result.data?.[0];
      if(!nextUsage||typeof nextUsage.eligible!=='boolean')throw new Error('No membership eligibility result was returned.');
      setUsage(nextUsage);setUsageState('ready');
    }catch(error){
      if(version!==loadVersion.current)return;
      setUsageError('Unable to check guest access. Please try again.');
      setUsageState('error');
    }
  }
  useEffect(()=>{load();return()=>{loadVersion.current++}},[session?.user?.id,profile?.membership_status,profile?.membership_level,profile?.good_standing]);
  useEffect(()=>{if(profile?.full_name&&!form.owner_member_name)setForm(v=>({...v,owner_member_name:profile.full_name}))},[profile?.full_name]);
  const selectedCategory=categories.find(c=>c.id===form.category_id)||categories[0]||null;
  async function requestPass(){
    if(!session?.user?.id)return notify('Sign in first.');
    if(usageState!=='ready')return notify('Wait for the guest-access check to finish, or retry it.');
    if(!active)return notify('Your membership must be active.');
    if(!usage.eligible)return notify(usage.reason||'This membership is not eligible for guest visits.');
    if(Number(usage.remaining)<=0)return notify('This membership has used both guest passes for this month.');
    if(!form.guest_name.trim())return notify('Enter at least one guest name.');
    if(!selectedCategory)return notify('Choose a guest pass category.');
    setSaving(true);
    const {error}=await supabase.rpc('create_member_guest_visit',{p_guest_name:form.guest_name.trim(),p_guest_name_2:null,p_visit_date:form.visit_date,p_category_id:selectedCategory.id});
    setSaving(false);
    if(error)return notify(errText(error));
    const left=Math.max(0,Number(usage.remaining)-1); notify(`Guest pass request created. You have ${left} guest pass${left===1?'':'es'} remaining this month.`);
    setForm(v=>({...v,guest_name:''}));load();
  }
  async function sharePass(pass){
    const shareUrl=`${PUBLIC_SITE_URL}/guest-pass?token=${encodeURIComponent(pass.verification_token)}`;
    const text=`LINDEX Guest Pass for ${pass.guest_name} • ${fmtDate(pass.visit_date)} • ${pass.pass_type}`;
    try{if(navigator.share){await navigator.share({title:'LINDEX Guest Pass',text,url:shareUrl});return}await navigator.clipboard.writeText(shareUrl);notify('Guest pass link copied.')}catch(e){if(e?.name!=='AbortError')notify('Could not share the guest pass.');}
  }
  if(!session)return <section><div className="section-title"><div><small>Guest access</small><h3>Digital Guest Passes</h3></div></div><div className="card public-guest-callout"><div><h3>Renting a Linderhof unit?</h3><p>You do not need a LINDEX account to purchase a guest pass.</p></div><a className="primary button-link" href="/guest-passes">Purchase as a Renter <ChevronRight size={17}/></a></div></section>;
  return <section><OwnerRenterRegistration profile={profile} notify={notify}/><div className="section-title"><div><small>LINDEX Guest Access</small><h3>Digital Guest Passes</h3></div><a className="text-link" href="/guest-passes">Renter purchase page</a></div><div className="grid two"><div className="card guest-pass-create"><h3>Member Guest Visit</h3><div className="guest-price"><small>MONTHLY GUEST PASSES</small><strong>{usageState==='ready'?`${usage.used||0} of 2 used • ${usage.remaining??0} remaining`:usageState==='loading'?'Checking guest access…':'Guest access check unavailable'}</strong></div>{usageState==='loading'&&<p className="muted" role="status">Checking your membership and monthly guest visits…</p>}{usageState==='error'&&<div role="alert"><p className="form-error">{usageError}</p><button className="small secondary" onClick={load}>Try again</button></div>}{usageState==='ready'&&!usage.eligible&&<p className="form-error">{usage.reason||'Guest access is not available for this membership.'}</p>}<p className="muted">Full members in good standing receive two individual guest passes per calendar month. Enter one guest at a time; return here to request the second guest later.</p><div className="form-stack"><label>Guest name<input value={form.guest_name} onChange={e=>setForm({...form,guest_name:e.target.value})} placeholder="Full name"/></label><label>Visit date<input type="date" value={form.visit_date} onChange={e=>setForm({...form,visit_date:e.target.value})}/></label><label>Pass category<select value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="guest-price"><small>PRICE</small><strong>{selectedCategory?.price_label||'Set by club'}</strong></div><button className="primary" onClick={requestPass} disabled={saving||usageState!=='ready'||!selectedCategory||!usage.eligible||Number(usage.remaining)<=0}>{saving?'Creating…':'Create Guest Visit'}</button>{usageState==='ready'&&usage.eligible&&selectedCategory?.square_url&&<a className="square-pay-btn" href={selectedCategory.square_url} target="_blank" rel="noreferrer">Pay {selectedCategory.price_label?`${selectedCategory.price_label} `:''}with Square <ChevronRight size={17}/></a>}</div></div><div className="card"><h3>How It Works</h3><div className="guest-steps"><p><b>1.</b> Enter one guest for this visit.</p><p><b>2.</b> Choose Golf, Pool, or another available pass category.</p><p><b>3.</b> Pay through that category’s Square button.</p><p><b>4.</b> Club staff confirms payment and activates the pass.</p><p><b>5.</b> Share the live pass by text or email.</p></div><p className="muted">Renters can also purchase without signing in at <b>linderhofmembers.com/guest-passes</b>.</p></div></div><div className="section"><div className="section-title compact"><div><small>Your requests</small><h3>Guest Pass History</h3></div></div>{passes.length?<div className="guest-pass-grid">{passes.map(pass=>{const verifyUrl=pass.verification_token?`${PUBLIC_SITE_URL}/guest-verify?token=${encodeURIComponent(pass.verification_token)}`:'';const shareUrl=pass.verification_token?`${PUBLIC_SITE_URL}/guest-pass?token=${encodeURIComponent(pass.verification_token)}`:'';const live=pass.payment_status==='paid'&&pass.status==='active';const shareText=encodeURIComponent(`Your LINDEX Guest Pass for ${fmtDate(pass.visit_date)}: ${shareUrl}`);return <article className={`card guest-pass-card ${live?'live':''}`} key={pass.id}><div><span className={`pill ${live?'green':''}`}>{live?'ACTIVE PASS':pass.payment_status==='paid'?'PAID • AWAITING ACTIVATION':'PAYMENT PENDING'}</span><h3>{pass.guest_name}</h3><p>{fmtDate(pass.visit_date)} • {pass.pass_type}</p><small>{pass.price_label?`${pass.price_label} • `:''}Unit {pass.unit_number||'—'} • Owner/Member: {pass.owner_member_name||pass.sponsor_name||'—'}</small>{live&&shareUrl&&<div className="guest-share-actions"><button className="small primary" onClick={()=>sharePass(pass)}><Share2 size={14}/>Share Guest Pass</button><button className="small secondary" onClick={async()=>{await navigator.clipboard?.writeText(shareUrl);notify('Guest pass link copied.')}}><Copy size={14}/>Copy Link</button><a className="small secondary button-link" href={`sms:?&body=${shareText}`}><MessageCircle size={14}/>Text</a><a className="small secondary button-link" href={`mailto:?subject=${encodeURIComponent('Your LINDEX Guest Pass')}&body=${shareText}`}><Mail size={14}/>Email</a></div>}</div>{live&&verifyUrl?<div className="guest-pass-qr"><QRCodeSVG value={verifyUrl} size={128} bgColor="#fff" fgColor="#073c2c" level="Q"/><small>STAFF SCANS THIS QR</small></div>:<div className="guest-pass-wait"><ShieldCheck/><span>{pass.payment_status==='paid'?'Staff will activate this pass.':'Complete the Square payment for this category, then staff can mark it paid.'}</span></div>}</article>})}</div>:<Empty text="You have not requested any guest passes yet."/>}</div></section>
}


function OwnerRenterRegistration({profile,notify}){
  const [stays,setStays]=useState([]),[form,setForm]=useState({renter_name:'',renter_email:'',start_date:'',end_date:'',occupants:1}),[busy,setBusy]=useState(false);
  async function load(){const {data,error}=await supabase.rpc('owner_rental_overview');if(error)notify(errText(error));else setStays(data||[])}
  useEffect(()=>{if(profile?.id&&profile.membership_level==='owner')load()},[profile?.id,profile?.membership_level]);
  useLiveRefresh(['renter_stays'],load,{enabled:profile?.membership_level==='owner',key:profile?.id});
  if(profile?.membership_level!=='owner')return null;
  async function submit(e){e.preventDefault();setBusy(true);const {error}=await supabase.rpc('register_renter_stay',{p_name:form.renter_name.trim(),p_email:form.renter_email.trim().toLowerCase(),p_start:form.start_date,p_end:form.end_date,p_occupants:Number(form.occupants)});setBusy(false);if(error)return notify(errText(error));notify('Rental submitted for club approval.');setForm({renter_name:'',renter_email:'',start_date:'',end_date:'',occupants:1});load()}
  return <div className="card section"><h3>Register a Renter</h3><p className="muted">Register renters staying in your condo unit. Club administrators must approve each stay before renter passes can be purchased.</p><p>Registered unit: <b>{profile.unit_building?`${profile.unit_building} · `:''}{profile.unit_number||'Add your unit number under My Condo Unit first'}</b></p><form className="form-stack" onSubmit={submit}><input required placeholder="Renter full name" value={form.renter_name} onChange={e=>setForm({...form,renter_name:e.target.value})}/><input required type="email" placeholder="Renter email" value={form.renter_email} onChange={e=>setForm({...form,renter_email:e.target.value})}/><label>Arrival<input required type="date" value={form.start_date} onChange={e=>setForm({...form,start_date:e.target.value})}/></label><label>Departure<input required type="date" value={form.end_date} min={form.start_date} onChange={e=>setForm({...form,end_date:e.target.value})}/></label><label>Number of occupants<input required type="number" min="1" max="99" value={form.occupants} onChange={e=>setForm({...form,occupants:e.target.value})}/></label><button className="primary" disabled={busy||!profile.unit_number}>{busy?'Submitting…':'Submit Stay for Approval'}</button></form>{stays.map(st=><div className="admin-row" key={st.id}><span><b>{st.renter_name}</b><small>{st.start_date} – {st.end_date} · {st.occupants} occupants · {st.status}</small><small>{Number(st.pass_requests)===0?'No passes requested':`${st.pass_requests} pass requests · ${st.paid_passes} paid · ${st.active_passes} active`}</small></span></div>)}</div>
}
function PublicGuestPurchase(){
  const [categories,setCategories]=useState([]),[form,setForm]=useState({guest_name:'',email:'',unit_number:'',owner_member_name:'',visit_date:new Date().toISOString().slice(0,10),category_id:''}),[saving,setSaving]=useState(false),[complete,setComplete]=useState(null),[message,setMessage]=useState('');
  const [stayToken]=useState(()=>new URLSearchParams(window.location.search).get('stay'));
  const [approvedStay,setApprovedStay]=useState(null),[stayLoading,setStayLoading]=useState(!!stayToken),[stayError,setStayError]=useState(''),[choosing,setChoosing]=useState(true);
  useEffect(()=>{
    if(!stayToken)return;
    let cancelled=false;
    async function loadStay(){
      try{
        const {data,error}=await supabase.rpc('get_approved_renter_stay',{p_token:stayToken});
        if(error)throw error;
        if(!data)throw new Error('This approval link is unavailable. Please contact the clubhouse.');
        if(cancelled)return;
        setApprovedStay(data);
        setForm(v=>({...v,guest_name:data.renter_name,email:data.renter_email,unit_number:data.unit_number,owner_member_name:data.owner_member_name,visit_date:clubDate()>data.start_date?clubDate():data.start_date}));
      }catch(error){if(!cancelled)setStayError(error.message||'Unable to load your approved stay.');}
      finally{if(!cancelled)setStayLoading(false);}
    }
    loadStay();return()=>{cancelled=true};
  },[stayToken]);
  useEffect(()=>{supabase.from('guest_pass_categories').select('*').eq('active',true).order('sort_order').order('name').then(({data,error})=>{if(error)setMessage('Unable to load available passes. Please refresh to try again.');const rows=data||[];setCategories(rows);if(rows[0])setForm(v=>({...v,category_id:v.category_id||rows[0].id}))})},[]);
  const selectedCategory=categories.find(c=>c.id===form.category_id)||categories[0]||null;
  async function submit(e){
    e.preventDefault();setMessage('');
    if(!form.guest_name.trim()||!form.email.trim()||!form.unit_number.trim()||!form.owner_member_name.trim()||!form.visit_date||!selectedCategory){setMessage('Please complete every required field.');return}
    setSaving(true);
    const {data,error}=await supabase.rpc('create_public_guest_pass_request',{p_guest_name:form.guest_name.trim(),p_email:form.email.trim().toLowerCase(),p_unit_number:form.unit_number.trim(),p_owner_member_name:form.owner_member_name.trim(),p_visit_date:form.visit_date,p_category_id:selectedCategory.id});
    setSaving(false);
    if(error){setMessage(errText(error));return}
    const row=Array.isArray(data)?data[0]:data;
    setComplete(row?{...row,email:form.email,guest_name:form.guest_name,visit_date:form.visit_date,category:selectedCategory}:null);
  }
  return <main className="verification-page public-purchase-page"><div className="verification-shell guest-purchase-shell"><header className="verification-brand"><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><small>LINDERHOF COUNTRY CLUB</small><h1>LINDEX</h1></header><div className="verification-banner">RENTER ACCESS</div>{stayLoading?<p className="renter-loading" role="status">Loading your approved stay…</p>:stayError?<div className="renter-loading" role="alert"><h2>Approval link unavailable</h2><p>{stayError}</p><a href="/renters">Enter your rental details</a></div>:<>{approvedStay&&!complete&&<section className="approved-renter-home"><small className="renter-eyebrow">WELCOME, {approvedStay.renter_name}</small><h2>Renter Passes</h2><p className="muted">Linderhof Country Club</p><dl className="renter-stay-summary"><div><dt>Condo unit</dt><dd>{approvedStay.unit_building?`${approvedStay.unit_building} · `:''}Unit {approvedStay.unit_number}</dd></div><div><dt>Approved stay</dt><dd>{fmtDate(approvedStay.start_date)} – {fmtDate(approvedStay.end_date)}</dd></div><div><dt>Occupants</dt><dd>{approvedStay.occupants} {approvedStay.occupants===1?'person':'people'}</dd></div><div><dt>Verification</dt><dd><span className="pill green">Approved</span></dd></div></dl><RenterMyPasses stayToken={stayToken} refreshKey={complete?.id}/>{choosing&&<><h3>Available passes</h3><div className="renter-pass-options">{categories.map(category=><button type="button" className="renter-pass-option" key={category.id} onClick={()=>{setForm(v=>({...v,category_id:category.id}));setChoosing(false);setMessage('')}}><span><strong>{category.name}</strong><small>{Number(category.duration_days||1)===1?'1 admission day':`${category.duration_days} admission days`}</small><span className="renter-select-label">Choose pass →</span></span><b>{category.price_label||'Price set by club'}</b></button>)}</div>{!categories.length&&<p role="status">{message||'No passes are currently available. Please contact the clubhouse.'}</p>}<p className="muted">Multi-day pool passes count one day each time you sign in on a new date. Repeat sign-ins that day do not use another day. Pass use must fall within your approved stay.</p></>}</section>}{complete?<div className="public-purchase-complete"><ShieldCheck/><h2>Request Created</h2><p>Your {complete.category?.name||'guest pass'} request for <b>{complete.guest_name}</b> has been created.</p><div className="public-purchase-summary"><div><span>Visit Date</span><b>{fmtDate(complete.visit_date)}</b></div><div><span>Unit #</span><b>{form.unit_number}</b></div><div><span>Owner/Member</span><b>{form.owner_member_name}</b></div><div><span>Price</span><b>{complete.price_label||complete.category?.price_label||'Set by club'}</b></div></div>{complete.square_url?<a className="square-pay-btn" href={complete.square_url} target="_blank" rel="noreferrer">Continue to Square Payment <ChevronRight size={17}/></a>:<p className="ios-push-note">Online payment is not configured for this category yet.</p>}<p className="muted">After club staff confirms the Square payment and activates the pass, LINDEX will email the live digital pass to <b>{complete.email}</b>.</p><button className="secondary" onClick={()=>{setComplete(null);setChoosing(true);if(!approvedStay)setForm({guest_name:'',email:'',unit_number:'',owner_member_name:'',visit_date:clubDate(),category_id:categories[0]?.id||''})}}>Purchase Another Pass</button></div>:(!approvedStay||!choosing)&&<form className="public-guest-form" onSubmit={submit}><div className="public-purchase-intro"><h2>{approvedStay?selectedCategory?.name:'Renter Access'}</h2>{approvedStay?<p>Confirm your details and choose your first visit date.</p>:<p>No LINDEX login is required. Your stay must be registered by the condo owner and approved by club staff before you can purchase a renter pass. Use the same name, email, and unit as your approved registration.</p>}</div>{approvedStay&&<button type="button" className="secondary" onClick={()=>setChoosing(true)}>Back to available passes</button>}<label>Renter / Guest Name *<input required value={form.guest_name} onChange={e=>setForm({...form,guest_name:e.target.value})} placeholder="Full name"/></label><label>Email Address *<input required type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="name@example.com"/></label><div className="public-form-two"><label>Unit # *<input required value={form.unit_number} onChange={e=>setForm({...form,unit_number:e.target.value})} placeholder="Example: 18B"/></label><label>Visit Date *<input required type="date" min={approvedStay?(clubDate()>approvedStay.start_date?clubDate():approvedStay.start_date):clubDate()} max={approvedStay?.end_date} value={form.visit_date} onChange={e=>setForm({...form,visit_date:e.target.value})}/></label></div><label>Owner/Member Name *<input required value={form.owner_member_name} onChange={e=>setForm({...form,owner_member_name:e.target.value})} placeholder="Name of the Linderhof owner/member"/></label><label>Pass Category *<select required value={form.category_id} onChange={e=>setForm({...form,category_id:e.target.value})}>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label><div className="guest-price"><small>PRICE</small><strong>{selectedCategory?.price_label||'Set by club'}</strong></div>{message&&<p className="form-error">{message}</p>}<button className="primary full" type="submit" disabled={saving||!selectedCategory}>{saving?'Creating Request…':'Continue to Purchase'}</button><p className="public-purchase-note">LINDEX verifies your approved rental stay and condo unit. Payment is completed securely through Square, and staff activates the pass after payment is confirmed.</p></form>}</>}<footer className="verification-footer"><span>LINDEX • DIGITAL GUEST ACCESS</span><small>No member account required.</small></footer></div></main>
}

function RenterPoolSignIn({clubSettings}){
  const [stage,setStage]=useState('home'),[visitor,setVisitor]=useState('guest'),[access,setAccess]=useState('pool'),[form,setForm]=useState({name:'',unit:''}),[result,setResult]=useState(null),[loading,setLoading]=useState(false),[message,setMessage]=useState(''),[weather,setWeather]=useState(null);
  useEffect(()=>{fetch('https://api.open-meteo.com/v1/forecast?latitude=44.0878&longitude=-71.2817&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FNew_York').then(r=>r.ok?r.json():null).then(d=>setWeather(d?.current||null)).catch(()=>{})},[]);
  const day=nhDay();const dayKeys=['sunday_hours','monday_hours','tuesday_hours','wednesday_hours','thursday_hours','friday_hours','saturday_hours'];const hours=clubSettings?.[dayKeys[day]]||'Clubhouse hours posted at the clubhouse';
  async function submit(e){e.preventDefault();setLoading(true);setMessage('');const fn=visitor==='member'?'member_club_sign_in':'guest_club_sign_in';const {data,error}=await supabase.rpc(fn,{p_name:form.name.trim(),p_unit_number:form.unit.trim()||null,p_access_type:access,p_visit_date:clubDate()});setLoading(false);if(error){setMessage(error.message||'We could not record this sign-in.');return}setResult(Array.isArray(data)?data[0]:data);signalSignIn();setStage('result');}
  const reset=()=>{setStage('home');setResult(null);setMessage('');setForm({name:'',unit:''})};
  return <main className="verification-page public-purchase-page"><div className="verification-shell guest-purchase-shell"><header className="verification-brand"><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><small>LINDERHOF COUNTRY CLUB</small><h1>LINDEX</h1></header>{stage==='home'?<><div className="dashboard-hero public-signin-hero" style={{backgroundImage:`url(${clubSettings?.hero_image_url||'/assets/image-1.jpg'})`}}><div><small>GOOD {new Date().getHours()<12?'MORNING':new Date().getHours()<18?'AFTERNOON':'EVENING'}</small><h2>Welcome to Linderhof</h2><p>Daily pool and golf sign-in</p></div></div><div className="signin-status-grid"><div><CloudSun/><small>Weather</small><b>{weather?`${Math.round(weather.temperature_2m)}°F`:'Bartlett, NH'}</b></div><div><Flag/><small>Golf Course</small><b>{clubSettings?.course_status||'Open'}</b></div><div><Home/><small>Clubhouse</small><b>{hours}</b></div><div><Users/><small>Pool</small><b>{clubSettings?.pool_status||'Check clubhouse status'}</b></div></div><div className="signin-choice-grid"><button className="primary" onClick={()=>{setVisitor('member');setStage('form')}}><Users/><b>Member Sign-In</b><small>Verify your membership</small></button><button className="secondary" onClick={()=>{setVisitor('guest');setStage('form')}}><ShieldCheck/><b>Guest Sign-In</b><small>Verify your guest pass</small></button></div></>:stage==='form'?<><div className="verification-banner">{visitor==='member'?'MEMBER':'GUEST'} SIGN-IN</div><div className="signin-access-tabs"><button className={access==='pool'?'active':''} onClick={()=>setAccess('pool')}>Pool Sign-In</button><button className={access==='golf'?'active':''} onClick={()=>setAccess('golf')}>Golf Sign-In</button></div><form className="public-guest-form" onSubmit={submit}><label>{visitor==='member'?'Member name':'Guest name'} *<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Full name"/></label><label>{visitor==='member'?'Unit number for Owners (optional)':'Unit number'} {visitor==='guest'?'*':''}<input required={visitor==='guest'} value={form.unit} onChange={e=>setForm({...form,unit:e.target.value})} placeholder={visitor==='member'?'Owners must enter their registered unit':'Example: 18B'}/></label>{message&&<p className="form-error">{message}</p>}<button className="primary full" disabled={loading}>{loading?'Checking…':'Sign In for Today'}</button><button type="button" className="secondary full" onClick={reset}>Back</button></form></>:<div className="card"><div className="verification-result active"><ShieldCheck/><div><strong>{result?.message==='Already checked in today'?'ALREADY CHECKED IN TODAY':'SIGN-IN RECORDED'}</strong><span>{result?.message||'Thank you. Enjoy the club.'}</span></div></div><div className="verification-details"><div><span>Name</span><b>{result?.person_name}</b></div><div><span>Access</span><b>{result?.access_type==='pool'?'Pool':'Golf'}</b></div><div><span>Date</span><b>{fmtDate(clubDate())}</b></div>{result?.days_remaining!=null&&<div><span>Pool days remaining</span><b>{result.days_remaining} of {result.pass_duration_days}</b></div>}</div><button className="secondary full" onClick={reset}>Return to Sign-In Home</button></div>}<footer className="verification-footer"><span>LINDEX • DAILY CLUB SIGN-IN</span><small>One sign-in is recorded per person, access type, and date.</small></footer></div></main>
}

function GuestPassPublic(){
  const [state,setState]=useState({loading:true,data:null,error:''});const token=new URLSearchParams(window.location.search).get('token')||'';
  useEffect(()=>{(async()=>{if(!token)return setState({loading:false,data:null,error:'This guest pass link is missing a verification token.'});const {data,error}=await supabase.rpc('verify_lindex_guest_pass',{p_token:token});if(error)return setState({loading:false,data:null,error:'This guest pass could not be loaded.'});const pass=Array.isArray(data)?data[0]:data;setState(pass?{loading:false,data:pass,error:''}:{loading:false,data:null,error:'This guest pass is not valid.'})})()},[token]);
  const pass=state.data;const verifyUrl=token?`${PUBLIC_SITE_URL}/guest-verify?token=${encodeURIComponent(token)}`:'';const valid=pass?.valid_now===true;
  return <main className="verification-page"><div className="verification-shell guest-public-shell"><header className="verification-brand"><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><small>LINDERHOF COUNTRY CLUB</small><h1>LINDEX</h1></header><div className="verification-banner">DIGITAL GUEST PASS</div>{state.loading?<div className="verification-loading">Loading guest pass…</div>:state.error?<div className="verification-error"><ShieldCheck/><h2>Unable to Load Pass</h2><p>{state.error}</p></div>:<div className="verification-content"><div className={`verification-result ${valid?'active':'inactive'}`}><ShieldCheck/><div><strong>{valid?'ACTIVE GUEST PASS':'GUEST PASS NOT ACTIVE'}</strong><span>{valid?'Present this QR code to club staff.':'This pass is not currently valid for entry.'}</span></div></div><h2>{pass.guest_name}</h2><div className="guest-public-qr"><QRCodeSVG value={verifyUrl} size={210} bgColor="#fff" fgColor="#073c2c" level="H"/><small>STAFF: SCAN TO VERIFY LIVE STATUS</small></div><div className="verification-details"><div><span>Visit Date</span><b>{fmtDate(pass.visit_date)}</b></div><div><span>Pass Type</span><b>{pass.pass_type}</b></div><div><span>Unit #</span><b>{pass.unit_number||'—'}</b></div><div><span>Owner/Member</span><b>{pass.owner_member_name||pass.sponsor_name||'—'}</b></div><div><span>Payment</span><b>{pass.payment_status==='paid'?'PAID':'NOT CONFIRMED'}</b></div></div></div>}<footer className="verification-footer"><span>LINDEX • DIGITAL GUEST ACCESS</span><small>No LINDEX account is required for guests.</small></footer></div></main>
}

function GuestPassVerification(){
  const [state,setState]=useState({loading:true,data:null,error:''});const token=new URLSearchParams(window.location.search).get('token')||'';
  useEffect(()=>{(async()=>{if(!token)return setState({loading:false,data:null,error:'This guest pass link is missing a verification token.'});const {data,error}=await supabase.rpc('verify_lindex_guest_pass',{p_token:token});if(error)return setState({loading:false,data:null,error:'This guest pass could not be verified.'});const pass=Array.isArray(data)?data[0]:data;setState(pass?{loading:false,data:pass,error:''}:{loading:false,data:null,error:'This guest pass is not valid.'})})()},[token]);
  const pass=state.data;const valid=pass?.valid_now===true;
  return <main className="verification-page"><div className="verification-shell"><header className="verification-brand"><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><small>LINDERHOF COUNTRY CLUB</small><h1>LINDEX</h1></header><div className="verification-banner">GUEST PASS VERIFICATION</div>{state.loading?<div className="verification-loading">Verifying guest pass…</div>:state.error?<div className="verification-error"><ShieldCheck/><h2>Unable to Verify</h2><p>{state.error}</p></div>:<div className="verification-content"><div className={`verification-result ${valid?'active':'inactive'}`}><ShieldCheck/><div><strong>{valid?'VALID GUEST PASS':'GUEST PASS NOT ACTIVE'}</strong><span>{valid?'Guest access verified for today.':'Check payment, status, and visit date.'}</span></div></div><div className="verification-details"><div><span>Guest</span><b>{pass.guest_name}</b></div><div><span>Unit #</span><b>{pass.unit_number||'—'}</b></div><div><span>Owner/Member</span><b>{pass.owner_member_name||pass.sponsor_name||'—'}</b></div><div><span>Visit Date</span><b>{fmtDate(pass.visit_date)}</b></div><div><span>Pass Type</span><b>{pass.pass_type}</b></div><div><span>Payment</span><b>{pass.payment_status==='paid'?'PAID':'NOT CONFIRMED'}</b></div></div></div>}<footer className="verification-footer"><span>LINDEX • DIGITAL GUEST ACCESS</span><small>Live verification from Linderhof Country Club</small></footer></div></main>
}

function MemberVerification(){
  const [state,setState]=useState({loading:true,data:null,error:''});
  const token=new URLSearchParams(window.location.search).get('token')||'';
  useEffect(()=>{
    let live=true;
    (async()=>{
      if(!token){if(live)setState({loading:false,data:null,error:'This verification link is missing a member token.'});return}
      const {data,error}=await supabase.rpc('verify_lindex_member',{p_token:token});
      if(!live)return;
      if(error){setState({loading:false,data:null,error:'This membership code could not be verified.'});return}
      const member=Array.isArray(data)?data[0]:data;
      if(!member){setState({loading:false,data:null,error:'This membership code is not valid.'});return}
      setState({loading:false,data:member,error:''});
    })();
    return()=>{live=false};
  },[token]);
  const member=state.data;
  const active=member?.membership_status==='active';
  const initials=(member?.full_name||'Linderhof Member').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
  return <main className="verification-page">
    <div className="verification-shell">
      <header className="verification-brand"><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><small>LINDERHOF COUNTRY CLUB</small><h1>LINDEX</h1></header>
      <div className="verification-banner">MEMBER VERIFICATION</div>
      {state.loading?<div className="verification-loading">Verifying membership…</div>:state.error?<div className="verification-error"><ShieldCheck/><h2>Unable to Verify</h2><p>{state.error}</p></div>:<div className="verification-content">
        <div className={`verification-photo ${member.avatar_url?'has-photo':''}`}>{member.avatar_url?<img src={member.avatar_url} alt={member.full_name}/>:initials}</div>
        <h2>{member.full_name||'Linderhof Member'}</h2>
        <div className={`verification-result ${active?'active':'inactive'}`}><ShieldCheck/><div><strong>{active?'ACTIVE MEMBER':'MEMBERSHIP NOT ACTIVE'}</strong><span>{active?'Membership verified.':'Please see club staff for assistance.'}</span></div></div>
        <div className="verification-details">
          <div><span>Member ID</span><b>{member.member_id}</b></div>
          <div><span>Membership Type</span><b>{member.division?`${member.division} Member`:'Member'}</b></div>
          <div><span>Club Index</span><b>{member.handicap_index??'—'}</b></div>
          <div><span>Member Since</span><b>{member.member_since||'—'}</b></div>
        </div>
      </div>}
      <footer className="verification-footer"><span>LIFE IS BETTER AT LINDERHOF</span><small>Live status from LINDEX • {new Date().toLocaleDateString()}</small></footer>
    </div>
  </main>
}

function MemberDirectory({session,active}){
  const [members,setMembers]=useState([]),[directoryError,setDirectoryError]=useState(''),[directoryLoading,setDirectoryLoading]=useState(true);const directoryVersion=useRef(0);
  async function loadDirectory(){const n=++directoryVersion.current;if(!session||!active){setMembers([]);return}const {data,error}=await supabase.rpc('member_directory');if(n!==directoryVersion.current)return;setMembers(error?[]:data||[]);setDirectoryError(error?.message||'');setDirectoryLoading(false)}
  useEffect(()=>{setDirectoryLoading(true);loadDirectory();return()=>{directoryVersion.current++}},[session?.user?.id,active]);
  useLiveRefresh(['profiles'],loadDirectory,{enabled:!!session&&active,key:session?.user?.id});
  const [query,setQuery]=useState(''),[sort,setSort]=useState('az');
  const visible=useMemo(()=>{
    const q=query.trim().toLowerCase();
    const filtered=members.filter(m=>!q||(m.full_name||'').toLowerCase().includes(q));
    return [...filtered].sort((a,b)=>{
      if(sort!=='az'){
        const aSocial=a.membership_level==='social',bSocial=b.membership_level==='social';
        if(aSocial!==bSocial)return aSocial?1:-1;
        if(aSocial&&bSocial)return (a.full_name||'').localeCompare(b.full_name||'');
      }
      if(sort==='low')return Number(a.handicap_index??999)-Number(b.handicap_index??999);
      if(sort==='high')return Number(b.handicap_index??-999)-Number(a.handicap_index??-999);
      return (a.full_name||'').localeCompare(b.full_name||'');
    });
  },[members,query,sort]);
  if(!session)return <section><div className="section-title"><div><small>Members only</small><h3>Member Directory</h3></div></div><div className="card directory-gate"><Users/><div><h3>Sign in to view the directory</h3><p>The member directory is available only to signed-in Linderhof members.</p></div></div></section>;
  if(!active)return <section><div className="section-title"><div><small>Members only</small><h3>Member Directory</h3></div></div><div className="card directory-gate"><ShieldCheck/><div><h3>Approval required</h3><p>Your account must be approved before you can view other members.</p></div></div></section>;
  return <section><div className="section-title"><div><small>Linderhof community</small><h3>Member Directory</h3></div><span className="directory-count">{visible.length} members</span></div>
    <div className="directory-tools"><label className="directory-search"><Users size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search members by name"/></label><select value={sort} onChange={e=>setSort(e.target.value)}><option value="az">Name: A–Z</option><option value="low">Lowest handicap</option><option value="high">Highest handicap</option></select></div>
    {directoryError&&<p role="alert">{directoryError}</p>}{directoryLoading?<p>Loading directory…</p>:visible.length?<div className="member-directory-grid">{visible.map(member=>{const initials=(member.full_name||'Member').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();return <article className="directory-card" key={member.id}><div className={`member-avatar ${member.avatar_url?'has-photo':''}`}>{member.avatar_url&&member.privacy_show_photo!==false?<img src={member.avatar_url} alt={`${member.full_name||'Member'} profile`}/>:initials}</div><div className="directory-card-copy"><h3>{member.full_name||'Linderhof Member'}</h3><p>{member.membership_level==='social'?'Social':member.privacy_show_division===false?'Linderhof Member':(member.division?`${member.division} Division`:'Member')}</p></div>{member.membership_level!=='social'&&<div className="handicap-badge"><small>Club Index</small><strong>{member.privacy_show_club_index===false?'Private':(member.handicap_index??'—')}</strong></div>}</article>})}</div>:<Empty text="No members match your search."/>}
  </section>
}

function Member({session,profile,rounds=[],reload,notify,forceRecovery=false,onRecoveryComplete,hasGolfAccess=false}){
  const [accountTab,setAccountTab]=useState('card');
  const [mode,setMode]=useState('login');
  const [form,setForm]=useState({email:'',password:'',full_name:'',division:'Men'});
  const [resetPassword,setResetPassword]=useState('');
  const [resetConfirm,setResetConfirm]=useState('');
  const [recoveryMode,setRecoveryMode]=useState(false);
  useEffect(()=>{
    if(forceRecovery){setRecoveryMode(true);setMode('reset');}
  },[forceRecovery]);
  useEffect(()=>{
    const {data:{subscription}}=supabase.auth.onAuthStateChange((event)=>{
      if(event==='PASSWORD_RECOVERY'){setRecoveryMode(true);setMode('reset');}
    });
    return ()=>subscription.unsubscribe();
  },[]);
  const [photoFile,setPhotoFile]=useState(null);
  const [uploadingPhoto,setUploadingPhoto]=useState(false);
  const [showQr,setShowQr]=useState(false);
  const [privacy,setPrivacy]=useState({privacy_show_photo:true,privacy_show_club_index:true,privacy_show_division:true});
  useEffect(()=>{if(profile)setPrivacy({privacy_show_photo:profile.privacy_show_photo!==false,privacy_show_club_index:profile.privacy_show_club_index!==false,privacy_show_division:profile.privacy_show_division!==false})},[profile?.id,profile?.privacy_show_photo,profile?.privacy_show_club_index,profile?.privacy_show_division]);
  const [ownerUnit,setOwnerUnit]=useState({unit_building:'',unit_number:''});
  const [savingOwnerUnit,setSavingOwnerUnit]=useState(false);
  useEffect(()=>{setOwnerUnit({unit_building:profile?.unit_building||'',unit_number:profile?.unit_number||''})},[profile?.id,profile?.unit_building,profile?.unit_number]);
  async function saveOwnerUnit(){
    if(!session?.user?.id||profile?.membership_level!=='owner')return;
    if(!ownerUnit.unit_number.trim())return notify('Enter your unit number.');
    setSavingOwnerUnit(true);
    const {error}=await supabase.rpc('update_owner_unit_information',{p_member_id:session.user.id,p_building:ownerUnit.unit_building.trim(),p_unit:ownerUnit.unit_number.trim()});
    setSavingOwnerUnit(false);
    if(error)return notify(errText(error));
    notify('Condo unit information saved.');await reload();
  }
  async function savePrivacy(){
    if(!session?.user?.id)return;
    const {error}=await supabase.from('profiles').update({...privacy,updated_at:new Date().toISOString()}).eq('id',session.user.id);
    if(error)return notify(errText(error));notify('Privacy settings saved.');await reload();
  }

  async function submit(e){
    e.preventDefault();
    if(mode==='login'){
      const {error}=await supabase.auth.signInWithPassword({email:form.email,password:form.password});
      if(error)return notify(errText(error));
      notify('Signed in.');
    }else{
      const {error}=await supabase.auth.signUp({
        email:form.email,
        password:form.password,
        options:{data:{full_name:form.full_name,division:form.division},emailRedirectTo:PUBLIC_SITE_URL}
      });
      if(error)return notify(errText(error));
      notify('Check your email to confirm your account.');
    }
  }

  async function sendPasswordReset(e){
    e.preventDefault();
    if(!form.email)return notify('Enter your email address first.');
    const {error}=await supabase.auth.resetPasswordForEmail(form.email,{redirectTo:`${PUBLIC_SITE_URL}/?type=recovery`});
    if(error)return notify(errText(error));
    notify('Password reset email sent. Check your inbox and junk folder.');
    setMode('login');
  }

  async function finishPasswordReset(e){
    e.preventDefault();
    if(resetPassword.length<6)return notify('Your new password must be at least 6 characters.');
    if(resetPassword!==resetConfirm)return notify('The passwords do not match.');
    const {error}=await supabase.auth.updateUser({password:resetPassword});
    if(error)return notify(errText(error));
    setRecoveryMode(false);setMode('login');setResetPassword('');setResetConfirm('');
    onRecoveryComplete?.();
    notify('Password updated successfully.');
    window.history.replaceState({},document.title,'/');
  }

  async function uploadProfilePhoto(){
    if(!session?.user||!photoFile)return notify('Choose a photo first.');
    if(!photoFile.type.startsWith('image/'))return notify('Please choose an image file.');
    if(photoFile.size>5*1024*1024)return notify('Please choose an image smaller than 5 MB.');
    setUploadingPhoto(true);
    try{
      const ext=(photoFile.name.split('.').pop()||'jpg').toLowerCase().replace(/[^a-z0-9]/g,'');
      const path=`${session.user.id}/avatar-${Date.now()}.${ext||'jpg'}`;
      const uploaded=await supabase.storage.from('profile-photos').upload(path,photoFile,{cacheControl:'3600'});
      if(uploaded.error)throw uploaded.error;
      const avatar_url=supabase.storage.from('profile-photos').getPublicUrl(path).data.publicUrl;
      const updated=await supabase.from('profiles').update({avatar_url,updated_at:new Date().toISOString()}).eq('id',session.user.id);
      if(updated.error)throw updated.error;
      setPhotoFile(null);
      await reload();
      notify('Profile photo updated.');
    }catch(error){
      notify(errText(error));
    }finally{
      setUploadingPhoto(false);
    }
  }

  async function removeProfilePhoto(){
    if(!session?.user)return;
    const updated=await supabase.from('profiles').update({avatar_url:null,updated_at:new Date().toISOString()}).eq('id',session.user.id);
    if(updated.error)return notify(errText(updated.error));
    await reload();
    notify('Profile photo removed.');
  }

  async function logout(){
    withOneSignal(async OneSignal=>{await OneSignal.logout()});
    await supabase.auth.signOut();
    notify('Signed out.');
  }

  async function addToAppleWallet(){
    if(!session?.access_token)return notify('Please sign in again before adding your pass.');
    try{
      notify('Preparing your LINDEX Pass…');
      const response=await fetch('/api/apple-wallet',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`}});
      if(!response.ok){
        let message='Apple Wallet pass is not available yet.';
        try{const data=await response.json();message=data?.error||message}catch{}
        return notify(message);
      }
      const blob=await response.blob();
      offerFile(blob,'LINDEX-Membership.pkpass');
    }catch(error){notify(errText(error))}
  }

  if(recoveryMode){
    return <section className="auth-wrap"><div className="card auth"><div className="brand-mini"><img src="/assets/lindex-app-icon.png"/><div><small>LINDEX • Secure access</small><h3>Create a New Password</h3></div></div><p className="auth-help-copy">Enter a new password for your LINDEX account.</p><form onSubmit={finishPasswordReset}><label>New Password<input type="password" minLength="6" required value={resetPassword} onChange={e=>setResetPassword(e.target.value)}/></label><label>Confirm New Password<input type="password" minLength="6" required value={resetConfirm} onChange={e=>setResetConfirm(e.target.value)}/></label><button className="primary full" type="submit">Save New Password</button></form></div></section>;
  }

  if(session){
    const initials=(profile?.full_name||session.user.email||'Member').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase();
    return <section>
      <div className="section-title"><div><small>Your account</small><h3>My LINDEX</h3><p className="muted">Your membership, visits and preferences.</p></div><button className="secondary" onClick={logout}><LogOut size={16}/>Sign out</button></div>
      <nav className="staff-tabs member-tabs" aria-label="My LINDEX sections">{[['card','My Card'],['activity','My Activity'],['profile','Profile'],['preferences','Preferences'],...(profile?.membership_level==='owner'?[['unit','My Condo Unit']]:[])].map(([id,label])=><button key={id} className={accountTab===id?'active':''} aria-current={accountTab===id?'page':undefined} onClick={()=>{setShowQr(false);setAccountTab(id)}}>{label}</button>)}</nav>
      {accountTab==='activity'&&<MyActivity key={session.user.id}/>}
      <div className="grid two">
        {accountTab==='profile'&&<PrivateContactDetails profileId={session.user.id}/ >}{accountTab==='profile'&&<div className="card member-card">
          <div className={`profile-photo-large ${profile?.avatar_url?'has-photo':''}`}>
            {profile?.avatar_url?<img src={profile.avatar_url} alt="Your profile"/>:initials}
          </div>
          <h3>{profile?.full_name||session.user.email}</h3>
          <p>{profile?.division||'Member'} Division</p>
          <div className="membership-level-line"><span className={`pill ${profile?.membership_status==='active'?'green':''}`}>{profile?.membership_status||'pending'}</span><span className="pill membership-tier">{membershipLevelLabel(profile?.membership_level)}</span></div>
          <div className="profile-photo-editor">
            <label>Profile Photo<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setPhotoFile(e.target.files?.[0]||null)}/></label>
            {photoFile&&<small>Selected: {photoFile.name}</small>}
            <div className="profile-photo-actions">
              <button className="primary" disabled={uploadingPhoto||!photoFile} onClick={uploadProfilePhoto}>{uploadingPhoto?'Uploading…':'Upload Photo'}</button>
              {profile?.avatar_url&&<button className="secondary" disabled={uploadingPhoto} onClick={removeProfilePhoto}>Remove</button>}
            </div>
            <small>JPG, PNG, or WebP. Maximum 5 MB.</small>
          </div>
        </div>
        }
        {accountTab==='card'&&<div className="card membership-card-panel premium-membership-panel">
          <div className="member-card-heading"><div><small>Digital membership card</small><h3>Your LINDEX Card</h3></div><CreditCard/></div>
          {(()=>{
            const token=profile?.verification_token;
            const verifyUrl=token?`${PUBLIC_SITE_URL}/verify?token=${encodeURIComponent(token)}`:'';
            return <>
              <div className="digital-member-card actual-card premium-card">
                <div className="premium-card-bg"/>
                <div className="premium-card-header">
                  <img className="premium-card-logo" src="/assets/linderhof-crest.png" alt="Linderhof Country Club crest"/>
                  <div className="premium-card-title"><strong>LINDEX</strong><span>MEMBER</span></div>
                  <div className="premium-card-established">{clubDate().slice(0,4)}</div>
                </div>
                <div className="premium-card-body">
                  <div className={`premium-card-photo ${profile?.avatar_url?'has-photo':''}`}>{profile?.avatar_url?<img src={profile.avatar_url} alt="Member"/>:<span>{initials}</span>}</div>
                  <div className="premium-card-info">
                    <h3>{profile?.full_name||session.user.email}</h3>
                    <p className="premium-card-level">{membershipLevelLabel(profile?.membership_level)}</p>
                      {profile?.membership_level==='owner'&&<div className="premium-owner-unit"><small>CONDO UNIT</small><b>{[profile?.unit_building,profile?.unit_number?`Unit ${profile.unit_number}`:''].filter(Boolean).join(' • ')||'Unit not entered'}</b></div>}
                    <div className="premium-card-meta">
                      {profile?.membership_level!=='social'&&<span><small>CLUB INDEX</small><b>{profile?.handicap_index??'—'}</b></span>}
                      <span><small>MEMBER ID</small><b>{profile?.member_code||'Pending'}</b></span>
                      <span><small>STATUS</small><b>{profile?.membership_status==='active'?'ACTIVE':'PENDING'}</b></span>
                    </div>
                  </div>
                  <button type="button" className="premium-card-qr" disabled={!verifyUrl} onClick={()=>verifyUrl&&setShowQr(true)} aria-label="Show membership verification QR code">
                    {verifyUrl?<QRCodeSVG value={verifyUrl} size={92} bgColor="#ffffff" fgColor="#073c2c" level="M"/>:<QrCode size={62}/>}
                    <small>{verifyUrl?'SCAN TO VERIFY':'SETUP REQUIRED'}</small>
                  </button>
                </div>
                <div className="premium-card-footer"><span>LIFE IS BETTER AT LINDERHOF</span></div>
              </div>
              <div className="membership-card-actions">
                <button className="apple-wallet-btn" onClick={addToAppleWallet}><WalletCards size={20}/><span><b>Add to Apple Wallet</b><small>Keep your membership card on your iPhone</small></span></button>
                <button className="secondary show-qr-btn" disabled={!verifyUrl} onClick={()=>verifyUrl&&setShowQr(true)}><QrCode size={19}/> Show QR to Staff</button>
              </div>
              <p className="wallet-note">Club staff can scan your QR code with any phone camera to verify your current membership status. The QR does not contain your personal information.</p>
              {!token&&<p className="verification-setup-note">QR verification needs the one-time V16_2_MEMBER_VERIFICATION.sql setup in Supabase.</p>}
              {showQr&&verifyUrl&&<div className="qr-modal" role="dialog" aria-modal="true" aria-label="LINDEX membership QR code" onClick={()=>setShowQr(false)}><div className="qr-modal-card" onClick={e=>e.stopPropagation()}><button className="qr-modal-close" onClick={()=>setShowQr(false)}><X/></button><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><small>LINDEX MEMBER VERIFICATION</small><h3>{profile?.full_name||'Linderhof Member'}</h3><div className="qr-large"><QRCodeSVG value={verifyUrl} size={230} bgColor="#ffffff" fgColor="#073c2c" level="Q"/></div><p>Show this code to club staff. They can scan it with their phone camera.</p><span className={`verification-status-pill ${profile?.membership_status==='active'?'active':''}`}>{profile?.membership_status==='active'?'ACTIVE MEMBER':'PENDING APPROVAL'}</span></div></div>}
            </>
          })()}
        </div>
        }
        {accountTab==='unit'&&profile?.membership_level==='owner'&&<div className="card owner-unit-editor"><div className="member-card-heading"><div><small>LPOA Condo Owner Membership</small><h3>My Condo Unit</h3></div></div><p className="muted">Add the unit information shown on your digital membership card. Club administrators can also update it.</p><div className="owner-unit-fields"><label>Building (optional)<input maxLength={100} value={ownerUnit.unit_building} onChange={e=>setOwnerUnit(v=>({...v,unit_building:e.target.value}))} placeholder="Building or property"/></label><label>Unit number<input maxLength={100} required value={ownerUnit.unit_number} onChange={e=>setOwnerUnit(v=>({...v,unit_number:e.target.value}))} placeholder="e.g. 18B"/></label></div><button className="primary" disabled={savingOwnerUnit} onClick={saveOwnerUnit}>{savingOwnerUnit?'Saving…':'Save Unit Information'}</button></div>}
        {accountTab==='preferences'&&<div className="card privacy-card">
          <div className="member-card-heading"><div><small>Member directory</small><h3>Privacy Controls</h3></div><ShieldCheck/></div>
          <p className="muted">Choose what other signed-in Linderhof members can see in the Member Directory. Staff verification is not affected.</p>
          <div className="privacy-options">{[['privacy_show_photo','Show my profile photo'],['privacy_show_club_index','Show my Club Index'],['privacy_show_division','Show my division']].map(([key,label])=><label key={key}><input type="checkbox" checked={privacy[key]} onChange={e=>setPrivacy({...privacy,[key]:e.target.checked})}/><span>{label}</span></label>)}</div>
          <button className="primary" onClick={savePrivacy}>Save Privacy Settings</button>
        </div>
        }
        {accountTab==='card'&&<div className="card">
          <h3>Membership Details</h3>
          <div className="details"><div><span>Email</span><b>{session.user.email}</b></div><div><span>Membership</span><b>{membershipLevelLabel(profile?.membership_level)}</b></div><div><span>Role</span><b>{profile?.role||'member'}</b></div>{profile?.membership_level==='owner'&&<div><span>Condo Unit</span><b>{[profile?.unit_building,profile?.unit_number?`Unit ${profile.unit_number}`:''].filter(Boolean).join(' • ')||'Not entered'}</b></div>}{hasGolfAccess&&<div><span>Linderhof Club Index</span><b>{profile?.handicap_index??'Not established'}</b></div>}</div>
          {hasGolfAccess&&(()=>{const info=calculateClubIndex(rounds);return <div className="club-index-explainer"><div className="club-index-explainer-head"><div><small>LINDEX CLUB INDEX</small><h4>{info.index??'Not established'}</h4></div><span>{info.count} equivalent rounds</span></div><p>Two 9-hole rounds are paired to create one 18-hole equivalent. An 18-hole round counts by itself. The best recent equivalents are then used to calculate your club index.</p>{info.index!=null&&<div className="index-counting-scores"><small>COUNTING SCORES</small><div>{info.selected.map((v,i)=><span key={i}>{v>=0?'+':''}{v}</span>)}</div><p>{info.used} of your {info.count} recent equivalents currently count{info.adjustment?` • adjustment ${info.adjustment}`:''}.</p></div>}{info.pendingNine===1&&<p className="pending-nine-note">You currently have one unpaired 9-hole round. It will count as soon as you save another 9-hole round.</p>}</div>})()}

        </div>}
        {accountTab==='preferences'&&<div className="card">          {IS_NATIVE_IOS?<div className="notification-preferences"><div className="notification-pref-head"><Bell/><div><h4>Phone Notifications</h4><p>Notifications for the native LINDEX app are managed through iPhone Settings.</p></div></div><p className="muted">Web push settings are hidden inside the native iOS app to prevent WebKit compatibility issues.</p></div>:<NotificationPreferences notify={notify}/>}
</div>}
      </div>
    </section>;
  }

  if(mode==='forgot')return <section className="auth-wrap"><div className="card auth"><div className="brand-mini"><img src="/assets/lindex-app-icon.png"/><div><small>LINDEX • Account recovery</small><h3>Forgot Password?</h3></div></div><p className="auth-help-copy">Enter the email address connected to your LINDEX account. We'll email you a secure link to create a new password.</p><form onSubmit={sendPasswordReset}><label>Email<input type="email" required autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><button className="primary full" type="submit"><Mail size={17}/> Send Reset Link</button></form><button className="text-btn" onClick={()=>setMode('login')}>Back to Sign In</button></div></section>;

  return <section className="auth-wrap"><div className="card auth"><div className="brand-mini"><img src="/assets/lindex-app-icon.png"/><div><small>LINDEX • Secure access</small><h3>{mode==='login'?'Welcome Back':'Join the Digital Clubhouse'}</h3></div></div><form onSubmit={submit}>{mode==='signup'&&<><label>Full Name<input required value={form.full_name} onChange={e=>setForm({...form,full_name:e.target.value})}/></label><label>Division<select value={form.division} onChange={e=>setForm({...form,division:e.target.value})}><option>Men</option><option>Women</option></select></label></>}<label>Email<input type="email" required value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Password<input type="password" minLength="6" required value={form.password} onChange={e=>setForm({...form,password:e.target.value})}/></label>{mode==='login'&&<button type="button" className="forgot-password-link" onClick={()=>setMode('forgot')}>Forgot password?</button>}<button className="primary full" type="submit"><LogIn size={17}/>{mode==='login'?'Sign In':'Create Account'}</button></form><button className="text-btn" onClick={()=>setMode(mode==='login'?'signup':'login')}>{mode==='login'?'Sign Up':'Already registered? Sign in'}</button><p className="auth-privacy-note">Read our <a href="/privacy">Privacy Policy</a> to learn how LINDEX uses your information.</p><div className="auth-guest-link"><span>Renting a Linderhof unit?</span><a href="/guest-passes">Purchase a Guest Pass without signing in</a></div></div></section>;
}
function NotificationPreferences({notify}){
  const [supported,setSupported]=useState(Boolean(oneSignalAppId));
  const [enabled,setEnabled]=useState(false);
  const [checking,setChecking]=useState(true);
  const [error,setError]=useState('');
  const isIOS=typeof navigator!=='undefined'&&/iPhone|iPad|iPod/i.test(navigator.userAgent);
  const standalone=typeof window!=='undefined'&&(window.matchMedia?.('(display-mode: standalone)').matches||window.navigator.standalone===true);

  const timeout=(promise,ms=7000,message='Notification check timed out.')=>Promise.race([
    promise,
    new Promise((_,reject)=>setTimeout(()=>reject(new Error(message)),ms))
  ]);

  async function refreshStatus(){
    setError('');
    if(!oneSignalAppId){setSupported(false);setChecking(false);return}
    const browserSupported=typeof window!=='undefined'&&'Notification' in window&&'serviceWorker' in navigator&&'PushManager' in window;
    setSupported(browserSupported);
    if(!browserSupported){setEnabled(false);setChecking(false);return}

    // OneSignal uses its standard root service worker for the simplest and most
    // reliable web-push setup on LINDEX.
    if(Notification.permission!=='granted'){
      setEnabled(false);
      setChecking(false);
      return;
    }
    let finished=false;
    const stop=window.setTimeout(()=>{
      if(finished)return;
      finished=true;
      setEnabled(false);
      setChecking(false);
      setError('LINDEX could not connect to the notification service. Tap Try Again.');
    },15000);
    withOneSignal(async OneSignal=>{
      if(finished)return;
      try{
        const optedIn=Boolean(OneSignal.User?.PushSubscription?.optedIn);
        finished=true;window.clearTimeout(stop);
        setEnabled(optedIn);
        setChecking(false);
      }catch(err){
        if(finished)return;
        finished=true;window.clearTimeout(stop);
        setEnabled(false);setChecking(false);
        setError(err?.message||'LINDEX could not check phone notifications.');
      }
    },err=>{
      if(finished)return;
      finished=true;window.clearTimeout(stop);
      setEnabled(false);setChecking(false);
      setError(err?.message||'LINDEX could not connect to phone notifications.');
    });
  }

  useEffect(()=>{refreshStatus()},[]);

  function enable(){
    if(isIOS&&!standalone)return notify('On iPhone, add LINDEX to your Home Screen first, then open the app and enable notifications.');
    setChecking(true);setError('');
    let finished=false;
    const stop=window.setTimeout(()=>{
      if(finished)return;
      finished=true;
      setChecking(false);
      setError('Notification setup took too long. Tap Try Again.');
    },12000);
    withOneSignal(async OneSignal=>{
      try{
        if(OneSignal.Notifications?.permission!==true) await OneSignal.Notifications.requestPermission();
        if(OneSignal.Notifications?.permission===true && !OneSignal.User?.PushSubscription?.optedIn) await OneSignal.User.PushSubscription.optIn();
        if(finished)return;
        finished=true;window.clearTimeout(stop);
        await refreshStatus();
        notify(OneSignal.Notifications?.permission===true?'LINDEX phone notifications enabled.':'Notification permission was not granted. Check your browser or phone notification settings.');
      }catch(err){
        if(finished)return;
        finished=true;window.clearTimeout(stop);setChecking(false);setError(err?.message||'Could not enable notifications.');
      }
    },err=>{
      if(finished)return;
      finished=true;window.clearTimeout(stop);setChecking(false);setError(err?.message||'Could not enable notifications.');
    });
  }

  function disable(){
    setChecking(true);setError('');
    withOneSignal(async OneSignal=>{
      try{
        await OneSignal.User.PushSubscription.optOut();
        setEnabled(false);setChecking(false);notify('Phone notifications turned off.');
      }catch(err){setChecking(false);setError(err?.message||'Could not turn off notifications.')}
    },err=>{setChecking(false);setError(err?.message||'Could not turn off notifications.')});
  }

  return <div className="notification-preferences"><div className="notification-pref-head"><Bell/><div><h4>Phone Notifications</h4><p>Get new event and club announcement alerts from LINDEX.</p></div></div>{!oneSignalAppId?<p className="muted">Push notifications need to be connected by the club administrator.</p>:checking?<p className="muted">Checking notification status…</p>:error?<><p className="ios-push-note">{error}</p><button className="secondary" onClick={refreshStatus}>Try Again</button></>:!supported?<p className="muted">Push notifications are not supported on this browser.</p>:<><div className={`notification-state ${enabled?'on':''}`}>{enabled?'Notifications are ON':'Notifications are OFF'}</div>{isIOS&&!standalone&&<p className="ios-push-note">On iPhone: open LINDEX in Safari → Share → Add to Home Screen. Then open the Home Screen app and tap Enable.</p>}<button className={enabled?'secondary':'primary'} onClick={enabled?disable:enable}><Bell size={16}/>{enabled?'Turn Off Notifications':'Enable Phone Notifications'}</button></>}</div>
}
function Club({clubSettings}){const days=[['Monday','monday_hours'],['Tuesday','tuesday_hours'],['Wednesday','wednesday_hours'],['Thursday','thursday_hours'],['Friday','friday_hours'],['Saturday','saturday_hours'],['Sunday','sunday_hours']];return <section><div className="section-title"><div><small>Everything you need</small><h3>Club Information</h3></div></div><div className="grid three"><div className="card"><h3>Golf Course</h3><p>A welcoming 9-hole executive course. The digital scorecard uses par 3 for every hole.</p></div><div className="card"><h3>Pool & Clubhouse</h3><p>Heated pool, clubhouse, dining, bar service, golf events, and seasonal social activities.</p></div><div className="card"><h3>Contact</h3><p>110 Linderhof Golf Course Rd<br/>Bartlett, NH 03812<br/>(603) 374-2333<br/>linderhofclubhouse@gmail.com</p><a href="https://www.linderhofcountryclub.com" target="_blank">linderhofcountryclub.com</a></div></div><div className="card section"><h3>Clubhouse Hours</h3><div className="hours-list">{days.map(([label,key])=><div key={key}><span>{label}</span><b>{clubSettings?.[key]||'Hours not posted'}</b></div>)}</div>{clubSettings?.hours_note&&<p className="muted">{clubSettings.hours_note}</p>}</div></section>}

function AdminPassList({kind,passes,view,setView,queue,setQueue,loading,error,updatePass,activateAndEmail,emailPass,removePass}){
  const [search,setSearch]=useState(''),[busy,setBusy]=useState('');
  const scoped=passes.filter(g=>kind==='all'||(kind==='renter'?g.purchaser_type==='renter':g.purchaser_type!=='renter'));
  const visible=scoped.filter(g=>(view==='all'||passBucket(g)===view)&&matchesSearch(g,search)&&(view!=='pending'||queue==='all'||(queue==='payment'?g.payment_status!=='paid':g.payment_status==='paid')));
  async function act(id,fn){setBusy(id);try{await fn();}finally{setBusy('');}}
  return <div className="card"><div className="admin-section-heading"><div><small>Payment & access</small><h3>{kind==='member'?'Member Guest Passes':kind==='renter'?'Renter Passes':'All Passes'}</h3></div><span className="muted">{visible.length} shown</span></div><p className="muted">Confirm payment, then activate the pass. Past visits and closed requests appear in History.</p>
    <div className="admin-filter-tabs" aria-label="Pass status">{[['pending','Pending'],['active','Active'],['history','History'],['all','All']].map(([id,label])=><button key={id} aria-pressed={view===id} className={view===id?'active':''} onClick={()=>{setView(id);setQueue('all');}}>{label} <span>{id==='all'?scoped.length:scoped.filter(g=>passBucket(g)===id).length}</span></button>)}</div>
    <div className="admin-toolbar"><label>Search passes<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Guest, email, owner, unit, or date"/></label>{view==='pending'&&<label>Next step<select value={queue} onChange={e=>setQueue(e.target.value)}><option value="all">All pending requests</option><option value="payment">Confirm payment</option><option value="activation">Activate paid pass</option></select></label>}</div>
    {loading?<p role="status">Loading passes…</p>:error?<p className="form-error">Refresh the dashboard to load passes.</p>:visible.length?<div className="admin-rsvp-list">{visible.map(g=>{const archived=passBucket(g)==='history';const duration=Number(g.pass_duration_days||1),used=Number(g.pass_days_used||0);return <div className="admin-row guest-admin-row" key={g.id}><span><b>{g.guest_name}{g.guest_name_2?` & ${g.guest_name_2}`:''} · {g.pass_type}</b><small>{fmtDate(g.visit_date)} · {g.price_label||'Price not recorded'} · Unit {g.unit_number||'—'}</small><small>Owner/Member: {g.owner_member_name||g.sponsor_name||'—'}{g.purchaser_email?` · ${g.purchaser_email}`:''}</small><small>{g.purchaser_type==='renter'?'Renter':'Member guest'} · Payment: {g.payment_status} · Status: {g.status}{g.purchaser_type==='renter'&&duration>1?` · ${Math.max(duration-used,0)} of ${duration} days left${g.pass_expires_on?` · expires ${fmtDate(g.pass_expires_on)}`:''}`:''}</small></span><div className="admin-row-actions">
      {!archived&&g.payment_status!=='paid'&&<button className="small secondary" disabled={!!busy} onClick={()=>act(g.id,()=>updatePass(g.id,{payment_status:'paid'}))}>Mark Paid</button>}
      {!archived&&g.payment_status==='paid'&&g.status!=='active'&&<button className="small primary" disabled={!!busy} onClick={()=>act(g.id,()=>g.purchaser_email?activateAndEmail(g):updatePass(g.id,{status:'active'}))}>{g.purchaser_email?'Activate & Email':'Activate'}</button>}
      {!archived&&g.status==='active'&&g.payment_status==='paid'&&g.purchaser_email&&<button className="small secondary" disabled={!!busy} onClick={()=>act(g.id,()=>emailPass(g))}><Mail size={14}/>Email Pass</button>}
      {!archived&&g.status==='active'&&<button className="small secondary" disabled={!!busy} onClick={()=>act(g.id,()=>updatePass(g.id,{status:'pending'}))}>Deactivate</button>}
      <button className="small danger" disabled={!!busy} onClick={()=>act(g.id,()=>removePass(g.id))}>Delete</button>
    </div></div>})}</div>:<p className="muted">No passes match this view.</p>}
  </div>
}

function AdminRenterApprovals({notify,onChanged}){
  const [stays,setStays]=useState([]),[busy,setBusy]=useState('');
  const [view,setView]=useState('pending'),[search,setSearch]=useState(''),[page,setPage]=useState(0);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[total,setTotal]=useState(0);
  const version=useRef(0);
  async function load(silent=false){
    const request=++version.current;if(!silent)setLoading(true);setError('');
    try{
      let query=supabase.from('renter_stays').select('id,renter_name,renter_email,unit_number,start_date,end_date,occupants,status,created_at',{count:'exact'});
      query=view==='pending'?query.eq('status','pending'):query.in('status',['approved','rejected']);
      const result=await query.order('created_at',{ascending:false}).range(page*50,page*50+49);
      if(request!==version.current)return;
      if(result.error)throw result.error;
      if(page>0&&result.count<=page*50){setPage(Math.max(0,Math.ceil(result.count/50)-1));return;}
      setStays(result.data||[]);setTotal(result.count??0);
    }catch(e){if(request===version.current)setError(errText(e));}
    finally{if(request===version.current)setLoading(false);}
  }
  useEffect(()=>{load();return()=>{version.current++}},[view,page]);
  useLiveRefresh(['renter_stays'],()=>load(true),{key:`${view}-${page}`});
  async function decide(id,status){
    setBusy(id);
    try{
      const {error}=await supabase.rpc('admin_decide_renter_stay',{p_stay_id:id,p_status:status});
      if(error)throw error;
      setStays(current=>current.filter(stay=>stay.id!==id));
      onChanged?.();
      if(status==='approved'){
        try{
          const {error:emailError}=await supabase.functions.invoke('send-guest-pass-email',{body:{stay_id:id}});
          if(emailError){
            let detail=emailError.message;
            if(emailError.context?.json){try{const body=await emailError.context.json();detail=body.details?.message||body.error||detail}catch{}}
            throw new Error(detail);
          }
          notify('Stay approved. Approval email sent to the renter.');
        }catch(e){notify(`Stay approved, but email failed: ${errText(e)}. Contact the renter directly with their approval details.`)}
      }else notify('Renter stay rejected.');
      load();
    }catch(e){notify(errText(e));}finally{setBusy('');}
  }
  const visible=stays.filter(st=>matchesSearch({...st,guest_name:st.renter_name,purchaser_email:st.renter_email},search));
  return <div className="card"><div className="admin-section-heading"><div><small>Condo owner rentals</small><h3>Renter Stay Approvals</h3></div><button className="small secondary" disabled={loading||!!busy} onClick={load}>Refresh requests</button></div><p className="muted">Verify the booking and owner unit before approval. Reviewed stays remain available in History.</p>
    <div className="admin-filter-tabs" aria-label="Stay status">{[['pending','Pending'],['history','History']].map(([id,label])=><button key={id} disabled={!!busy} aria-pressed={view===id} className={view===id?'active':''} onClick={()=>{setView(id);setPage(0);setSearch('');}}>{label}</button>)}</div>
    <div className="admin-toolbar"><label>Search this page<input type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Renter name, email, or unit"/></label></div>
    {loading?<p role="status">Loading stays…</p>:error?<p className="form-error" role="alert">{error}</p>:visible.length?visible.map(st=><div className="admin-row" key={st.id}><span><b>{st.renter_name} · Unit {st.unit_number}</b><small>{st.renter_email} · {fmtDate(st.start_date)} – {fmtDate(st.end_date)} · {st.occupants} occupants</small><small className="pill">{st.status}</small></span>{view==='pending'&&<div className="admin-row-actions"><button className="small primary" disabled={!!busy} onClick={()=>decide(st.id,'approved')}>{busy===st.id?'Saving…':'Approve'}</button><button className="small secondary" disabled={!!busy} onClick={()=>decide(st.id,'rejected')}>Reject</button></div>}</div>):<p className="muted">{search?'No stays match this search.':view==='pending'?'No pending renter stay approvals.':'No reviewed stays yet.'}</p>}
    {!loading&&!error&&total>50&&<div className="admin-pagination"><button className="small secondary" disabled={page===0||!!busy} onClick={()=>setPage(v=>v-1)}>Previous</button><span>Page {page+1} of {Math.ceil(total/50)}</span><button className="small secondary" disabled={(page+1)*50>=total||!!busy} onClick={()=>setPage(v=>v+1)}>Next</button></div>}
  </div>
}

function AdminStaffManagement({members,notify}){
  const labels={scan_passes:'Scan and check in',view_signins:'View sign-in history',view_passes:'View confirmed passes',view_events:'View events and sign-ups',correct_signins:'Correct sign-ins and restore days',shift_notes:'Read and post shift notes',view_tournaments:'View tournaments and scores',approve_scores:'Approve tournament scores'};
  const empty=Object.fromEntries(Object.keys(labels).map(k=>[k,false]));
  const [rows,setRows]=useState([]),[selected,setSelected]=useState(''),[permissions,setPermissions]=useState(empty),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  async function load(){setLoading(true);const {data,error}=await supabase.from('staff_access').select('*');if(error)notify(errText(error));else setRows(data||[]);setLoading(false)}useEffect(()=>{load()},[]);
  function choose(id){setSelected(id);setPermissions({...empty,...rows.find(r=>r.profile_id===id)?.permissions})}
  async function save(){if(!selected||busy)return;setBusy(true);const {error}=await supabase.rpc('set_staff_operations_access',{p_profile_id:selected,p_active:true,p_permissions:permissions});setBusy(false);if(error)return notify(errText(error));notify('Staff permissions saved.');load()}
  async function offboard(row){if(!window.confirm('Disable all staff access for this account? Any open shift will be flagged for review.'))return;setBusy(true);const {data,error}=await supabase.rpc('offboard_staff',{p_id:row.profile_id});setBusy(false);notify(error?errText(error):data.message);load()}
  async function toggle(row){setBusy(true);const {error}=await supabase.rpc('set_staff_operations_access',{p_profile_id:row.profile_id,p_active:!row.active,p_permissions:row.permissions});setBusy(false);if(error)return notify(errText(error));load()}
  return <div className="card"><h3>Staff Permissions</h3><p>Staff use their own accounts at <a href="/staff">linderhofmembers.com/staff</a>. Choose each permission explicitly. Corrections restore verified pass days and require a reason.</p><div className="form-stack"><select aria-label="Staff account" disabled={busy} value={selected} onChange={e=>choose(e.target.value)}><option value="">Choose an active account…</option>{members.filter(m=>m.role!=='admin'&&m.membership_status==='active').map(m=><option key={m.id} value={m.id}>{m.full_name||m.email}</option>)}</select>{Object.entries(labels).map(([key,label])=><label className="report-checkbox" key={key}><input type="checkbox" disabled={busy} checked={!!permissions[key]} onChange={e=>setPermissions({...permissions,[key]:e.target.checked})}/>{label}</label>)}<button className="primary" disabled={busy||!selected} onClick={save}>Save Staff Access</button></div>{loading?<p>Loading staff…</p>:rows.map(row=><div className="admin-row" key={row.profile_id}><span><b>{members.find(m=>m.id===row.profile_id)?.full_name||row.profile_id}</b><small>{row.active?'Active':'Disabled'} · {Object.entries(labels).filter(([k])=>row.permissions?.[k]).map(([,v])=>v).join(' · ')||'No permissions'}</small></span><div className="admin-row-actions"><button className="small secondary" disabled={busy} onClick={()=>choose(row.profile_id)}>Edit</button><button className="small secondary" disabled={busy} onClick={()=>toggle(row)}>{row.active?'Disable':'Enable'}</button><button className="small danger" disabled={busy} onClick={()=>offboard(row)}>Offboard</button></div></div>)}</div>
}

function Admin({profile,staffMode=false,events,announcements,tournaments,clubSettings,members,galleryImages=[],tvMembers=[],reload,notify}){
  const [panel,setPanel]=useState('overview');
  const [memberSearch,setMemberSearch]=useState(''),[memberLevel,setMemberLevel]=useState('all'),[standingFilter,setStandingFilter]=useState('all');
  const [memberView,setMemberView]=useState('pending');
  const [adminMembers,setAdminMembers]=useState([]),[pendingStayCount,setPendingStayCount]=useState(null);
  const [adminLoading,setAdminLoading]=useState(true),[adminError,setAdminError]=useState('');
  const [passView,setPassView]=useState('pending'),[passQueue,setPassQueue]=useState('all');
  const [rsvpView,setRsvpView]=useState('pending');
  const adminLoadVersion=useRef(0);

  async function recordAdminActivity(action,entity_type,entity_id,details={}){
    const {error}=await supabase.rpc('record_admin_activity',{p_action:action,p_entity_type:entity_type,p_entity_id:entity_id||null,p_details:details});
    if(error)console.warn('Admin activity log failed',error);
  }

  const [ownerProfiles,setOwnerProfiles]=useState([]);
  const [ownerUnitDrafts,setOwnerUnitDrafts]=useState({});
  const [savingOwnerId,setSavingOwnerId]=useState(null);
  const [ownerUnitLoadError,setOwnerUnitLoadError]=useState('');
  async function loadOwnerProfiles(){
    const {data,error}=await supabase.from('profiles').select('id,full_name,email,membership_level,unit_building,unit_number').eq('membership_level','owner').order('full_name');
    if(error){setOwnerUnitLoadError(errText(error));return notify(errText(error));}
    setOwnerUnitLoadError('');
    setOwnerProfiles(data||[]);
    setOwnerUnitDrafts(Object.fromEntries((data||[]).map(m=>[m.id,{unit_building:m.unit_building||'',unit_number:m.unit_number||''}])));
  }
  useEffect(()=>{if(panel==='members')loadOwnerProfiles()},[panel]);
  async function saveAdminOwnerUnit(member){
    const unit=ownerUnitDrafts[member.id]||{unit_building:'',unit_number:''};
    if(!unit.unit_number.trim())return notify('Enter a unit number.');
    setSavingOwnerId(member.id);
    const {error}=await supabase.rpc('update_owner_unit_information',{p_member_id:member.id,p_building:unit.unit_building.trim(),p_unit:unit.unit_number.trim()});
    setSavingOwnerId(null);
    if(error)return notify(errText(error));
    notify('Owner unit updated.');await loadOwnerProfiles();await refreshAdmin();await reload();
  }

  const blankEvent={title:'',event_date:'',event_time:'',event_type:'Club Event',price:'',audience:'',description:'',square_url:'',capacity:'',rsvp_deadline:'',location:'',reminders_enabled:false};
  const [event,setEvent]=useState(blankEvent);
  const [editingEventId,setEditingEventId]=useState(null);
  const [eventPush,setEventPush]=useState(true);
  const [file,setFile]=useState(null);
  const [tournament,setTournament]=useState({name:'',tournament_date:'',description:''});
  const [announcement,setAnnouncement]=useState({title:'',message:''});
  const [editingAnnouncementId,setEditingAnnouncementId]=useState(null);
  const [announcementPush,setAnnouncementPush]=useState(true);
  const [pending,setPending]=useState([]),[pendingScores,setPendingScores]=useState([]),[adminRounds,setAdminRounds]=useState([]),[recentMembers,setRecentMembers]=useState([]),[eventRsvps,setEventRsvps]=useState([]),[guestPasses,setGuestPasses]=useState([]),[guestCategories,setGuestCategories]=useState([]);
  const [mediaFiles,setMediaFiles]=useState({});
  const [uploadingMedia,setUploadingMedia]=useState('');
  const [galleryFile,setGalleryFile]=useState(null);
  const [galleryCaption,setGalleryCaption]=useState('');
  const [galleryUploading,setGalleryUploading]=useState(false);
  const [tvMemberId,setTvMemberId]=useState('');
  const [tvMemberSubtitle,setTvMemberSubtitle]=useState('');
  const [settings,setSettings]=useState({
    course_status:'Open',course_status_note:'Enjoy your round.',pool_status:'Open',daily_special:'',daily_special_note:'',featured_event_id:'',
    monday_hours:'2:00 PM – Close',tuesday_hours:'2:00 PM – Close',wednesday_hours:'2:00 PM – Close',thursday_hours:'2:00 PM – Close',
    friday_hours:'12:00 PM – Close',saturday_hours:'12:00 PM – Close',sunday_hours:'12:00 PM – Close',hours_note:'',hero_image_url:'',gallery_image_1_url:'',gallery_image_2_url:'',gallery_image_3_url:'',pool_image_url:'',clubhouse_image_url:'',crest_image_url:'',tv_slide_seconds:18,tv_custom_message:'Welcome to Linderhof Country Club',tv_show_status:true,tv_show_special:true,tv_show_events:true,tv_show_announcements:true,tv_show_photos:true,tv_show_members:true
  });
  const previousClubSettings=useRef(null);
  useEffect(()=>{if(clubSettings){const incoming={...clubSettings,featured_event_id:clubSettings.featured_event_id||''};const previous=previousClubSettings.current;setSettings(draft=>mergeCleanFields(draft,previous,incoming));previousClubSettings.current=incoming}},[clubSettings]);
  async function saveSettings(){
    const payload={...settings,id:'main',featured_event_id:settings.featured_event_id||null,updated_by:profile.id,updated_at:new Date().toISOString()};
    const {error}=await supabase.from('club_settings').upsert(payload,{onConflict:'id'});
    if(error)return notify(errText(error));notify('Club controls updated.');reload();
  }
  async function saveTvToggle(key,checked){
    setSettings(prev=>({...prev,[key]:checked}));
    const {error}=await supabase.from('club_settings').upsert({id:'main',[key]:checked,updated_by:profile.id,updated_at:new Date().toISOString()},{onConflict:'id'});
    if(error){setSettings(prev=>({...prev,[key]:!checked}));return notify(`Could not update TV setting: ${errText(error)}`)}
    notify(checked?'TV slide turned on.':'TV slide turned off.');
    reload();
  }
  async function refreshAdmin(silent=false){
    const version=++adminLoadVersion.current;if(!silent)setAdminLoading(true);setAdminError('');
    try{
      const results=await Promise.all([
        readAdminRows(()=>supabase.from('profiles').select('*').eq('membership_status','pending').order('created_at').order('id')),
        readAdminRows(()=>supabase.from('tournament_scores').select('*').eq('approved',false).order('created_at').order('id')),
        supabase.from('private_rounds').select('id,played_on,created_at,user_id,gross_score,holes_played').order('created_at',{ascending:false}).limit(200),
        supabase.from('profiles').select('id,full_name,email,membership_status,membership_level,created_at,avatar_url').order('created_at',{ascending:false}).limit(6),
        readAdminRows(()=>supabase.from('event_rsvps').select('*,events(title,event_date),profiles(full_name,email)').order('created_at',{ascending:false}).order('id')),
        readAdminRows(()=>supabase.from('guest_pass_requests').select('*').order('created_at',{ascending:false}).order('id')),
        readAdminRows(()=>supabase.from('guest_pass_categories').select('*').order('sort_order').order('name').order('id')),
        supabase.from('renter_stays').select('id',{count:'exact',head:true}).eq('status','pending'),
        readAdminRows(()=>supabase.from('profiles').select('id,full_name,email,division,handicap_index,membership_status,membership_level,good_standing,role,unit_building,unit_number').eq('membership_status','active').order('full_name').order('id'))
      ]);
      if(version!==adminLoadVersion.current)return;
      const failure=results.find(result=>result.error);if(failure)throw failure.error;
      const [p,s,r,rm,er,gp,gs,st,am]=results;
      setPending(p.data||[]);setPendingScores(s.data||[]);setAdminRounds(r.data||[]);setRecentMembers(rm.data||[]);
      setEventRsvps(er.data||[]);setGuestPasses(gp.data||[]);setGuestCategories(gs.data||[]);setPendingStayCount(st.count??0);setAdminMembers(am.data||[]);
    }catch(error){if(version===adminLoadVersion.current)setAdminError(errText(error));}
    finally{if(version===adminLoadVersion.current)setAdminLoading(false);}
  }
  useEffect(()=>{if(!staffMode)refreshAdmin();return()=>{adminLoadVersion.current++}},[]);
  useLiveRefresh(['guest_pass_requests','guest_pass_categories','renter_stays','profiles','event_rsvps','tournament_scores','private_rounds'],()=>refreshAdmin(true),{enabled:!staffMode,key:profile?.id});
  async function sendPhonePush(title,message,url='/'){
    const {error}=await supabase.functions.invoke('send-push',{body:{title,message,url}});
    if(error){notify(`Saved, but push notification failed: ${errText(error)}`);return false}
    return true;
  }
  async function uploadEventImage(existingUrl=null){
    if(!file)return existingUrl;
    const ext=file.name.split('.').pop();const path=`${crypto.randomUUID()}.${ext}`;
    const up=await supabase.storage.from('event-images').upload(path,file);
    if(up.error)throw up.error;
    return supabase.storage.from('event-images').getPublicUrl(path).data.publicUrl;
  }
  function startEditEvent(item){
    setEditingEventId(item.id);
    setEvent({title:item.title||'',event_date:item.event_date||'',event_time:item.event_time||'',event_type:item.event_type||'Club Event',price:item.price||'',audience:item.audience||'',description:item.description||'',square_url:item.square_url||'',capacity:item.capacity??'',rsvp_deadline:item.rsvp_deadline?.slice(0,16)||'',location:item.location||'',reminders_enabled:!!item.reminders_enabled});
    setFile(null);setEventPush(false);window.scrollTo({top:0,behavior:'smooth'});
  }
  function cancelEditEvent(){setEditingEventId(null);setEvent(blankEvent);setFile(null);setEventPush(true)}
  async function saveEvent(){
    if(!event.title.trim())return notify('Enter an event name.');
    try{
      const existing=editingEventId?events.find(x=>x.id===editingEventId):null;
      const image_url=await uploadEventImage(existing?.image_url||null);
      const savedEvent={...event,capacity:event.capacity===''?null:Number(event.capacity),rsvp_deadline:event.rsvp_deadline||null};
      let error;
      if(editingEventId){({error}=await supabase.from('events').update({...savedEvent,image_url}).eq('id',editingEventId));}
      else{({error}=await supabase.from('events').insert({...savedEvent,image_url,created_by:profile.id}));}
      if(error)throw error;
      const wasEditing=Boolean(editingEventId);
      if(eventPush){
        const when=[fmtDate(event.event_date),fmtTime(event.event_time)].filter(Boolean).join(' • ');
        await sendPhonePush(wasEditing?`Event Updated: ${event.title}`:`New Event: ${event.title}`,[when,event.description].filter(Boolean).join(' — '),'/');
      }
      setEditingEventId(null);setEvent(blankEvent);setFile(null);setEventPush(true);notify(wasEditing?'Event updated.':'Event published.');reload();
    }catch(error){notify(errText(error))}
  }
  async function toggleEventTV(item){
    const next=item.tv_visible===false;
    const {error}=await supabase.from('events').update({tv_visible:next}).eq('id',item.id);
    if(error)return notify(`Could not update TV event selection: ${errText(error)}`);
    notify(next?'Event added to LINDEX TV.':'Event removed from LINDEX TV.');
    reload();
  }
  async function createTournament(){const {error}=await supabase.from('tournaments').insert({...tournament,created_by:profile.id});if(error)return notify(errText(error));notify('Tournament created.');setTournament({name:'',tournament_date:'',description:''});reload()}
  function startEditAnnouncement(item){setEditingAnnouncementId(item.id);setAnnouncement({title:item.title||'',message:item.message||''});setAnnouncementPush(false);window.scrollTo({top:0,behavior:'smooth'})}
  function cancelEditAnnouncement(){setEditingAnnouncementId(null);setAnnouncement({title:'',message:''});setAnnouncementPush(true)}
  async function saveAnnouncement(){
    if(!announcement.title.trim()||!announcement.message.trim())return notify('Enter an announcement title and message.');
    let error;
    if(editingAnnouncementId){({error}=await supabase.from('announcements').update({...announcement,published:true}).eq('id',editingAnnouncementId));}
    else{({error}=await supabase.from('announcements').insert({...announcement,created_by:profile.id,published:true}));}
    if(error)return notify(errText(error));
    const wasEditing=Boolean(editingAnnouncementId);
    if(announcementPush)await sendPhonePush(wasEditing?`Club Update: ${announcement.title}`:announcement.title,announcement.message,'/');
    setEditingAnnouncementId(null);setAnnouncement({title:'',message:''});setAnnouncementPush(true);notify(wasEditing?'Announcement updated.':'Announcement published.');reload();
  }
  async function updateGoodStanding(id,good_standing){const {error}=await supabase.from('profiles').update({good_standing}).eq('id',id);if(error)return notify(errText(error));await recordAdminActivity(good_standing?'marked_good_standing':'marked_not_good_standing','profile',id,{});notify(good_standing?'Member marked in good standing.':'Member marked not in good standing.');await refreshAdmin();await reload()}
  async function approve(id,membership_level='full_golf'){const {error}=await supabase.from('profiles').update({membership_status:'active',membership_level}).eq('id',id);if(error)return notify(errText(error));await recordAdminActivity('approved_member','profile',id,{membership_level});notify(`Member approved as ${membershipLevelShort(membership_level)}.`);refreshAdmin();reload()}
  async function updateMembershipLevel(id,membership_level){const {error}=await supabase.from('profiles').update({membership_level}).eq('id',id);if(error)return notify(errText(error));notify(`Membership changed to ${membershipLevelShort(membership_level)}.`);await refreshAdmin();await loadOwnerProfiles();await reload()}
  async function approveScore(id){const score=pendingScores.find(s=>s.id===id);if(!score)return;const {error}=await supabase.rpc('staff_approve_score',{p_score_id:id,p_expected_gross:score.gross_score,p_expected_net:score.net_score,p_expected_handicap:score.playing_handicap});if(error)return notify(errText(error));notify('Score approved.');refreshAdmin();reload()}
  async function remove(table,id){if(!confirm('Delete this item?'))return;const {error}=await supabase.from(table).delete().eq('id',id);if(error)return notify(errText(error));notify('Deleted.');refreshAdmin();reload()}
  async function updateMemberHandicap(id,value){const handicap=Number(value);if(!Number.isFinite(handicap)||handicap<-10||handicap>54)return notify('Enter a handicap between -10 and 54.');const {error}=await supabase.from('profiles').update({handicap_index:handicap}).eq('id',id);if(error)return notify(errText(error));notify('Member handicap updated.');refreshAdmin();reload()}
  async function uploadWebsiteImage(key,label){
    const file=mediaFiles[key];
    if(!file)return notify(`Choose an image for ${label}.`);
    if(file.size>12*1024*1024)return notify('Images must be under 12 MB.');
    setUploadingMedia(key);
    const ext=(file.name.split('.').pop()||'jpg').toLowerCase();
    const path=`${key}/${crypto.randomUUID()}.${ext}`;
    const upload=await supabase.storage.from('website-images').upload(path,file,{upsert:false,contentType:file.type});
    if(upload.error){setUploadingMedia('');return notify(errText(upload.error));}
    const url=supabase.storage.from('website-images').getPublicUrl(path).data.publicUrl;
    // Only update the image field being changed. Do not send the entire settings
    // object here, because older Supabase schemas may not yet contain every
    // newer club/TV setting column.
    const saved=await supabase.from('club_settings').update({
      [key]:url,
      updated_by:profile.id,
      updated_at:new Date().toISOString()
    }).eq('id','main');
    setUploadingMedia('');
    if(saved.error)return notify(`Image uploaded, but could not save it: ${errText(saved.error)}`);
    setSettings(prev=>({...prev,[key]:url}));
    setMediaFiles(prev=>({...prev,[key]:null}));
    notify(`${label} updated.`);
    reload();
  }
  async function addGalleryImage(){
    if(!galleryFile)return notify('Choose a gallery image first.');
    if(!galleryFile.type.startsWith('image/'))return notify('Please choose an image file.');
    if(galleryFile.size>12*1024*1024)return notify('Images must be under 12 MB.');
    setGalleryUploading(true);
    try{
      const ext=(galleryFile.name.split('.').pop()||'jpg').toLowerCase();
      const path=`gallery/${crypto.randomUUID()}.${ext}`;
      const upload=await supabase.storage.from('website-images').upload(path,galleryFile,{contentType:galleryFile.type});
      if(upload.error)throw upload.error;
      const image_url=supabase.storage.from('website-images').getPublicUrl(path).data.publicUrl;
      const maxOrder=galleryImages.reduce((m,x)=>Math.max(m,Number(x.sort_order||0)),0);
      const saved=await supabase.from('gallery_images').insert({image_url,caption:galleryCaption.trim()||null,sort_order:maxOrder+1,active:true,created_by:profile.id});
      if(saved.error)throw saved.error;
      setGalleryFile(null);setGalleryCaption('');notify('Gallery photo added.');await reload();
    }catch(error){notify(errText(error))}finally{setGalleryUploading(false)}
  }
  async function deleteGalleryImage(item){
    if(!confirm('Remove this photo from the gallery?'))return;
    const {error}=await supabase.from('gallery_images').delete().eq('id',item.id);
    if(error)return notify(errText(error));notify('Gallery photo removed.');reload();
  }
  async function addTvMember(){
    const member=members.find(m=>m.id===tvMemberId);
    if(!member)return notify('Choose a member first.');
    const payload={profile_id:member.id,display_name:member.full_name||'Linderhof Member',division:member.division||null,club_index:member.handicap_index??null,photo_url:member.avatar_url||null,subtitle:tvMemberSubtitle.trim()||null,active:true,sort_order:tvMembers.length+1,created_by:profile.id};
    const {error}=await supabase.from('tv_member_spotlights').upsert(payload,{onConflict:'profile_id'});
    if(error)return notify(errText(error));setTvMemberId('');setTvMemberSubtitle('');notify('Member added to TV Mode.');reload();
  }
  async function removeTvMember(id){
    const {error}=await supabase.from('tv_member_spotlights').delete().eq('id',id);
    if(error)return notify(errText(error));notify('Member removed from TV Mode.');reload();
  }
  async function markRsvpPaid(id,paid=true){const {error}=await supabase.from('event_rsvps').update({payment_status:paid?'paid':'pending',updated_at:new Date().toISOString()}).eq('id',id);if(error)return notify(errText(error));await recordAdminActivity(paid?'marked_rsvp_paid':'reset_rsvp_payment','event_rsvp',id,{});notify(paid?'RSVP marked paid.':'RSVP payment reset.');refreshAdmin()}
  async function deleteRsvp(id){if(!confirm('Remove this person from the event RSVP list?'))return;const {error}=await supabase.from('event_rsvps').delete().eq('id',id);if(error)return notify(errText(error));notify('RSVP removed.');refreshAdmin()}
  async function emailGuestPass(pass){
    if(!pass?.purchaser_email)return notify('No purchaser email is saved for this pass.');
    try{
      const {data:{session}}=await supabase.auth.getSession();
      if(!session?.access_token)return notify('Pass activated, but email failed: your admin session expired. Please sign in again.');
      const supabaseUrl=(import.meta.env.VITE_SUPABASE_URL||'https://knilbiotkkziesxdknfe.supabase.co').replace(/\/$/,'');
      const anonKey=import.meta.env.VITE_SUPABASE_ANON_KEY||import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY||'';
      const response=await fetch(`${supabaseUrl}/functions/v1/send-guest-pass-email`,{
        method:'POST',
        headers:{
          'Authorization':`Bearer ${session.access_token}`,
          'Content-Type':'application/json',
          ...(anonKey?{'apikey':anonKey}:{})
        },
        body:JSON.stringify({pass_id:pass.id})
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok){
        const detail=payload?.details?.message||payload?.details?.error||payload?.error||`HTTP ${response.status}`;
        return notify(`Pass activated, but email failed: ${detail}`);
      }
      notify(`Digital pass emailed to ${pass.purchaser_email}.`);
    }catch(error){
      notify(`Pass activated, but email failed: ${error?.message||String(error)}`);
    }
  }
  async function activateAndEmailGuestPass(pass){const {error}=await supabase.from('guest_pass_requests').update({payment_status:'paid',status:'active',updated_at:new Date().toISOString()}).eq('id',pass.id);if(error)return notify(errText(error));await recordAdminActivity('activated_guest_pass','guest_pass_request',pass.id,{purchaser_type:pass.purchaser_type,guest_name:pass.guest_name});await emailGuestPass({...pass,payment_status:'paid',status:'active'});refreshAdmin()}
  async function saveGuestCategory(category){const {error}=await supabase.from('guest_pass_categories').upsert({...category,updated_at:new Date().toISOString()},{onConflict:'id'});if(error)return notify(errText(error));notify(`${category.name} settings saved.`);refreshAdmin()}
  async function addGuestCategory(){const id=`category-${Date.now()}`;const row={id,name:'New Guest Pass',price_label:'',square_url:'',duration_days:1,active:true,sort_order:(guestCategories.at(-1)?.sort_order||0)+10};const {error}=await supabase.from('guest_pass_categories').insert(row);if(error)return notify(errText(error));refreshAdmin()}
  async function updateGuestPass(id,patch){const {error}=await supabase.from('guest_pass_requests').update({...patch,updated_at:new Date().toISOString()}).eq('id',id);if(error)return notify(errText(error));await recordAdminActivity(patch.payment_status==='paid'?'marked_guest_pass_paid':'updated_guest_pass','guest_pass_request',id,patch);notify('Guest pass updated.');refreshAdmin()}
  const mediaSlots=[['hero_image_url','Homepage Hero'],['gallery_image_1_url','Gallery Photo 1'],['gallery_image_2_url','Gallery Photo 2'],['gallery_image_3_url','Gallery Photo 3'],['pool_image_url','Pool Photo'],['clubhouse_image_url','Clubhouse Photo'],['crest_image_url','Website Crest']];
  const groups=[
    {id:'overview',label:'Overview',icon:BarChart3,panels:[['overview','Overview']]},
    {id:'members',label:'Members',icon:Users,panels:[['members','Members'],['exports','Directory & cards'],['contacts','Private contacts'],['directory','Directory visibility']]},
    {id:'team',label:'Staff & finances',icon:Users,panels:[['timesheets','Hours, tips & payroll'],['timerequests','Time correction requests'],['expenses','Expense receipts'],['roles','Account roles'],['staff','Staff permissions']]},
    {id:'renters',label:'Renters',icon:CreditCard,panels:[['stays','Stay approvals'],['renters','Renter passes'],['reminders','Arrival reminders']]},
    {id:'events',label:'Events & Golf',icon:CalendarDays,panels:[['events','Events'],['rsvps','RSVPs & payments'],['eventreminders','Reminder deliveries'],['tournaments','Tournaments'],['scores','Score approvals']]},
    {id:'communications',label:'Communications',icon:Megaphone,panels:[['announcements','Announcements']]},
    {id:'operations',label:'Operations',icon:ClipboardList,panels:[['operations','Daily operations'],['search','Club search'],['lookup','Find a pass'],['guests','Member guest passes'],['allpasses','All passes'],['corrections','Corrections'],['notes','Shift notes'],['club','Club controls'],['help','Staff help']]},
    {id:'records',label:'Records',icon:UserCheck,panels:[['signinhistory','Sign-in history'],['activity','Activity history'],['summaries','Attendance summaries'],['reports','Daily reports']]},
    {id:'settings',label:'Club Settings',icon:Settings,panels:[['images','Images & gallery'],['tv','TV display'],['categories','Pass pricing & links']]}
  ];
  const currentGroup=groups.find(group=>group.panels.some(([id])=>id===panel))||groups[0];
  const filteredPending=pending.filter(m=>matchesSearch(m,memberSearch)&&(memberLevel==='all'||m.membership_level===memberLevel));
  const filteredMembers=adminMembers.filter(m=>matchesSearch(m,memberSearch)&&(memberLevel==='all'||m.membership_level===memberLevel)&&(standingFilter==='all'||(standingFilter==='good'?m.good_standing!==false:m.good_standing===false)));
  const pendingPasses=guestPasses.filter(g=>passBucket(g)==='pending');
  const paymentCount=pendingPasses.filter(g=>g.payment_status!=='paid').length;
  const activationCount=pendingPasses.filter(g=>g.payment_status==='paid').length;
  const rsvpPaymentCount=eventRsvps.filter(r=>r.status==='going'&&r.payment_status!=='paid'&&!['refunded','cancelled'].includes(r.payment_status)&&events.some(e=>e.id===r.event_id&&e.event_date>=clubDate())).length;
  function openPassQueue(queue){setPassView('pending');setPassQueue(queue);setPanel('allpasses');}
  const tasks=[
    {label:'Member approvals',count:pending.length,note:'Review new member accounts',icon:Users,open:()=>{setMemberView('pending');setMemberSearch('');setMemberLevel('all');setPanel('members');}},
    {label:'Renter stay approvals',count:pendingStayCount,note:'Verify bookings and owner units',icon:ShieldCheck,open:()=>setPanel('stays')},
    {label:'Pass payments',count:paymentCount,note:'Confirm payment before activation',icon:CreditCard,open:()=>openPassQueue('payment')},
    {label:'Passes to activate',count:activationCount,note:'Paid requests awaiting activation',icon:QrCode,open:()=>openPassQueue('activation')},
    {label:'RSVP payments',count:rsvpPaymentCount,note:'Upcoming event payments to review',icon:CalendarDays,open:()=>{setRsvpView('pending');setPanel('rsvps');}},
    {label:'Score approvals',count:pendingScores.length,note:'Review submitted tournament scores',icon:Trophy,open:()=>setPanel('scores')}
  ];
  if(staffMode)return <section className="admin-workspace"><div className="section-title admin-workspace-heading"><div><small>Staff tools</small><h3>Daily Operations</h3><p className="muted">Scan guest QR passes and review sign-in records.</p></div></div><StaffOperations/></section>;
  return <section className="admin-workspace">
    <div className="section-title admin-workspace-heading"><div><small>Administrator tools</small><h3>Club Administration</h3><small>Updates automatically</small><p className="muted">A clear view of your club, your team, and the day ahead.</p></div><button className="small secondary" disabled={adminLoading} onClick={refreshAdmin}>{adminLoading?'Refreshing…':'Refresh dashboard'}</button></div>
    <WorkspaceNavigation groups={groups} value={panel} onChange={setPanel} label="Admin tools"/>
    {adminError&&<div className="card admin-load-error" role="alert"><b>Dashboard data could not refresh.</b><p>{adminError}</p><button className="small secondary" onClick={refreshAdmin}>Try again</button></div>}

    {panel==='operations'&&<><ScanStation/><AttendanceDashboard notify={notify}/></>} 
    {panel==='signinhistory'&&<AttendanceDashboard history notify={notify}/>} 
    {panel==='scanner'&&<ScanStation/>} 
    {panel==='staff'&&<AdminStaffManagement members={members} notify={notify}/>} 
    {panel==='activity'&&<OperationsAudit/>}
    {panel==='reports'&&<DailyReportSettings notify={notify}/>}
    {panel==='expenses'&&<StaffExpenses admin/>}{panel==='timerequests'&&<TimeCorrectionRequests admin/>}{panel==='eventreminders'&&<EventReminderLog/>}{panel==='search'&&<ClubSearch/>}{panel==='timesheets'&&<><LongShiftAlerts/><WeeklyReports/><Timesheets admin/></>}{panel==='roles'&&<AdminRoles members={members} onChanged={reload}/>}{panel==='exports'&&<MemberExports members={members}/>}{panel==='contacts'&&<AdminPrivateContacts/>}{panel==='directory'&&<DirectorySettings/>}{panel==='notes'&&<ShiftNotes/>}{panel==='lookup'&&<StaffLookup/>}{panel==='corrections'&&<CheckInCorrections/>}{panel==='summaries'&&<AttendanceSummaries/>}{panel==='reminders'&&<RenterReminderSettings/>}{panel==='help'&&<StaffHelp/>}

    {panel==='overview'&&(()=>{
      const today=new Date(`${clubDate()}T12:00:00`);
      const upcoming=events.filter(e=>e.event_date&&e.event_date>=clubDate()).length;
      return <div className="admin-overview"><LongShiftAlerts/>
        <div className="admin-section-heading"><div><small>Start here</small><h3>Needs attention</h3></div><span className="muted">{adminLoading?'Updating counts…':adminError?'Counts unavailable':`${tasks.reduce((n,t)=>n+(t.count||0),0)} items to review`}</span></div>
        <div className="admin-task-grid">{tasks.map(task=>{const Icon=task.icon;return <button className="admin-task" key={task.label} onClick={task.open}><div><Icon size={21}/><ChevronRight size={17}/></div><strong>{adminLoading?'…':adminError?'—':task.count??'—'}</strong><b>{task.label}</b><small>{task.note}</small></button>})}</div>
        <div className="admin-summary-strip"><span><b>{adminMembers.length}</b> active members</span><span><b>{upcoming}</b> upcoming events</span><span><b>{guestPasses.filter(g=>passBucket(g)==='active').length}</b> active passes</span></div>
        <div className="grid two admin-overview-lower">
          <div className="card"><div className="admin-card-title"><Sparkles/><div><small>Quick actions</small><h3>Run LINDEX</h3></div></div><div className="admin-quick-actions"><button onClick={()=>setPanel('events')}><CalendarDays/><span><b>Create Event</b><small>Publish or edit club events</small></span><ChevronRight/></button><button onClick={()=>setPanel('announcements')}><Megaphone/><span><b>Send Announcement</b><small>Post an update + phone push</small></span><ChevronRight/></button><button onClick={()=>setPanel('tv')}><MonitorPlay/><span><b>Update TV Mode</b><small>Control clubhouse display</small></span><ChevronRight/></button><button onClick={()=>setPanel('images')}><ImageIcon/><span><b>Add Photos</b><small>Website and gallery images</small></span><ChevronRight/></button></div></div>
          <div className="card"><div className="admin-card-title"><Users/><div><small>Newest accounts</small><h3>Recent Members</h3></div></div><div className="recent-member-list">{recentMembers.map(m=><div key={m.id}><div className={`member-avatar ${m.avatar_url?'has-photo':''}`}>{m.avatar_url?<img src={m.avatar_url} alt={m.full_name||'Member'}/>:((m.full_name||m.email||'M').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase())}</div><span><b>{m.full_name||m.email}</b><small>{m.membership_status||'pending'} • {m.created_at?new Date(m.created_at).toLocaleDateString():'—'}</small></span></div>)}</div></div>
        </div>
      </div>
    })()}

    {panel==='club'&&<div className="admin-panel-grid">
      <div className="card admin-control-card"><div className="admin-card-title"><Flag/><div><small>Course</small><h3>Course Status</h3></div></div><div className="form-stack"><select value={settings.course_status} onChange={e=>setSettings({...settings,course_status:e.target.value})}><option>Open</option><option>Frost Delay</option><option>Cart Path Only</option><option>Walking Only</option><option>Closed</option></select><input value={settings.course_status_note||''} onChange={e=>setSettings({...settings,course_status_note:e.target.value})} placeholder="Status note"/></div></div>
      <div className="card admin-control-card"><div className="admin-card-title"><Utensils/><div><small>Clubhouse</small><h3>Daily Special</h3></div></div><div className="form-stack"><input value={settings.daily_special||''} onChange={e=>setSettings({...settings,daily_special:e.target.value})} placeholder="Example: Chicken Caesar Wrap — $12"/><input value={settings.daily_special_note||''} onChange={e=>setSettings({...settings,daily_special_note:e.target.value})} placeholder="Optional note"/></div></div>
      <div className="card admin-control-card"><div className="admin-card-title"><Users/><div><small>Pool</small><h3>Pool Status</h3></div></div><select value={settings.pool_status||'Open'} onChange={e=>setSettings({...settings,pool_status:e.target.value})}><option>Open</option><option>Closed</option><option>Closed for weather</option><option>Closed for maintenance</option></select></div>
      <div className="card admin-control-card"><h3>Clubhouse Status</h3><select value={settings.clubhouse_status||'Not set'} onChange={e=>setSettings({...settings,clubhouse_status:e.target.value})}><option>Not set</option><option>Open</option><option>Closed</option><option>Private event</option></select></div>
      <div className="card admin-control-card full"><div className="admin-card-title"><CalendarDays/><div><small>Homepage</small><h3>Featured Event</h3></div></div><select value={settings.featured_event_id||''} onChange={e=>setSettings({...settings,featured_event_id:e.target.value})}><option value="">Automatically show next event</option>{events.map(e=><option key={e.id} value={e.id}>{e.title} — {fmtDate(e.event_date)}</option>)}</select></div>
      <div className="card admin-control-card full"><div className="admin-card-title"><Clock3/><div><small>Weekly schedule</small><h3>Clubhouse Hours</h3></div></div><div className="hours-editor">{[['Monday','monday_hours'],['Tuesday','tuesday_hours'],['Wednesday','wednesday_hours'],['Thursday','thursday_hours'],['Friday','friday_hours'],['Saturday','saturday_hours'],['Sunday','sunday_hours']].map(([label,key])=><label key={key}><span>{label}</span><input value={settings[key]||''} onChange={e=>setSettings({...settings,[key]:e.target.value})} placeholder="Example: 2:00 PM – Close"/></label>)}</div><label className="hours-note">Optional schedule note<textarea value={settings.hours_note||''} onChange={e=>setSettings({...settings,hours_note:e.target.value})} placeholder="Hours may change due to weather or private events."/></label></div>
      <div className="admin-save-bar"><button className="primary" onClick={saveSettings}><Settings size={17}/>Save Club Controls</button></div>
    </div>}

    {panel==='images'&&<div className="media-manager">
      <div className="card media-intro"><ImageIcon/><div><h3>Website Images Manager</h3><p>Upload a replacement image and the website updates immediately. JPG, PNG, and WebP are supported.</p></div></div>
      <div className="media-slot-grid">{mediaSlots.map(([key,label])=>{const current=settings[key]||({hero_image_url:'/assets/image-1.jpg',gallery_image_1_url:'/assets/course-aerial-1.png',gallery_image_2_url:'/assets/pool.jpg',gallery_image_3_url:'/assets/course-aerial-2.jpg',pool_image_url:'/assets/pool.jpg',clubhouse_image_url:'/assets/image-2.png',crest_image_url:'/assets/linderhof-crest.png'}[key]);return <article className="card media-slot" key={key}><div className="media-preview"><img src={mediaFiles[key]?URL.createObjectURL(mediaFiles[key]):current} alt={label}/></div><div><small>Website image</small><h3>{label}</h3></div><label className="media-file-button"><ImageIcon size={17}/><span>{mediaFiles[key]?.name||'Choose New Image'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>{const chosen=e.target.files?.[0]||null;setMediaFiles(prev=>({...prev,[key]:chosen}))}}/></label><button type="button" className="primary full" disabled={!mediaFiles[key]||uploadingMedia===key} onClick={()=>uploadWebsiteImage(key,label)}>{uploadingMedia===key?'Uploading…':mediaFiles[key]?'Upload & Use Image':'Choose an Image First'}</button></article>})}</div>
      <div className="card admin-control-card full gallery-manager"><div className="admin-card-title"><Camera/><div><small>Expandable gallery</small><h3>Add More Gallery Photos</h3></div></div><p className="muted">Add as many photos as you want. These appear in the public gallery and rotate through TV Mode.</p><div className="gallery-upload-row"><label className="media-file-button"><ImageIcon size={17}/><span>{galleryFile?.name||'Choose Gallery Image'}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>setGalleryFile(e.target.files?.[0]||null)}/></label><input placeholder="Optional caption" value={galleryCaption} onChange={e=>setGalleryCaption(e.target.value)}/><button className="primary" disabled={!galleryFile||galleryUploading} onClick={addGalleryImage}>{galleryUploading?'Uploading…':'Add to Gallery'}</button></div>{galleryImages.length>0&&<div className="gallery-admin-grid">{galleryImages.map(item=><article key={item.id}><img src={item.image_url} alt={item.caption||'Gallery photo'}/><div><span>{item.caption||'Gallery photo'}</span><button className="small danger" onClick={()=>deleteGalleryImage(item)}>Remove</button></div></article>)}</div>}</div>
    </div>}


    {panel==='tv'&&<div className="admin-panel-grid">
      <div className="card admin-control-card full"><div className="admin-card-title"><MonitorPlay/><div><small>Clubhouse display</small><h3>TV Mode</h3></div></div><p className="muted">Open the dedicated full-screen display on any clubhouse TV. It automatically rotates through live club information.</p><div className="tv-admin-actions"><button className="primary" onClick={()=>window.open(`${PUBLIC_SITE_URL}/tv`,'_blank')}><MonitorPlay size={17}/>Preview TV Mode</button><button className="secondary" onClick={()=>navigator.clipboard?.writeText(`${PUBLIC_SITE_URL}/tv`)}>Copy TV Link</button></div></div>
      <div className="card admin-control-card"><div className="admin-card-title"><Clock3/><div><small>Rotation</small><h3>Slide Timing</h3></div></div><label>Seconds per slide<input type="number" min="8" max="60" value={settings.tv_slide_seconds||18} onChange={e=>setSettings({...settings,tv_slide_seconds:Number(e.target.value)})}/></label></div>
      <div className="card admin-control-card"><div className="admin-card-title"><Megaphone/><div><small>Welcome slide</small><h3>Custom Message</h3></div></div><textarea value={settings.tv_custom_message||''} onChange={e=>setSettings({...settings,tv_custom_message:e.target.value})} placeholder="Welcome to Linderhof Country Club"/></div>
      <div className="card admin-control-card full"><div className="admin-card-title"><Settings/><div><small>Slides</small><h3>Choose What Appears</h3></div></div><div className="tv-toggle-grid">{[['tv_show_status','Weather & Club Status'],['tv_show_special','Today’s Special'],['tv_show_events','Upcoming Events'],['tv_show_announcements','Announcements'],['tv_show_photos','Around the Club Photos'],['tv_show_members','Member Spotlight']].map(([key,label])=><label className="tv-toggle" key={key}><input type="checkbox" checked={settings[key]!==false} onChange={e=>saveTvToggle(key,e.target.checked)}/><span>{label}</span></label>)}</div></div>
      <div className="card admin-control-card full tv-member-admin"><div className="admin-card-title"><Users/><div><small>Member Spotlight</small><h3>Members on TV</h3></div></div><p className="muted">Choose members to feature on the clubhouse TV. Their profile photo, name, division, Club Index, and an optional note can be shown.</p><div className="tv-member-form"><select value={tvMemberId} onChange={e=>setTvMemberId(e.target.value)}><option value="">Choose a member…</option>{members.filter(m=>!tvMembers.some(x=>x.profile_id===m.id)).map(m=><option key={m.id} value={m.id}>{m.full_name||'Member'}</option>)}</select><input placeholder="Optional note — e.g. Member Spotlight, Club Champion" value={tvMemberSubtitle} onChange={e=>setTvMemberSubtitle(e.target.value)}/><button className="primary" onClick={addTvMember} disabled={!tvMemberId}>Add to TV</button></div>{tvMembers.length>0&&<div className="tv-member-admin-list">{tvMembers.map(m=><article key={m.id}>{m.photo_url?<img src={m.photo_url} alt={m.display_name}/>:<div className="member-avatar">{(m.display_name||'L').split(/\s+/).map(x=>x[0]).slice(0,2).join('').toUpperCase()}</div>}<div><b>{m.display_name}</b><small>{m.division||'Member'}{m.club_index!=null?` • Club Index ${m.club_index}`:''}</small>{m.subtitle&&<span>{m.subtitle}</span>}</div><button className="small danger" onClick={()=>removeTvMember(m.id)}>Remove</button></article>)}</div>}</div>
      <div className="admin-save-bar"><button className="primary" onClick={saveSettings}><Settings size={17}/>Save TV Settings</button></div>
    </div>}

    {panel==='events'&&<div className="grid two"><div className="card"><div className="admin-form-heading"><div><small>{editingEventId?'Editing existing event':'Create something new'}</small><h3>{editingEventId?'Edit Event':'Publish Event'}</h3></div>{editingEventId&&<button className="small secondary" onClick={cancelEditEvent}><X size={14}/>Cancel</button>}</div><div className="form-stack"><input placeholder="Event name" value={event.title} onChange={e=>setEvent({...event,title:e.target.value})}/><div className="form-row"><input type="date" value={event.event_date} onChange={e=>setEvent({...event,event_date:e.target.value})}/><Time12 label="Event time (NH)" value={event.event_time} onChange={value=>setEvent({...event,event_time:value})}/></div><div className="form-row"><select value={event.event_type} onChange={e=>setEvent({...event,event_type:e.target.value})}><option>Club Event</option><option>Golf Event</option><option>Tournament</option><option>Dinner</option><option>Social</option></select><input placeholder="Price" value={event.price} onChange={e=>setEvent({...event,price:e.target.value})}/></div><label>Capacity (people; blank for unlimited)<input type="number" min="1" step="1" value={event.capacity} onChange={e=>setEvent({...event,capacity:e.target.value})}/></label><NHDateTime label="RSVP deadline" value={event.rsvp_deadline} onChange={value=>setEvent({...event,rsvp_deadline:value})}/><input placeholder="Event location" value={event.location} onChange={e=>setEvent({...event,location:e.target.value})}/><label className="report-checkbox"><input type="checkbox" checked={event.reminders_enabled} onChange={e=>setEvent({...event,reminders_enabled:e.target.checked})}/>Email registered attendees the day before (9:00 AM NH)</label><input placeholder="Eligibility" value={event.audience} onChange={e=>setEvent({...event,audience:e.target.value})}/><input placeholder="Square payment link" value={event.square_url} onChange={e=>setEvent({...event,square_url:e.target.value})}/><textarea placeholder="Details" value={event.description} onChange={e=>setEvent({...event,description:e.target.value})}/><label>Event Image<input type="file" accept="image/*" onChange={e=>setFile(e.target.files[0])}/></label><label className="push-toggle"><input type="checkbox" checked={eventPush} onChange={e=>setEventPush(e.target.checked)}/><span><Bell size={17}/><b>{editingEventId?'Send update notification':'Notify members on their phones'}</b><small>Only members who enabled LINDEX notifications will receive it.</small></span></label><button className="primary" onClick={saveEvent}>{editingEventId?<Save size={16}/>:<Plus size={16}/>} {editingEventId?'Save Event Changes':'Publish Event'}</button></div></div><div className="card"><h3>Published Events</h3>{events.length?events.map(e=><div className="admin-row editable-row" key={e.id}><span><b>{e.title}</b><small>{fmtDate(e.event_date)}{e.event_time?` • ${fmtTime(e.event_time)}`:''}</small></span><div className="admin-row-actions"><button className={`small ${e.tv_visible===false?'secondary':'primary'}`} onClick={()=>toggleEventTV(e)}><MonitorPlay size={14}/>{e.tv_visible===false?'Show on TV':'On TV ✓'}</button><button className="small secondary" onClick={()=>startEditEvent(e)}><Pencil size={14}/>Edit</button><button className="small danger" onClick={()=>remove('events',e.id)}>Delete</button></div></div>):<p className="muted">No events published.</p>}</div></div>}

    {panel==='rsvps'&&<div className="section admin-event-attendance-section"><div className="admin-filter-tabs" aria-label="RSVP status">{[['pending','Payment pending'],['all','Upcoming / current'],['history','History']].map(([id,label])=><button key={id} className={rsvpView===id?'active':''} aria-pressed={rsvpView===id} onClick={()=>setRsvpView(id)}>{label}</button>)}</div>{(()=>{
      const scopedRsvps=eventRsvps.filter(r=>{const date=events.find(e=>e.id===r.event_id)?.event_date;const past=date&&date<clubDate();return rsvpView==='history'?past:rsvpView==='pending'?!past&&r.status==='going'&&r.payment_status!=='paid'&&!['refunded','cancelled'].includes(r.payment_status):!past;});
      const going=scopedRsvps.filter(r=>r.status==='going');
      const combined=going.reduce((sum,r)=>sum+Number(r.attendee_count||1),0);
      const groups=events.map(e=>({event:e,rows:scopedRsvps.filter(r=>r.event_id===e.id)})).filter(g=>g.rows.length).sort((a,b)=>String(a.event.event_date||'').localeCompare(String(b.event.event_date||'')));
      return <><div className="admin-attendance-summary"><article><Users/><small>CURRENT FILTER</small><strong>{combined}</strong><span>Attendees in this view</span></article><article><CalendarDays/><small>EVENTS WITH RSVPS</small><strong>{groups.length}</strong><span>Each event is tallied separately below</span></article></div>{groups.length?<div className="event-rsvp-groups">{groups.map(({event:e,rows})=>{const attendees=rows.filter(r=>r.status==='going');const total=attendees.reduce((sum,r)=>sum+Number(r.attendee_count||1),0);const paid=attendees.filter(r=>r.payment_status==='paid').reduce((sum,r)=>sum+Number(r.attendee_count||1),0);return <div className="card event-rsvp-group" key={e.id}><div className="event-rsvp-group-head"><div><small>{fmtDate(e.event_date)}{e.event_time?` • ${fmtTime(e.event_time)}`:''}</small><h3>{e.title}</h3></div><div className="event-total-badges"><span><b>{total}</b> attending</span><span><b>{paid}</b> paid</span><span><b>{rows.length}</b> RSVPs</span></div></div><div className="admin-rsvp-list">{rows.map(r=><div className="admin-row" key={r.id}><span><b>{r.profiles?.full_name||r.profiles?.email||'Member'}</b><small>{r.status==='going'?`${r.attendee_count} attending`:'Not going'}{r.meal_choice?` • ${r.meal_choice}`:''}{r.notes?` • ${r.notes}`:''}</small></span><div className="admin-row-actions">{r.status==='going'&&<button className={`small ${r.payment_status==='paid'?'secondary':'primary'}`} onClick={()=>markRsvpPaid(r.id,r.payment_status!=='paid')}>{r.payment_status==='paid'?'Paid ✓':'Mark Paid'}</button>}<button className="small danger" onClick={()=>deleteRsvp(r.id)}>Remove</button></div></div>)}</div></div>})}</div>:<div className="card"><p className="muted">No RSVPs match this view.</p></div>}</>;
    })()}</div>}


    {panel==='categories'&&<div className="card"><div className="admin-card-title"><Settings/><div><small>Category pricing + Square checkout</small><h3>Guest Pass Categories</h3></div></div><p className="muted">Set pricing, checkout links, and duration. Use 1 day for golf or one-day pool access; use 3 or 7 days for renter pool passes.</p><div className="guest-category-admin">{guestCategories.map(c=><div className="guest-category-row" key={c.id}><input value={c.name||''} onChange={e=>setGuestCategories(list=>list.map(x=>x.id===c.id?{...x,name:e.target.value}:x))} placeholder="Category name"/><input value={c.price_label||''} onChange={e=>setGuestCategories(list=>list.map(x=>x.id===c.id?{...x,price_label:e.target.value}:x))} placeholder="$0"/><select value={c.duration_days||1} onChange={e=>setGuestCategories(list=>list.map(x=>x.id===c.id?{...x,duration_days:Number(e.target.value)}:x))}><option value="1">1 day</option><option value="3">3 days</option><option value="7">7 days</option></select><input value={c.square_url||''} onChange={e=>setGuestCategories(list=>list.map(x=>x.id===c.id?{...x,square_url:e.target.value}:x))} placeholder="https://square.link/..."/><label className="inline-check"><input type="checkbox" checked={c.active!==false} onChange={e=>setGuestCategories(list=>list.map(x=>x.id===c.id?{...x,active:e.target.checked}:x))}/>Active</label><button className="small primary" onClick={()=>saveGuestCategory(c)}>Save</button></div>)}<button className="secondary" onClick={addGuestCategory}><Plus size={15}/>Add Category</button></div></div>}
    {(panel==='guests'||panel==='renters'||panel==='allpasses')&&<AdminPassList
      key={panel} kind={panel==='guests'?'member':panel==='renters'?'renter':'all'} passes={guestPasses}
      view={passView} setView={setPassView} queue={passQueue} setQueue={setPassQueue}
      loading={adminLoading} error={adminError} updatePass={updateGuestPass}
      activateAndEmail={activateAndEmailGuestPass} emailPass={emailGuestPass} removePass={id=>remove('guest_pass_requests',id)}/>} 
    {panel==='stays'&&<AdminRenterApprovals notify={notify} onChanged={refreshAdmin}/>}
    {panel==='announcements'&&<div className="grid two"><div className="card"><div className="admin-form-heading"><div><small>{editingAnnouncementId?'Editing announcement':'Club communications'}</small><h3>{editingAnnouncementId?'Edit Announcement':'Publish Announcement'}</h3></div>{editingAnnouncementId&&<button className="small secondary" onClick={cancelEditAnnouncement}><X size={14}/>Cancel</button>}</div><div className="form-stack"><input placeholder="Title" value={announcement.title} onChange={e=>setAnnouncement({...announcement,title:e.target.value})}/><textarea placeholder="Message" value={announcement.message} onChange={e=>setAnnouncement({...announcement,message:e.target.value})}/><label className="push-toggle"><input type="checkbox" checked={announcementPush} onChange={e=>setAnnouncementPush(e.target.checked)}/><span><Bell size={17}/><b>{editingAnnouncementId?'Send update notification':'Send to members’ phones'}</b><small>Push is sent only to subscribed members.</small></span></label><button className="primary" onClick={saveAnnouncement}>{editingAnnouncementId?<Save size={16}/>:<Send size={16}/>} {editingAnnouncementId?'Save Announcement':'Publish Announcement'}</button></div></div><div className="card"><h3>Published Announcements</h3>{announcements.length?announcements.map(a=><div className="admin-row editable-row" key={a.id}><span><b>{a.title}</b><small>{a.message}</small></span><div className="admin-row-actions"><button className="small secondary" onClick={()=>startEditAnnouncement(a)}><Pencil size={14}/>Edit</button><button className="small danger" onClick={()=>remove('announcements',a.id)}>Delete</button></div></div>):<p className="muted">No announcements published.</p>}</div></div>}

    {panel==='tournaments'&&<div className="grid two"><div className="card"><h3>Create Tournament</h3><div className="form-stack"><input placeholder="Tournament name" value={tournament.name} onChange={e=>setTournament({...tournament,name:e.target.value})}/><input type="date" value={tournament.tournament_date} onChange={e=>setTournament({...tournament,tournament_date:e.target.value})}/><textarea placeholder="Description" value={tournament.description} onChange={e=>setTournament({...tournament,description:e.target.value})}/><button className="primary" onClick={createTournament}>Create Tournament</button></div></div><div className="card"><h3>Tournaments</h3>{tournaments.length?tournaments.map(t=><div className="admin-row" key={t.id}><span><b>{t.name}</b><small>{fmtDate(t.tournament_date)}</small></span><button className="small danger" onClick={()=>remove('tournaments',t.id)}>Delete</button></div>):<p className="muted">No tournaments.</p>}</div></div>}

    {panel==='scores'&&<div className="card"><h3>Pending Tournament Scores</h3>{pendingScores.length?pendingScores.map(s=><div className="admin-row" key={s.id}><span><b>{s.player_name}</b><small>Gross {s.gross_score} • Net {s.net_score}</small></span><button className="small primary" onClick={()=>approveScore(s.id)}>Approve</button></div>):<p className="muted">No pending scores.</p>}</div>}
    {panel==='members'&&<><div className="admin-filter-tabs" aria-label="Member lists">{[['pending','Pending approvals'],['active','Active members']].map(([id,label])=><button key={id} aria-pressed={memberView===id} className={memberView===id?'active':''} onClick={()=>setMemberView(id)}>{label} <span>{id==='pending'?pending.length:adminMembers.length}</span></button>)}</div><div className="admin-toolbar"><label>Search members<input type="search" value={memberSearch} onChange={e=>setMemberSearch(e.target.value)} placeholder="Name, email, or owner unit"/></label><label>Membership<select value={memberLevel} onChange={e=>setMemberLevel(e.target.value)}><option value="all">All memberships</option><option value="full_golf">Full Golf</option><option value="owner">Owner</option><option value="social">Social</option></select></label>{memberView==='active'&&<label>Standing<select value={standingFilter} onChange={e=>setStandingFilter(e.target.value)}><option value="all">Any standing</option><option value="good">Good standing</option><option value="notgood">Not in good standing</option></select></label>}</div>{memberView==='pending'&&<div><div className="card"><h3>Pending Members</h3><p className="muted">Choose the membership level before approving each account.</p>{filteredPending.length?filteredPending.map(p=><PendingMemberRow key={p.id} member={p} approve={approve}/>):<p className="muted">No pending members match these filters.</p>}</div></div>}{memberView==='active'&&<div className="card section"><h3>Active Member Categories & Handicaps</h3><p className="muted">Full Golf and Owner members can access Tournaments and My Scorecard. Social members do not have golf-feature access. For Owner members, enter building and unit information directly below their membership category.</p>{ownerUnitLoadError&&<p className="form-error">Unit information could not load: {ownerUnitLoadError}. Check that the v18.15 Supabase migration has been run.</p>}<div className="admin-member-list">{filteredMembers.map(m=>{const owner=ownerProfiles.find(o=>o.id===m.id);const d=ownerUnitDrafts[m.id]||{unit_building:'',unit_number:''};return <div className="member-with-unit" key={m.id}><MemberAccessRow member={m} saveHandicap={updateMemberHandicap} saveLevel={updateMembershipLevel} saveStanding={updateGoodStanding}/>{m.membership_level==='owner'&&<div className="inline-owner-unit"><div className="inline-owner-unit-title"><b>Condo Unit Information</b><small>Shown on this Owner member’s digital membership card</small></div><label>Building (optional)<input maxLength={100} value={d.unit_building} onChange={e=>setOwnerUnitDrafts(v=>({...v,[m.id]:{...d,unit_building:e.target.value}}))} placeholder="Building or property"/></label><label>Unit number<input maxLength={100} value={d.unit_number} onChange={e=>setOwnerUnitDrafts(v=>({...v,[m.id]:{...d,unit_number:e.target.value}}))} placeholder="e.g. 18B"/></label><button className="small primary" disabled={savingOwnerId===m.id||!owner} onClick={()=>saveAdminOwnerUnit(m)}>{savingOwnerId===m.id?'Saving…':'Save Unit'}</button>{!owner&&<small className="form-error">Unit editor loading. If this persists, refresh the page or check the database setup.</small>}</div>}</div>})}{!filteredMembers.length&&<p className="muted">No active members match these filters.</p>}</div></div>}</>}
  </section>
}
function PendingMemberRow({member,approve}){const [level,setLevel]=useState(member.membership_level||'full_golf');return <div className="admin-member-row access-row"><div><b>{member.full_name||member.email||'Member'}</b><small>{member.email}</small></div><select value={level} onChange={e=>setLevel(e.target.value)}><option value="full_golf">Full Golf</option><option value="social">Social</option><option value="owner">Owner</option></select><button className="small primary" onClick={()=>approve(member.id,level)}>Approve</button></div>}
function MemberAccessRow({member,saveHandicap,saveLevel,saveStanding}){const [value,setValue]=useState(String(member.handicap_index??''));const [level,setLevel]=useState(member.membership_level||'full_golf');useEffect(()=>{setValue(String(member.handicap_index??''));setLevel(member.membership_level||'full_golf')},[member.handicap_index,member.membership_level]);return <div className="admin-member-row access-row"><div><b>{member.full_name||'Member'}</b><small>{member.division||'Member'} • {membershipLevelLabel(level)}</small><label className="inline-check"><input type="checkbox" checked={member.good_standing!==false} onChange={e=>saveStanding(member.id,e.target.checked)}/>Good standing</label></div><select value={level} onChange={e=>{setLevel(e.target.value);saveLevel(member.id,e.target.value)}}><option value="full_golf">Full Golf</option><option value="social">Social</option><option value="owner">Owner</option></select>{['full_golf','owner'].includes(level)?<><input aria-label={`Handicap for ${member.full_name||'member'}`} type="number" step="0.1" min="-10" max="54" value={value} onChange={e=>setValue(e.target.value)}/><button className="small primary" onClick={()=>saveHandicap(member.id,value)}>Save Index</button></>:<span className="social-access-note">Golf access off</span>}</div>}
function AccessRestricted({title}){return <section><div className="section-title"><div><small>Golf or Owner membership required</small><h3>{title}</h3></div></div><div className="card directory-gate"><ShieldCheck/><div><h3>Full Golf and Owner members only</h3><p>This feature is available to Full Golf and Owner members only. Social members and Owners can continue using their other LINDEX features.</p></div></div></section>}
function LegalPage({title,effectiveDate='September 14, 2026',children}){return <main className="legal-page"><div className="legal-shell"><header className="legal-brand"><img src="/assets/lindex-app-icon.png" alt="LINDEX"/><div><b>LINDEX</b><span>Linderhof Country Club</span></div></header><article className="legal-card"><small>PUBLIC LEGAL INFORMATION</small><h1>{title}</h1><p className="legal-effective">Effective date: {effectiveDate}</p>{children}<hr/><p className="legal-contact"><b>Contact</b><br/>Linderhof Country Club<br/>10 Clubhouse Rd, Glen, NH 03838<br/>Questions about LINDEX may be directed to the Club.</p></article><footer>LINDEX • Your Digital Clubhouse</footer></div></main>}
function PrivacyPolicy(){return <LegalPage title="Privacy Policy"><p>LINDEX is the digital member platform for Linderhof Country Club. This Privacy Policy explains the types of information used by LINDEX and how that information is handled when members, renters, guests, and administrators use the service.</p><h2>Information We Collect</h2><p>Depending on the features you use, LINDEX may process account and profile information such as your name, email address, membership status and membership category; member-directory information and profile photos you choose to provide; golf scores and related playing information; event RSVPs and attendance information; guest-pass information including guest name, visit date, unit number, owner/member name and purchaser email; and technical information reasonably necessary to operate and secure the service.</p><h2>How Information Is Used</h2><p>Information is used to authenticate users, administer Club membership access, provide member-directory and golf features, manage events and RSVPs, issue and verify guest passes, deliver Club communications and notifications, maintain and secure LINDEX, troubleshoot problems, and support Club operations.</p><h2>Service Providers</h2><p>LINDEX relies on third-party service providers to operate certain features. These may include Supabase for database and authentication services, Vercel for hosting, Square for payment checkout, Resend for transactional email, OneSignal for notifications, GitHub for development infrastructure, and domain or network providers. These providers may process information as necessary to provide their respective services and are subject to their own terms and privacy practices.</p><h2>Payments</h2><p>Payment transactions are directed to the Club's approved external payment processor. LINDEX is not intended to store full payment-card credentials. Payment information submitted on an external checkout page is handled by that payment provider.</p><h2>Member Directory and Club Features</h2><p>Certain profile information may be visible to other authorized LINDEX members through Club features such as the Member Directory. Available privacy controls may allow members to limit certain profile information. Users should avoid entering sensitive information that is not necessary for a Club feature.</p><h2>Notifications and Email</h2><p>LINDEX may send transactional emails, guest-pass emails, Club announcements, or push notifications. Device or browser settings may provide additional controls for push notifications.</p><h2>Data Security</h2><p>Reasonable technical and administrative measures are used to protect LINDEX, including authentication, role-based permissions and database access controls where applicable. No internet-connected service can guarantee absolute security.</p><h2>Data Retention and Account Requests</h2><p>Information may be retained for as long as reasonably necessary for Club operations, recordkeeping, security, legal obligations, and the purposes described in this policy. Members may contact Linderhof Country Club regarding questions about their LINDEX account or information.</p><h2>Children</h2><p>LINDEX is intended for the Linderhof Country Club community and is not designed as a service directed to children under 13.</p><h2>Changes to This Policy</h2><p>This Privacy Policy may be updated as LINDEX features, Club practices, or applicable requirements change. The current version will be posted on this page.</p></LegalPage>}
function TermsOfUse(){return <LegalPage title="Terms of Use"><p>These Terms of Use govern access to and use of LINDEX, the digital member platform provided for Linderhof Country Club. By accessing or using LINDEX, you agree to use the platform in accordance with these Terms and applicable Club rules.</p><h2>1. Purpose of LINDEX</h2><p>LINDEX provides digital services for Linderhof Country Club members and, for certain features, renters and guests. Features may include membership information, digital membership features, Member Directory access, announcements, events and RSVPs, golf information, tournaments, scorecards, guest passes, QR verification, notifications and other Club services.</p><h2>2. Member Accounts</h2><p>Users are responsible for maintaining the confidentiality of their login credentials. Accounts are intended for the individual to whom they are issued and should not be shared with unauthorized persons. The Club may suspend or restrict access when reasonably necessary to protect the Club, its members, or LINDEX.</p><h2>3. Membership Privileges</h2><p>Access to LINDEX does not independently establish Club membership or privileges. Membership status and privileges are determined by the Club's official records, rules, policies and decisions. LINDEX functionality may vary by membership category.</p><h2>4. Golf Information</h2><p>LINDEX may allow eligible members to submit and view golf scores, Club Index information, statistics and tournament information. Users are responsible for submitting accurate information. Unless expressly stated otherwise, a LINDEX Club Index should not be represented as an official USGA Handicap Index or other independently certified handicap.</p><h2>5. Events and RSVPs</h2><p>Users are responsible for accurate attendance and meal information and for complying with applicable reservation, cancellation and payment requirements. An RSVP does not eliminate a separate payment requirement associated with an event.</p><h2>6. Guest Passes</h2><p>Eligible members, renters or guests may be able to request or purchase guest passes. Required information must be accurate. Guest passes remain subject to Club rules, eligibility, payment and verification. Copying, altering, duplicating or attempting to misuse a digital guest pass is prohibited.</p><h2>7. Payments</h2><p>Certain activities may require payment through an external provider such as Square. The transaction is processed by the applicable provider and may be subject to separate terms. A request or RSVP is not considered paid unless the applicable payment has been successfully completed and recognized by the Club.</p><h2>8. Acceptable Use</h2><p>Users may not attempt unauthorized account or administrator access; circumvent membership restrictions; manipulate scores, memberships, passes or RSVPs; probe, attack, disrupt or interfere with LINDEX; introduce malicious software; harvest Member Directory information; use Club/member information for unauthorized commercial purposes; fraudulently copy or modify QR codes; or use LINDEX in violation of applicable law or Club policies.</p><h2>9. Availability and Changes</h2><p>LINDEX is an evolving Club service. Features may be added, modified, temporarily unavailable or discontinued. The Club does not guarantee uninterrupted availability of every feature. If LINDEX information conflicts with an official Club record or decision, the Club's official record or decision controls.</p><h2>10. Third-Party Services</h2><p>Certain functionality depends on independent third-party providers. The Club is not responsible for outages or circumstances outside its reasonable control involving those providers. Their services may be subject to separate terms and policies.</p><h2>11. Security</h2><p>Users must not attempt to defeat or circumvent LINDEX security controls. Suspected security issues should be reported privately to the Club rather than exploited or used to disclose member information.</p><h2>12. Disclaimer</h2><p>LINDEX is provided as a Club service for the convenience of members, renters, guests and administrators. Reasonable efforts are made to maintain accurate information and reliable operation, but uninterrupted or error-free operation is not guaranteed. Nothing in these Terms limits rights or obligations that cannot legally be limited.</p><h2>13. Changes to These Terms</h2><p>These Terms may be updated as LINDEX, Club policies or applicable requirements change. The current version will be posted on this page.</p></LegalPage>}
function Empty({text}){return <div className="card"><p className="muted">{text}</p></div>}
export default App;
