'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Building2, Bell, CalendarDays, Clock3, CreditCard, Flag, Home, LogOut, Menu, Settings, ShieldCheck, UserRound, UsersRound, X } from 'lucide-react';
import { createClient } from '../lib/supabase/client';
import NadorioLogo from './NadorioLogo';

const defs: Record<string, [string, string]> = {
  overview: ['', 'Home'], members: ['/members', 'Member Directory'], memberships: ['/memberships', 'Memberships'],
  amenities: ['/amenities', 'Amenities'], access: ['/access', 'Access & Guests'], events: ['/events', 'Events'],
  tee_sheet: ['/tee-sheet', 'Tee Sheet'], golf: ['/golf', 'Golf & Tournaments'], staff: ['/staff', 'Staff'],
  operations: ['/operations', 'Operations'], communications: ['/communications', 'Communications'], reports: ['/reports', 'Reports'],
  connected_platforms: ['/platforms', 'Connected Platforms'], documents: ['/documents','Documents'], reservations: ['/reservations','Reservations'], automations: ['/automations','Automations'], intelligence: ['/intelligence','Intelligence'],
};

const groups = [
  { label: 'Membership', keys: ['members', 'memberships', 'access'] },
  { label: 'Club Life', keys: ['events', 'amenities', 'tee_sheet', 'golf'] },
  { label: 'Team & Operations', keys: ['staff', 'operations'] },
  { label: 'Engage & Insights', keys: ['communications', 'documents', 'reports', 'intelligence', 'connected_platforms'] },
  { label: 'Platform', keys: ['reservations', 'automations'] },
];

export default function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const path = usePathname();
  const router = useRouter();
  const cacheKey = `nadorio:workspace:${id}`;
  const cached = typeof window !== 'undefined' ? (() => { try { return JSON.parse(sessionStorage.getItem(cacheKey) || 'null'); } catch { return null; } })() : null;
  const [club, setClub] = useState<any>(cached?.club || null);
  const [role, setRole] = useState(cached?.role || '');
  const [mods, setMods] = useState<any[]>(cached?.mods || []);
  const [ready, setReady] = useState(Boolean(cached?.club && cached?.role));
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const destinations = ['', '/people', '/members', '/memberships', '/access', '/events', '/amenities', '/tee-sheet', '/golf', '/staff', '/operations', '/communications', '/documents', '/reservations', '/automations', '/intelligence', '/reports', '/platforms', '/settings'];
    destinations.forEach(s => router.prefetch(`/workspace/${id}${s}`));
    (async () => {
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const [{ data: c }, { data: cu }, { data: p }, { data: isSuper }, { data: m }, { data: perms }] = await Promise.all([
        sb.from('clubs').select('*').eq('id', id).single(),
        sb.from('club_users').select('role,active').eq('club_id', id).eq('user_id', user.id).maybeSingle(),
        sb.from('profiles').select('platform_role').eq('id', user.id).maybeSingle(),
        sb.rpc('is_super_admin'),
        sb.from('club_modules').select('module_key,licensed,club_enabled,nav_label,sort_order').eq('club_id', id).eq('licensed', true).eq('club_enabled', true).order('sort_order'),
        sb.from('club_user_permissions').select('module_key,can_view').eq('club_id', id).eq('user_id', user.id),
      ]);
      const r = (isSuper === true || p?.platform_role === 'super_admin') ? 'super_admin' : cu?.role;
      if (!c || !r || (!cu?.active && r !== 'super_admin')) { router.replace('/login?error=unauthorized'); return; }
      if (c.status !== 'active' && r !== 'super_admin') { await sb.auth.signOut(); router.replace('/login?error=club-inactive'); return; }
      const allowed = new Set((perms || []).filter((x: any) => x.can_view).map((x: any) => x.module_key));
      const visibleMods = (m || []).filter((x: any) => ['owner', 'admin', 'super_admin'].includes(r) || allowed.size === 0 || allowed.has(x.module_key));
      setClub(c); setRole(r); setMods(visibleMods); setReady(true);
      try { sessionStorage.setItem(cacheKey, JSON.stringify({ club: c, role: r, mods: visibleMods })); } catch {}
    })();
  }, [id, router, cacheKey]);

  const map = useMemo(() => new Map(mods.map((x: any) => [x.module_key, x])), [mods]);
  const member = role === 'member';
  const admin = ['owner', 'admin', 'super_admin'].includes(role);
  const closeMobile = () => setMobile(false);
  async function out() { await createClient().auth.signOut(); router.replace('/login'); }

  if (!ready || !club) return <main className="workspaceBoot" aria-label="Opening workspace" />;

  return (
    <div className="workspace v3workspace" style={{ '--club-primary': club.primary_color || '#138cff', '--club-accent': club.secondary_color || '#19d9e8', '--club-bg': club.background_color || '#07111f', '--club-surface': club.surface_color || '#0d1b2a', '--club-text': club.text_color || '#f4f8ff' } as React.CSSProperties}>
      <header className="v3MobileHeader">
        <div className="clubBrand mini">{club.logo_url ? <img src={club.logo_url} alt="" /> : <div className="clubMark">{club.name.slice(0, 2).toUpperCase()}</div>}<b>{club.name}</b></div>
        <button type="button" onClick={() => setMobile(!mobile)} aria-label="Toggle menu">{mobile ? <X /> : <Menu />}</button>
      </header>
      <aside className={`sidebar clubSidebar v3Sidebar ${mobile ? 'mobileOpen' : ''}`}>
        <div className="clubBrand">{club.logo_url ? <img src={club.logo_url} alt="" /> : <div className="clubMark">{club.name.slice(0, 2).toUpperCase()}</div>}<div><b>{club.name}</b><span>{member ? (club.organization_type==='hoa'?'Resident Portal':'Member Portal') : 'Organization Management'}</span></div></div>
        <nav className="nav v3Nav">
          {club.organization_type && club.organization_type !== 'private_club' && <Link className={path === `/workspace/${id}/industry` ? 'active' : ''} href={`/workspace/${id}/industry`} onClick={closeMobile}><Building2 size={18}/> Industry Hub</Link>}<Link className={`v3NavHome ${path === `/workspace/${id}` ? 'active' : ''}`} href={`/workspace/${id}`} onClick={closeMobile}><Home size={18} /> Home</Link>
          {member ? (
            <><div className="v3NavGroup"><span>MY ACCOUNT</span><Link className={path === `/workspace/${id}/profile` ? 'active' : ''} href={`/workspace/${id}/profile`} onClick={closeMobile}><UserRound size={16}/> My Profile</Link><Link className={path === `/workspace/${id}/directory` ? 'active' : ''} href={`/workspace/${id}/directory`} onClick={closeMobile}><UsersRound size={16}/> Member Directory</Link><Link className={path === `/workspace/${id}/card` ? 'active' : ''} href={`/workspace/${id}/card`} onClick={closeMobile}><CreditCard size={16}/> Membership Card</Link><Link className={path === `/workspace/${id}/household` ? 'active' : ''} href={`/workspace/${id}/household`} onClick={closeMobile}><UsersRound size={16}/> My Household</Link><Link className={path === `/workspace/${id}/notifications` ? 'active' : ''} href={`/workspace/${id}/notifications`} onClick={closeMobile}><Bell size={16}/> Notifications</Link></div><div className="v3NavGroup"><span>MY ORGANIZATION</span>{['events', 'tee_sheet', 'amenities', 'reservations', 'documents', 'communications'].filter(k => map.has(k)).map(k => { const [s, l] = defs[k]; return <Link key={k} className={path === `/workspace/${id}${s}` ? 'active' : ''} href={`/workspace/${id}${s}`} onClick={closeMobile}>{l}</Link>; })}</div></>
          ) : (
            <>
              {admin && <div className="v3NavGroup"><span>MEMBER MANAGEMENT</span><Link className={path === `/workspace/${id}/people` ? 'active' : ''} href={`/workspace/${id}/people`} onClick={closeMobile}><ShieldCheck size={16} /> People & Approvals</Link></div>}
              {groups.map(g => { const items = g.keys.filter(k => map.has(k)); if (!items.length) return null; return <div className="v3NavGroup" key={g.label}><span>{g.label.toUpperCase()}</span>{items.map(k => { const [s, l] = defs[k]; const mod: any = map.get(k); return <Link key={k} className={path === `/workspace/${id}${s}` ? 'active' : ''} href={`/workspace/${id}${s}`} onClick={closeMobile}>{mod?.nav_label || l}</Link>; })}</div>; })}
            </>
          )}
          {admin && <div className="v3NavGroup"><span>ADMINISTRATION</span><Link className={path === `/workspace/${id}/settings` ? 'active' : ''} href={`/workspace/${id}/settings`} onClick={closeMobile}><Settings size={16} /> Club Settings</Link><Link className={path === `/workspace/${id}/audit` ? 'active' : ''} href={`/workspace/${id}/audit`} onClick={closeMobile}><ShieldCheck size={16}/> Audit & Security</Link></div>}
        </nav>
        <div className="sidefoot"><NadorioLogo /><div className="version">NADORIO 6.1 · {role.replace('_', ' ')}</div><button className="signout" onClick={out}><LogOut size={15} /> Sign out</button></div>
      </aside>
      <main className="main clubMain v3Main">{children}</main>
      {member && <nav className="memberBottomNav"><Link href={`/workspace/${id}`}><Home /><span>Home</span></Link><Link href={`/workspace/${id}/card`}><CreditCard/><span>Card</span></Link><Link href={`/workspace/${id}/notifications`}><Bell/><span>Alerts</span></Link><Link href={`/workspace/${id}/profile`}><UserRound/><span>Profile</span></Link>{map.has('events') && <Link href={`/workspace/${id}/events`}><CalendarDays /><span>Events</span></Link>}{map.has('tee_sheet') && <Link href={`/workspace/${id}/tee-sheet`}><Clock3 /><span>Tee Times</span></Link>}{map.has('golf') && <Link href={`/workspace/${id}/golf`}><Flag /><span>Golf</span></Link>}</nav>}
    </div>
  );
}
