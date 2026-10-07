'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '../../lib/supabase/client';

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get('error')) {
      setMsg('This account is not authorized for the NADORIO Super Admin console.');
    }
  }, [params]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');

    const sb = createClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error || !data.user) {
      setMsg(error?.message || 'Unable to sign in.');
      setBusy(false);
      return;
    }

    const next = params.get('next');
    if (next && next.startsWith('/')) { router.replace(next); router.refresh(); return; }

    // Use the database security-definer helper as the authoritative platform-owner check.
    // This avoids requiring a club_users membership for CD7 Platform Owners.
    const [{ data: isSuper }, { data: profile }] = await Promise.all([
      sb.rpc('is_super_admin'),
      sb.from('profiles').select('platform_role').eq('id', data.user.id).maybeSingle(),
    ]);

    if (isSuper === true || profile?.platform_role === 'super_admin') {
      router.replace('/dashboard');
      router.refresh();
      return;
    }

    const { data: clubUser } = await sb.from('club_users').select('club_id').eq('user_id', data.user.id).eq('active', true).limit(1).maybeSingle();
    if (!clubUser?.club_id) {
      const { data: requests } = await sb.rpc('my_club_join_requests');
      const pending = (requests || []).find((r: any) => r.status === 'pending');
      if (pending) { router.replace('/member/pending'); router.refresh(); return; }
      setMsg('No active club access was found. You can request membership from the Join a Club page.');
      setBusy(false);
      return;
    }
    router.replace('/workspace/' + clubUser.club_id);
    router.refresh();
  }

  return (
    <main className="loginwrap">
      <div className="loginbrand">NADORIO</div>
      <div className="byline dark">BY CD7 TECHNOLOGIES</div>
      <h1>Sign in</h1>
      <p className="muted">One secure sign-in for members, staff, club administrators and platform owners.</p>
      <form className="form loginform" onSubmit={submit}>
        <div className="field">
          <label>Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" />
        </div>
        <div className="field">
          <label>Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required autoComplete="current-password" />
        </div>
        {msg && <div className="error">{msg}</div>}
        <button className="button" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
        <div className="loginJoin">New to NADORIO? <a href="/member/join">Create an account & apply to your club →</a></div>
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="loginwrap"><div className="loginbrand">NADORIO</div><p className="muted">Loading secure access…</p></main>}>
      <LoginContent />
    </Suspense>
  );
}
