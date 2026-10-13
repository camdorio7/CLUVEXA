'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, ClipboardCheck, Clock3,
  Bell, CreditCard, Flag, Megaphone, ShieldCheck, Sparkles, UserRound, UserRoundPlus, UsersRound,
  WalletCards, Waves, BriefcaseBusiness, LayoutGrid, Settings2, Globe2, ChevronDown
} from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';
import CommandCenter from '../../../components/CommandCenter';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<any>();
  const [counts, setCounts] = useState<any>({});
  const [role, setRole] = useState('');
  const [memberRecord, setMemberRecord] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [roleError, setRoleError] = useState('');
  const [adminSection, setAdminSection] = useState<'overview'|'people'|'features'|'operations'|'settings'>('overview');
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [licensedModules, setLicensedModules] = useState<{module_key:string;club_enabled:boolean}[]>([]);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: { user }, error: authError } = await sb.auth.getUser();
      if (authError || !user) { setRoleError('Your session could not be verified. Please sign in again.'); setRoleLoaded(true); return; }
      const [clubResult, members, events, staff, checkins, tasks, pending, roleResult, profileResult, superResult, modulesResult] = await Promise.all([
        sb.from('clubs').select('*').eq('id', id).single(),
        sb.from('members').select('*', { count: 'exact', head: true }).eq('club_id', id).eq('status', 'active'),
        sb.from('club_events').select('*', { count: 'exact', head: true }).eq('club_id', id).gte('starts_at', new Date().toISOString()),
        sb.from('club_users').select('*', { count: 'exact', head: true }).eq('club_id', id).in('role', ['owner', 'admin', 'manager', 'staff']),
        sb.from('access_log').select('*', { count: 'exact', head: true }).eq('club_id', id).gte('checked_in_at', today.toISOString()),
        sb.from('operational_tasks').select('*', { count: 'exact', head: true }).eq('club_id', id).neq('status', 'complete'),
        sb.from('member_join_requests').select('*', { count: 'exact', head: true }).eq('club_id', id).eq('status', 'pending'),
        sb.from('club_users').select('role,active').eq('club_id', id).eq('user_id', user.id).maybeSingle(),
        sb.from('profiles').select('full_name,email,platform_role').eq('id', user.id).maybeSingle(),
        sb.rpc('is_super_admin'),
        sb.from('club_modules').select('module_key,club_enabled').eq('club_id', id).eq('licensed', true),
      ]);
      setClub(clubResult.data); setProfile((profileResult as any).data);
      setLicensedModules((modulesResult.data || []).map((m: any) => ({module_key:m.module_key,club_enabled:!!m.club_enabled})));
      setEnabledModules((modulesResult.data || []).filter((m: any) => m.club_enabled).map((m: any) => m.module_key));
      setCounts({ members: members.count, events: events.count, staff: staff.count, checkins: checkins.count, tasks: tasks.count, pending: pending.count });
      // Match WorkspaceShell's authorization rules: platform owners may have no club_users row.
      const isPlatformAdmin = superResult.data === true || (profileResult as any).data?.platform_role === 'super_admin';
      const assignedRole = (roleResult as any).data?.role || '';
      const assignedActive = (roleResult as any).data?.active === true;
      const resolvedRole = isPlatformAdmin ? 'super_admin' : (assignedActive ? assignedRole : '');
      if (!resolvedRole) {
        setRoleError(roleResult.error
          ? 'We could not check your organization access. Please refresh and try again.'
          : 'Your account does not have an active role in this organization. Ask an organization administrator to check your access.');
      } else { setRoleError(''); }
      setRole(resolvedRole); setRoleLoaded(true);
      const { data: ev } = await sb.from('club_events').select('id,title,starts_at,location').eq('club_id', id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(3);
      setUpcoming(ev || []);
      if (resolvedRole === 'member' && user) {
        const { data: mr } = await sb.from('members').select('*,membership_types(name)').eq('club_id', id).eq('profile_id', user.id).maybeSingle();
        setMemberRecord(mr);
      }
    })();
  }, [id]);

  const hasModule = (key: string) => enabledModules.includes(key);
  const member = role === 'member';
  const staffUser = ['staff', 'manager'].includes(role);
  const admin = ['owner', 'admin', 'super_admin'].includes(role);
  const firstName = (memberRecord?.full_name || profile?.full_name || '').split(' ')[0] || (member ? 'Member' : staffUser ? 'Team' : 'Administrator');

  if (!roleLoaded || !role) return <div className="portalHome" role="status">{roleLoaded ? roleError || 'Your organization access could not be verified.' : 'Loading your organization workspace…'}</div>;

  return <div className="portalHome">
    <section className={`portalWelcome ${member ? 'memberWelcomeV43' : staffUser ? 'staffWelcomeV43' : 'adminWelcomeV43'}`}>
      <div className="portalWelcomeCopy">
        <div className="eyebrow cyan">{member ? 'YOUR ORGANIZATION' : staffUser ? 'TEAM HOME' : 'ORGANIZATION MANAGEMENT'}</div>
        <h1>Welcome back, {firstName}.</h1>
        <p>{club?.welcome_message || (member ? `Stay connected with ${club?.name || 'your organization'}, access your services, and see what’s coming up.` : staffUser ? `Everything you need for today at ${club?.name || 'your organization'}, right at your fingertips.` : `Manage ${club?.name || 'your organization'} with a clear view of people, operations, events, and your team.`)}</p>
        <div className="portalWelcomeActions">
          {member && <>{hasModule('events') && <Link className="portalPrimaryAction" href={`/workspace/${id}/events`}><CalendarDays/> Explore events</Link>}<Link className="portalSecondaryAction" href={`/workspace/${id}/profile`}><UserRound/> My profile</Link></>}
          {admin && <CommandCenter id={id} role={role}/>}

    {staffUser && <><Link className="portalPrimaryAction" href={`/workspace/${id}/staff`}><Clock3/> Open time clock</Link><Link className="portalSecondaryAction" href={`/workspace/${id}/operations`}><ClipboardCheck/> Today's operations</Link></>}
          {admin && <><Link className="portalPrimaryAction" href={`/workspace/${id}/people`}><UserRoundPlus/> Review approvals</Link><Link className="portalSecondaryAction" href={`/workspace/${id}/members`}><UsersRound/> Members</Link></>}
        </div>
      </div>
      <div className="portalWelcomeSide">
        {club?.logo_url ? <img className="portalClubLogo" src={club.logo_url} alt=""/> : <div className="portalClubMonogram">{club?.name?.slice(0,2).toUpperCase() || 'N'}</div>}
        <b>{club?.name || 'Your organization'}</b>
        <span>{member ? memberRecord?.membership_types?.name || 'Organization Member' : staffUser ? role === 'manager' ? 'Organization Manager' : 'Organization Staff' : 'Organization Administrator'}</span>
        <div className="portalStatus"><CheckCircle2/> {member && memberRecord?.good_standing === false ? 'Membership review needed' : 'Active'}</div>
      </div>
    </section>

    {member && <>
      <section className="memberLindexOverview" aria-label="My membership overview">
        <div className="memberLindexIdentity">
          <div className="memberLindexAvatar" aria-hidden="true">{(profile?.full_name || firstName).split(/\s+/).map((part:string)=>part[0]).slice(0,2).join('').toUpperCase()}</div>
          <div><span className="memberLindexKicker">MY {club?.name?.toUpperCase() || 'ORGANIZATION'}</span><h2>{profile?.full_name || firstName}</h2><p>{memberRecord?.membership_types?.name || 'Organization Member'}</p><span className="memberLindexStatus"><CheckCircle2 size={15}/> {memberRecord?.good_standing === false ? 'Membership review needed' : 'Membership in good standing'}</span></div>
        </div>
        <div className="memberLindexDetails"><span>MEMBERSHIP DETAILS</span><div><small>Membership level</small><b>{memberRecord?.membership_types?.name || 'Member'}</b></div><div><small>Member number</small><b>{memberRecord?.member_number || 'Not assigned'}</b></div><Link href={`/workspace/${id}/card`}>View membership card <ArrowRight size={16}/></Link></div>
      </section>
      <section className="portalSectionTitle"><div><span>MY ORGANIZATION</span><h2>Quick access</h2></div></section>
      <div className="portalActionGrid memberActionGrid">
        <Link href={`/workspace/${id}/card`}><span className="portalActionIcon"><CreditCard/></span><div><b>Membership Card</b><p>Your digital member ID and membership standing</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/profile`}><span className="portalActionIcon"><UserRound/></span><div><b>My Profile</b><p>Membership, contact details and account settings</p></div><ArrowRight/></Link>
        {hasModule('events') && <Link href={`/workspace/${id}/events`}><span className="portalActionIcon"><CalendarDays/></span><div><b>Events</b><p>See what’s happening and plan your next visit</p></div><ArrowRight/></Link>}
        {hasModule('tee_sheet') && <Link href={`/workspace/${id}/tee-sheet`}><span className="portalActionIcon"><Clock3/></span><div><b>Tee Times</b><p>View available tee times and scheduling</p></div><ArrowRight/></Link>}
        {hasModule('directory') && <Link href={`/workspace/${id}/directory`}><span className="portalActionIcon"><UsersRound/></span><div><b>Member Directory</b><p>Stay connected with your organization community</p></div><ArrowRight/></Link>}
        {hasModule('access') && <Link href={`/workspace/${id}/access`}><span className="portalActionIcon"><WalletCards/></span><div><b>Access & Guests</b><p>Guest privileges, passes and organization access</p></div><ArrowRight/></Link>}
        <Link href={`/workspace/${id}/household`}><span className="portalActionIcon"><UsersRound/></span><div><b>My Household</b><p>Manage people connected to your membership</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/notifications`}><span className="portalActionIcon"><Bell/></span><div><b>Notifications</b><p>Reminders, announcements and organization alerts</p></div><ArrowRight/></Link>{hasModule('communications') && <Link href={`/workspace/${id}/communications`}><span className="portalActionIcon"><Megaphone/></span><div><b>Organization Updates</b><p>Announcements and important organization information</p></div><ArrowRight/></Link>}
      </div>
      <div className="portalLowerGrid">
        {hasModule('events') && <section className="portalPanel"><div className="portalPanelHead"><div><span>UP NEXT</span><h2>Coming up at your organization</h2></div><Link href={`/workspace/${id}/events`}>View all <ArrowRight/></Link></div>{upcoming.length ? upcoming.map(e => <Link className="portalEventRow" href={`/workspace/${id}/events`} key={e.id}><span className="eventDate"><b>{new Date(e.starts_at).toLocaleDateString(undefined,{day:'numeric'})}</b><small>{new Date(e.starts_at).toLocaleDateString(undefined,{month:'short'}).toUpperCase()}</small></span><div><b>{e.title}</b><p>{new Date(e.starts_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}{e.location ? ` · ${e.location}` : ''}</p></div><ArrowRight/></Link>) : <div className="portalEmpty"><CalendarDays/><b>Nothing scheduled yet</b><span>New organization events will appear here.</span></div>}</section>}
        <aside className="portalPanel membershipSpotlight"><span>MY MEMBERSHIP</span><BadgeCheck/><h2>{memberRecord?.membership_types?.name || 'Organization Member'}</h2><p>{memberRecord?.member_number ? `Member #${memberRecord.member_number}` : 'Your membership information is available in your profile.'}</p><div className="membershipGood"><CheckCircle2/> {memberRecord?.good_standing === false ? 'Review needed' : 'Good standing'}</div><Link href={`/workspace/${id}/profile`}>View membership <ArrowRight/></Link></aside>
      </div>
    </>}

    {admin && <CommandCenter id={id} role={role}/>}

    {staffUser && <>
      <section className="portalSectionTitle"><div><span>YOUR WORKDAY</span><h2>Quick access to the tools your team uses most.</h2></div></section>
      <div className="portalActionGrid staffActionGrid">
        <Link href={`/workspace/${id}/staff`}><span className="portalActionIcon"><Clock3/></span><div><b>Time Clock</b><p>Clock in or out and review recent time entries</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/operations`}><span className="portalActionIcon"><ClipboardCheck/></span><div><b>Operations</b><p>{counts.tasks ? `${counts.tasks} open tasks need attention` : 'Daily tasks and organization operations'}</p></div><ArrowRight/></Link>
        {hasModule('events') && <Link href={`/workspace/${id}/events`}><span className="portalActionIcon"><CalendarDays/></span><div><b>Events</b><p>{counts.events || 0} upcoming organization events</p></div><ArrowRight/></Link>}
        {hasModule('access') && <Link href={`/workspace/${id}/access`}><span className="portalActionIcon"><ShieldCheck/></span><div><b>Access & Guests</b><p>{counts.checkins || 0} check-ins recorded today</p></div><ArrowRight/></Link>}
        {hasModule('tee_sheet') && <Link href={`/workspace/${id}/tee-sheet`}><span className="portalActionIcon"><Flag/></span><div><b>Tee Sheet</b><p>View today’s schedule and tee times</p></div><ArrowRight/></Link>}
        {hasModule('communications') && <Link href={`/workspace/${id}/communications`}><span className="portalActionIcon"><Megaphone/></span><div><b>Organization Updates</b><p>Stay current on announcements and notices</p></div><ArrowRight/></Link>}
      </div>
      <div className="portalLowerGrid"><section className="portalPanel"><div className="portalPanelHead"><div><span>TODAY</span><h2>At a glance</h2></div></div><div className="portalMetricRows"><div><Clock3/><span>Check-ins today</span><b>{counts.checkins ?? '—'}</b></div><div><ClipboardCheck/><span>Open tasks</span><b>{counts.tasks ?? '—'}</b></div><div><CalendarDays/><span>Upcoming events</span><b>{counts.events ?? '—'}</b></div></div></section><aside className="portalPanel teamCard"><BriefcaseBusiness/><span>TEAM ACCESS</span><h2>{role === 'manager' ? 'Manager workspace' : 'Staff workspace'}</h2><p>Your tools are based on the permissions assigned by your organization administrator.</p><Link href={`/workspace/${id}/staff`}>Open staff center <ArrowRight/></Link></aside></div>
    </>}

    {admin && <>
      <div className="portalMetricGrid"><div><span className="metricIcon"><UserRoundPlus/></span><div><small>Pending approvals</small><strong>{counts.pending ?? '—'}</strong><p>Awaiting review</p></div></div><div><span className="metricIcon"><UsersRound/></span><div><small>Active members</small><strong>{counts.members ?? '—'}</strong><p>Current members</p></div></div><div><span className="metricIcon"><Clock3/></span><div><small>Today's check-ins</small><strong>{counts.checkins ?? '—'}</strong><p>Recorded today</p></div></div><div><span className="metricIcon"><CalendarDays/></span><div><small>Upcoming events</small><strong>{counts.events ?? '—'}</strong><p>On the calendar</p></div></div></div>
      <section className="adminSectionSwitcher" aria-label="Admin dashboard sections">
        <div className="adminSectionHeading"><span>ORGANIZATION ADMIN</span><h2>Manage your workspace</h2><p>Choose a section to find the tools you need.</p></div>
        <div className="adminSectionTabs" role="group" aria-label="Choose dashboard section">
          {([{key:'overview',name:'Overview',Icon:LayoutGrid},{key:'people',name:'People',Icon:UsersRound},{key:'features',name:'Features',Icon:Globe2},{key:'operations',name:'Operations',Icon:ClipboardCheck},{key:'settings',name:'Settings',Icon:Settings2}] as const).map(({key,name,Icon})=><button type="button" key={key} className={adminSection===key?'selected':''} aria-pressed={adminSection===key} onClick={()=>setAdminSection(key)}><Icon size={18}/>{name}</button>)}
        </div>
      </section>
      {adminSection==='overview' && <div className="portalLowerGrid"><section className="portalPanel"><div className="portalPanelHead"><div><span>NEEDS ATTENTION</span><h2>Today's priorities</h2></div></div><Link className="portalAttentionRow" href={`/workspace/${id}/people`}><UserRoundPlus/><div><b>Membership applications</b><p>{counts.pending ? `${counts.pending} waiting for review` : 'No pending applications'}</p></div><ArrowRight/></Link><Link className="portalAttentionRow" href={`/workspace/${id}/operations`}><ClipboardCheck/><div><b>Operational tasks</b><p>{counts.tasks ? `${counts.tasks} open tasks` : 'No open tasks'}</p></div><ArrowRight/></Link></section><aside className="portalPanel clubHealth"><Sparkles/><span>WORKSPACE AT A GLANCE</span><h2>{enabledModules.length} active features</h2><p>{licensedModules.length} modules licensed by CD7 Technologies. Organize access and visibility in Feature Settings.</p><button type="button" className="adminInlineButton" onClick={()=>setAdminSection('features')}>Manage features <ArrowRight size={16}/></button></aside></div>}
      {adminSection==='people' && <section className="portalPanel"><div className="portalPanelHead"><div><span>PEOPLE & ACCESS</span><h2>Membership and team</h2></div></div><div className="portalActionGrid adminActionGrid"><Link href={`/workspace/${id}/people`}><span className="portalActionIcon"><UserRoundPlus/></span><div><b>People & Approvals</b><p>{counts.pending || 0} applications awaiting review</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/members`}><span className="portalActionIcon"><UsersRound/></span><div><b>Members</b><p>Member accounts and directory</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/memberships`}><span className="portalActionIcon"><WalletCards/></span><div><b>Membership Levels</b><p>Plans and membership access</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/staff`}><span className="portalActionIcon"><BriefcaseBusiness/></span><div><b>Staff & Team</b><p>Manage staff accounts and access</p></div><ArrowRight/></Link></div></section>}
      {adminSection==='features' && <section className="portalPanel"><div className="portalPanelHead"><div><span>LICENSED BY CD7 TECHNOLOGIES</span><h2>Available organization features</h2></div><Link href={`/workspace/${id}/settings`}>Feature settings <ArrowRight/></Link></div><p className="adminSectionIntro">Licensed features appear here. Activate them in Settings before using them.</p><div className="portalActionGrid adminActionGrid">{licensedModules.length===0?<p>No modules are licensed yet. Contact CD7 Technologies.</p>:licensedModules.map(m=>{const known:Record<string,[string,string]>={events:['Events','events'],tee_sheet:['Tee Sheet','tee-sheet'],amenities:['Amenities','amenities'],access:['Access & Guests','access'],golf:['Golf & Tournaments','golf'],communications:['Communications','communications'],documents:['Documents','documents'],reservations:['Reservations','reservations'],reports:['Reports','reports'],members:['Members','members'],memberships:['Memberships','memberships'],staff:['Staff','staff'],operations:['Operations','operations'],website_management:['Existing Website (GitHub)','website'],website_builder:['Website Builder','site-builder'],email_center:['Email Center','email-center'],connected_platforms:['Connected Platforms','platforms'],automations:['Automations','automations'],intelligence:['Intelligence','intelligence']};const info=known[m.module_key];const title=info?.[0]||m.module_key.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());const active=m.club_enabled;return <Link key={m.module_key} href={`/workspace/${id}/${active&&info?info[1]:'settings'}`}><span className="portalActionIcon"><ShieldCheck/></span><div><b>{title}</b><p>{!active?'Licensed · Activate in settings':info?'Active · Open feature':'Licensed · Setup coming soon'}</p></div><ArrowRight/></Link>})}</div></section>}
      {adminSection==='operations' && <section className="portalPanel"><div className="portalPanelHead"><div><span>DAILY MANAGEMENT</span><h2>Operations and activities</h2></div></div><div className="portalActionGrid adminActionGrid"><Link href={`/workspace/${id}/operations`}><span className="portalActionIcon"><ClipboardCheck/></span><div><b>Operations</b><p>{counts.tasks || 0} open tasks</p></div><ArrowRight/></Link>{hasModule('events')&&<Link href={`/workspace/${id}/events`}><span className="portalActionIcon"><CalendarDays/></span><div><b>Events</b><p>Calendar and registrations</p></div><ArrowRight/></Link>}{hasModule('access')&&<Link href={`/workspace/${id}/access`}><span className="portalActionIcon"><ShieldCheck/></span><div><b>Access & Guests</b><p>Check-ins and guest access</p></div><ArrowRight/></Link>}{hasModule('tee_sheet')&&<Link href={`/workspace/${id}/tee-sheet`}><span className="portalActionIcon"><Flag/></span><div><b>Tee Sheet</b><p>Golf scheduling</p></div><ArrowRight/></Link>}</div></section>}
      {adminSection==='settings' && <section className="portalPanel"><div className="portalPanelHead"><div><span>CONFIGURATION</span><h2>Organization settings</h2></div></div><div className="portalActionGrid adminActionGrid"><Link href={`/workspace/${id}/settings`}><span className="portalActionIcon"><Settings2/></span><div><b>Branding & Modules</b><p>Organization colors, licensed features and visibility</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/profile`}><span className="portalActionIcon"><UserRound/></span><div><b>My Account</b><p>Manage your personal profile</p></div><ArrowRight/></Link></div></section>}
    </>}
  </div>;
}
