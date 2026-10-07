'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Sparkles,
  UserRoundPlus,
  UsersRound,
  UserRound,
  BadgeCheck,
  BookOpen,
} from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<any>();
  const [counts, setCounts] = useState<any>({});
  const [role, setRole] = useState('');
  const [memberRecord, setMemberRecord] = useState<any>(null);
  const [upcoming, setUpcoming] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const sb = createClient();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: { user } } = await sb.auth.getUser();

      const [clubResult, members, events, staff, checkins, tasks, pending, roleResult] = await Promise.all([
        sb.from('clubs').select('*').eq('id', id).single(),
        sb.from('members').select('*', { count: 'exact', head: true }).eq('club_id', id).eq('status', 'active'),
        sb.from('club_events').select('*', { count: 'exact', head: true }).eq('club_id', id).gte('starts_at', new Date().toISOString()),
        sb.from('club_users').select('*', { count: 'exact', head: true }).eq('club_id', id).in('role', ['owner', 'admin', 'manager', 'staff']),
        sb.from('access_log').select('*', { count: 'exact', head: true }).eq('club_id', id).gte('checked_in_at', today.toISOString()),
        sb.from('operational_tasks').select('*', { count: 'exact', head: true }).eq('club_id', id).neq('status', 'complete'),
        sb.from('member_join_requests').select('*', { count: 'exact', head: true }).eq('club_id', id).eq('status', 'pending'),
        user
          ? sb.from('club_users').select('role').eq('club_id', id).eq('user_id', user.id).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setClub(clubResult.data);
      setCounts({
        members: members.count,
        events: events.count,
        staff: staff.count,
        checkins: checkins.count,
        tasks: tasks.count,
        pending: pending.count,
      });
      const resolvedRole = (roleResult as any).data?.role || 'admin';
      setRole(resolvedRole);
      if (resolvedRole === 'member' && user) {
        const [{ data: mr }, { data: ev }] = await Promise.all([
          sb.from('members').select('*,membership_types(name)').eq('club_id', id).eq('profile_id', user.id).maybeSingle(),
          sb.from('club_events').select('id,title,starts_at,location').eq('club_id', id).gte('starts_at', new Date().toISOString()).order('starts_at').limit(3),
        ]);
        setMemberRecord(mr); setUpcoming(ev || []);
      }
    })();
  }, [id]);

  const member = role === 'member';

  return (
    <>
      <section className="adminHero">
        <div className="adminHeroCopy">
          <div className="eyebrow cyan">{member ? 'MEMBER HOME' : 'CLUB COMMAND CENTER'}</div>
          <h1>{club?.name || 'Organization'}</h1>
          <p>{club?.welcome_message || 'A clear view of your club today, with the tools you need close at hand.'}</p>
        </div>
        <div className="adminHeroMark">
          <Sparkles size={16} />
          <span>NADORIO</span>
          <b>4.1.1</b>
        </div>
      </section>

      {member ? (
        <>
          <div className="memberHero">
            <section className="memberWelcome"><div className="eyebrow cyan">WELCOME BACK</div><h1>{memberRecord?.full_name || 'Member'}</h1><p>{club?.welcome_message || `Everything you need from ${club?.name || 'your club'}, all in one place.`}</p></section>
            <aside className="memberIdentity"><div className="memberAvatar">{memberRecord?.full_name?.split(' ').map((x:string)=>x[0]).slice(0,2).join('').toUpperCase() || 'M'}</div><div><b>{memberRecord?.full_name || 'Member account'}</b><span>{memberRecord?.membership_types?.name || 'Club member'}</span><span>{memberRecord?.good_standing === false ? 'Membership review needed' : 'Good standing'}</span></div></aside>
          </div>
          <div className="memberQuickGrid">
            <Link className="memberQuick" href={`/workspace/${id}/profile`}><UserRound/><div><b>My Profile</b><span>Account & membership</span></div></Link>
            <Link className="memberQuick" href={`/workspace/${id}/events`}><CalendarDays/><div><b>Events</b><span>What’s happening</span></div></Link>
            <Link className="memberQuick" href={`/workspace/${id}/tee-sheet`}><Clock3/><div><b>Tee Times</b><span>Club tee sheet</span></div></Link>
            <Link className="memberQuick" href={`/workspace/${id}/directory`}><UsersRound/><div><b>Directory</b><span>Find club members</span></div></Link>
          </div>
        </>
      ) : (
        <div className="adminSummary overviewSummary">
          <div className={`summaryCard ${counts.pending ? 'attention' : ''}`}><span className="summaryIcon"><UserRoundPlus /></span><div><small>Approvals</small><strong>{counts.pending ?? '—'}</strong><p>{counts.pending ? 'Waiting for review' : 'All caught up'}</p></div></div>
          <div className="summaryCard"><span className="summaryIcon"><UsersRound /></span><div><small>Active members</small><strong>{counts.members ?? '—'}</strong><p>Current membership</p></div></div>
          <div className="summaryCard"><span className="summaryIcon"><Clock3 /></span><div><small>Check-ins today</small><strong>{counts.checkins ?? '—'}</strong><p>Across club access points</p></div></div>
          <div className="summaryCard"><span className="summaryIcon"><CalendarDays /></span><div><small>Upcoming events</small><strong>{counts.events ?? '—'}</strong><p>Scheduled ahead</p></div></div>
        </div>
      )}


      {member && <div className="memberContentGrid"><section className="memberPanel"><div className="memberPanelHead"><h2>Coming up</h2><Link href={`/workspace/${id}/events`}>View all</Link></div>{upcoming.length?upcoming.map(e=><div className="memberListItem" key={e.id}><div><b>{e.title}</b><p>{new Date(e.starts_at).toLocaleString()} {e.location?`· ${e.location}`:''}</p></div><ArrowRight size={16}/></div>):<div className="memberListItem"><div><b>No upcoming events</b><p>New club events will appear here.</p></div></div>}</section><aside className="memberPanel"><div className="memberPanelHead"><h2>Membership</h2></div><div className="memberListItem"><div><b>{memberRecord?.membership_types?.name||'Club member'}</b><p>{memberRecord?.member_number?`Member #${memberRecord.member_number}`:'Member number not assigned'}</p></div><BadgeCheck size={18}/></div><div className="memberListItem"><Link href={`/workspace/${id}/profile`}>View profile & membership</Link><ArrowRight size={16}/></div></aside></div>}

      {!member && <div className="adminHomeGrid">
        <section className="v3Section">
          <div className="v3SectionHead">
            <div>
              <h2>{member ? 'Your club' : 'What needs attention'}</h2>
              <p>{member ? 'Everything you need from your club in one place.' : 'Simple shortcuts to the most common management tasks.'}</p>
            </div>
          </div>
          <div className="adminActionList">
            {member ? (
              <>
                <Link href={`/workspace/${id}/events`}><span className="actionIcon"><CalendarDays /></span><div><b>Events</b><small>See upcoming club events</small></div><ArrowRight /></Link>
                <Link href={`/workspace/${id}/tee-sheet`}><span className="actionIcon"><Clock3 /></span><div><b>Tee Sheet</b><small>View club tee times</small></div><ArrowRight /></Link>
              </>
            ) : (
              <>
                <Link href={`/workspace/${id}/people`}><span className="actionIcon"><UserRoundPlus /></span><div><b>People & Approvals</b><small>{counts.pending ? `${counts.pending} membership ${counts.pending === 1 ? 'application' : 'applications'} waiting` : 'No applications waiting'}</small></div><ArrowRight /></Link>
                <Link href={`/workspace/${id}/memberships`}><span className="actionIcon"><UsersRound /></span><div><b>Membership Levels</b><small>Manage plans available during signup</small></div><ArrowRight /></Link>
                <Link href={`/workspace/${id}/operations`}><span className="actionIcon"><ClipboardCheck /></span><div><b>Operations</b><small>{counts.tasks ? `${counts.tasks} open ${counts.tasks === 1 ? 'task' : 'tasks'}` : 'No open tasks'}</small></div><ArrowRight /></Link>
              </>
            )}
          </div>
        </section>

        <aside className="v3Section adminStatus">
          <div className="v3SectionHead"><div><h2>Club status</h2><p>At-a-glance system health</p></div></div>
          <div className="statusLine"><span>Organization</span><b className="status"><CheckCircle2 size={13} />{club?.status || 'Active'}</b></div>
          <div className="statusLine"><span>NADORIO platform</span><b className="status"><CheckCircle2 size={13} />Operational</b></div>
          {!member && <div className="statusLine"><span>Team accounts</span><b>{counts.staff ?? 0}</b></div>}
          <div className="statusLine"><span>Workspace</span><b>Up to date</b></div>
        </aside>
      </div>}
    </>
  );
}
