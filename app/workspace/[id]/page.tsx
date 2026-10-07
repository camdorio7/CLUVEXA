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
} from 'lucide-react';
import { createClient } from '../../../lib/supabase/client';

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const [club, setClub] = useState<any>();
  const [counts, setCounts] = useState<any>({});
  const [role, setRole] = useState('');

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
      setRole((roleResult as any).data?.role || 'admin');
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
        <div className="adminSummary memberSummary">
          <div className="summaryCard">
            <span className="summaryIcon"><CalendarDays /></span>
            <div><small>Upcoming events</small><strong>{counts.events ?? '—'}</strong><p>On the club calendar</p></div>
          </div>
          <div className="summaryCard">
            <span className="summaryIcon"><Clock3 /></span>
            <div><small>Today's activity</small><strong>{counts.checkins ?? '—'}</strong><p>Club check-ins</p></div>
          </div>
        </div>
      ) : (
        <div className="adminSummary overviewSummary">
          <div className={`summaryCard ${counts.pending ? 'attention' : ''}`}>
            <span className="summaryIcon"><UserRoundPlus /></span>
            <div><small>Approvals</small><strong>{counts.pending ?? '—'}</strong><p>{counts.pending ? 'Waiting for review' : 'All caught up'}</p></div>
          </div>
          <div className="summaryCard">
            <span className="summaryIcon"><UsersRound /></span>
            <div><small>Active members</small><strong>{counts.members ?? '—'}</strong><p>Current membership</p></div>
          </div>
          <div className="summaryCard">
            <span className="summaryIcon"><Clock3 /></span>
            <div><small>Check-ins today</small><strong>{counts.checkins ?? '—'}</strong><p>Across club access points</p></div>
          </div>
          <div className="summaryCard">
            <span className="summaryIcon"><CalendarDays /></span>
            <div><small>Upcoming events</small><strong>{counts.events ?? '—'}</strong><p>Scheduled ahead</p></div>
          </div>
        </div>
      )}

      <div className="adminHomeGrid">
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
      </div>
    </>
  );
}
