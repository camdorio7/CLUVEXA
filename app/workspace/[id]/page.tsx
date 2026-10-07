'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowRight, BadgeCheck, CalendarDays, CheckCircle2, ClipboardCheck, Clock3,
  Flag, Megaphone, ShieldCheck, Sparkles, UserRound, UserRoundPlus, UsersRound,
  WalletCards, Waves, BriefcaseBusiness
} from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<any>();
  const [counts, setCounts] = useState<any>({});
  const [role, setRole] = useState('');
  const [memberRecord, setMemberRecord] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const { data: { user } } = await sb.auth.getUser();
      const [clubResult, members, events, staff, checkins, tasks, pending, roleResult, profileResult] = await Promise.all([
        sb.from('clubs').select('*').eq('id', id).single(),
        sb.from('members').select('*', { count: 'exact', head: true }).eq('club_id', id).eq('status', 'active'),
        sb.from('club_events').select('*', { count: 'exact', head: true }).eq('club_id', id).gte('starts_at', new Date().toISOString()),
        sb.from('club_users').select('*', { count: 'exact', head: true }).eq('club_id', id).in('role', ['owner', 'admin', 'manager', 'staff']),
        sb.from('access_log').select('*', { count: 'exact', head: true }).eq('club_id', id).gte('checked_in_at', today.toISOString()),
        sb.from('operational_tasks').select('*', { count: 'exact', head: true }).eq('club_id', id).neq('status', 'complete'),
        sb.from('member_join_requests').select('*', { count: 'exact', head: true }).eq('club_id', id).eq('status', 'pending'),
        user ? sb.from('club_users').select('role').eq('club_id', id).eq('user_id', user.id).maybeSingle() : Promise.resolve({ data: null }),
        user ? sb.from('profiles').select('full_name,email').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      setClub(clubResult.data); setProfile((profileResult as any).data);
      setCounts({ members: members.count, events: events.count, staff: staff.count, checkins: checkins.count, tasks: tasks.count, pending: pending.count });
      const resolvedRole = (roleResult as any).data?.role || 'admin'; setRole(resolvedRole);
      const { data: ev } = await sb.from('club_events').select('id,title,starts_at,location').eq('club_id', id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(3);
      setUpcoming(ev || []);
      if (resolvedRole === 'member' && user) {
        const { data: mr } = await sb.from('members').select('*,membership_types(name)').eq('club_id', id).eq('profile_id', user.id).maybeSingle();
        setMemberRecord(mr);
      }
    })();
  }, [id]);

  const member = role === 'member';
  const staffUser = ['staff', 'manager'].includes(role);
  const admin = ['owner', 'admin', 'super_admin'].includes(role);
  const firstName = (memberRecord?.full_name || profile?.full_name || '').split(' ')[0] || (member ? 'Member' : staffUser ? 'Team' : 'Administrator');

  return <div className="portalHome">
    <section className={`portalWelcome ${member ? 'memberWelcomeV43' : staffUser ? 'staffWelcomeV43' : 'adminWelcomeV43'}`}>
      <div className="portalWelcomeCopy">
        <div className="eyebrow cyan">{member ? 'YOUR CLUB' : staffUser ? 'TEAM HOME' : 'CLUB MANAGEMENT'}</div>
        <h1>Welcome back, {firstName}.</h1>
        <p>{club?.welcome_message || (member ? `Stay connected with ${club?.name || 'your club'}, manage your membership, and see what’s coming up.` : staffUser ? `Everything you need for today at ${club?.name || 'the club'}, right at your fingertips.` : `Run ${club?.name || 'your club'} with a clear view of members, operations, events and your team.`)}</p>
        <div className="portalWelcomeActions">
          {member && <><Link className="portalPrimaryAction" href={`/workspace/${id}/events`}><CalendarDays/> Explore events</Link><Link className="portalSecondaryAction" href={`/workspace/${id}/profile`}><UserRound/> My profile</Link></>}
          {staffUser && <><Link className="portalPrimaryAction" href={`/workspace/${id}/staff`}><Clock3/> Open time clock</Link><Link className="portalSecondaryAction" href={`/workspace/${id}/operations`}><ClipboardCheck/> Today's operations</Link></>}
          {admin && <><Link className="portalPrimaryAction" href={`/workspace/${id}/people`}><UserRoundPlus/> Review approvals</Link><Link className="portalSecondaryAction" href={`/workspace/${id}/members`}><UsersRound/> Members</Link></>}
        </div>
      </div>
      <div className="portalWelcomeSide">
        {club?.logo_url ? <img className="portalClubLogo" src={club.logo_url} alt=""/> : <div className="portalClubMonogram">{club?.name?.slice(0,2).toUpperCase() || 'N'}</div>}
        <b>{club?.name || 'Your Club'}</b>
        <span>{member ? memberRecord?.membership_types?.name || 'Club Member' : staffUser ? role === 'manager' ? 'Club Manager' : 'Club Staff' : 'Club Administrator'}</span>
        <div className="portalStatus"><CheckCircle2/> {member && memberRecord?.good_standing === false ? 'Membership review needed' : 'Active'}</div>
      </div>
    </section>

    {member && <>
      <section className="portalSectionTitle"><div><span>MEMBER PORTAL</span><h2>Everything you need, all in one place.</h2></div></section>
      <div className="portalActionGrid memberActionGrid">
        <Link href={`/workspace/${id}/profile`}><span className="portalActionIcon"><UserRound/></span><div><b>My Profile</b><p>Membership, contact details and account settings</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/events`}><span className="portalActionIcon"><CalendarDays/></span><div><b>Club Events</b><p>See what’s happening and plan your next visit</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/tee-sheet`}><span className="portalActionIcon"><Clock3/></span><div><b>Tee Times</b><p>View the club tee sheet and golf schedule</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/directory`}><span className="portalActionIcon"><UsersRound/></span><div><b>Member Directory</b><p>Stay connected with your club community</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/access`}><span className="portalActionIcon"><WalletCards/></span><div><b>Access & Guests</b><p>Guest privileges, passes and club access</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/communications`}><span className="portalActionIcon"><Megaphone/></span><div><b>Club Updates</b><p>Announcements and important club information</p></div><ArrowRight/></Link>
      </div>
      <div className="portalLowerGrid">
        <section className="portalPanel"><div className="portalPanelHead"><div><span>UP NEXT</span><h2>Coming up at the club</h2></div><Link href={`/workspace/${id}/events`}>View all <ArrowRight/></Link></div>{upcoming.length ? upcoming.map(e => <Link className="portalEventRow" href={`/workspace/${id}/events`} key={e.id}><span className="eventDate"><b>{new Date(e.starts_at).toLocaleDateString(undefined,{day:'numeric'})}</b><small>{new Date(e.starts_at).toLocaleDateString(undefined,{month:'short'}).toUpperCase()}</small></span><div><b>{e.title}</b><p>{new Date(e.starts_at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}{e.location ? ` · ${e.location}` : ''}</p></div><ArrowRight/></Link>) : <div className="portalEmpty"><CalendarDays/><b>Nothing scheduled yet</b><span>New club events will appear here.</span></div>}</section>
        <aside className="portalPanel membershipSpotlight"><span>MY MEMBERSHIP</span><BadgeCheck/><h2>{memberRecord?.membership_types?.name || 'Club Member'}</h2><p>{memberRecord?.member_number ? `Member #${memberRecord.member_number}` : 'Your membership information is available in your profile.'}</p><div className="membershipGood"><CheckCircle2/> {memberRecord?.good_standing === false ? 'Review needed' : 'Good standing'}</div><Link href={`/workspace/${id}/profile`}>View membership <ArrowRight/></Link></aside>
      </div>
    </>}

    {staffUser && <>
      <section className="portalSectionTitle"><div><span>YOUR WORKDAY</span><h2>Quick access to the tools your team uses most.</h2></div></section>
      <div className="portalActionGrid staffActionGrid">
        <Link href={`/workspace/${id}/staff`}><span className="portalActionIcon"><Clock3/></span><div><b>Time Clock</b><p>Clock in or out and review recent time entries</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/operations`}><span className="portalActionIcon"><ClipboardCheck/></span><div><b>Operations</b><p>{counts.tasks ? `${counts.tasks} open tasks need attention` : 'Daily tasks and club operations'}</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/events`}><span className="portalActionIcon"><CalendarDays/></span><div><b>Events</b><p>{counts.events || 0} upcoming club events</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/access`}><span className="portalActionIcon"><ShieldCheck/></span><div><b>Access & Guests</b><p>{counts.checkins || 0} check-ins recorded today</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/tee-sheet`}><span className="portalActionIcon"><Flag/></span><div><b>Tee Sheet</b><p>View today’s golf activity and tee times</p></div><ArrowRight/></Link>
        <Link href={`/workspace/${id}/communications`}><span className="portalActionIcon"><Megaphone/></span><div><b>Club Updates</b><p>Stay current on announcements and notices</p></div><ArrowRight/></Link>
      </div>
      <div className="portalLowerGrid"><section className="portalPanel"><div className="portalPanelHead"><div><span>TODAY</span><h2>At a glance</h2></div></div><div className="portalMetricRows"><div><Clock3/><span>Check-ins today</span><b>{counts.checkins ?? '—'}</b></div><div><ClipboardCheck/><span>Open tasks</span><b>{counts.tasks ?? '—'}</b></div><div><CalendarDays/><span>Upcoming events</span><b>{counts.events ?? '—'}</b></div></div></section><aside className="portalPanel teamCard"><BriefcaseBusiness/><span>TEAM ACCESS</span><h2>{role === 'manager' ? 'Manager workspace' : 'Staff workspace'}</h2><p>Your tools are based on the permissions assigned by your club administrator.</p><Link href={`/workspace/${id}/staff`}>Open staff center <ArrowRight/></Link></aside></div>
    </>}

    {admin && <>
      <div className="portalMetricGrid"><div><span className="metricIcon"><UserRoundPlus/></span><div><small>Pending approvals</small><strong>{counts.pending ?? '—'}</strong><p>{counts.pending ? 'Waiting for your review' : 'All caught up'}</p></div></div><div><span className="metricIcon"><UsersRound/></span><div><small>Active members</small><strong>{counts.members ?? '—'}</strong><p>Current club membership</p></div></div><div><span className="metricIcon"><Clock3/></span><div><small>Today's check-ins</small><strong>{counts.checkins ?? '—'}</strong><p>Club activity today</p></div></div><div><span className="metricIcon"><CalendarDays/></span><div><small>Upcoming events</small><strong>{counts.events ?? '—'}</strong><p>On the club calendar</p></div></div></div>
      <section className="portalSectionTitle"><div><span>MANAGE YOUR CLUB</span><h2>Common tasks, one click away.</h2></div></section>
      <div className="portalActionGrid adminActionGrid"><Link href={`/workspace/${id}/people`}><span className="portalActionIcon"><UserRoundPlus/></span><div><b>People & Approvals</b><p>{counts.pending ? `${counts.pending} applications waiting for review` : 'Manage access and member applications'}</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/members`}><span className="portalActionIcon"><UsersRound/></span><div><b>Member Directory</b><p>View and manage your active membership</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/memberships`}><span className="portalActionIcon"><WalletCards/></span><div><b>Membership Levels</b><p>Plans, pricing and membership access</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/operations`}><span className="portalActionIcon"><ClipboardCheck/></span><div><b>Operations</b><p>{counts.tasks ? `${counts.tasks} open tasks` : 'Daily operations and tasks'}</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/staff`}><span className="portalActionIcon"><BriefcaseBusiness/></span><div><b>Staff & Team</b><p>{counts.staff || 0} team accounts</p></div><ArrowRight/></Link><Link href={`/workspace/${id}/events`}><span className="portalActionIcon"><CalendarDays/></span><div><b>Events</b><p>Plan and manage the club calendar</p></div><ArrowRight/></Link></div>
      <div className="portalLowerGrid"><section className="portalPanel"><div className="portalPanelHead"><div><span>ATTENTION</span><h2>What needs you today</h2></div></div><Link className="portalAttentionRow" href={`/workspace/${id}/people`}><UserRoundPlus/><div><b>Membership applications</b><p>{counts.pending ? `${counts.pending} waiting for review` : 'No applications waiting'}</p></div><ArrowRight/></Link><Link className="portalAttentionRow" href={`/workspace/${id}/operations`}><ClipboardCheck/><div><b>Operational tasks</b><p>{counts.tasks ? `${counts.tasks} tasks still open` : 'No open tasks'}</p></div><ArrowRight/></Link></section><aside className="portalPanel clubHealth"><Sparkles/><span>CLUB WORKSPACE</span><h2>Everything is connected.</h2><p>NADORIO keeps your members, staff, events and operations together in one club workspace.</p><div className="membershipGood"><CheckCircle2/> Platform operational</div></aside></div>
    </>}
  </div>;
}
