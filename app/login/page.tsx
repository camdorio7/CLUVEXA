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
      setMsg('This account is not authorized for the CLUVEXA Super Admin console.');
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

    const { data: profile } = await sb
      .from('profiles')
      .select('platform_role')
      .eq('id', data.user.id)
      .single();

    if (profile?.platform_role !== 'super_admin') {
      await sb.auth.signOut();
      setMsg('This account is not a CLUVEXA Super Admin.');
      setBusy(false);
      return;
    }

    router.replace('/dashboard');
    router.refresh();
  }

  return (
    <main className="loginwrap">
      <div className="loginbrand">CLUVEXA</div>
      <div className="byline dark">BY CD7 TECHNOLOGIES</div>
      <h1>Super Admin</h1>
      <p className="muted">Secure platform access for CD7 Technologies.</p>
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
      </form>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="loginwrap"><div className="loginbrand">CLUVEXA</div><p className="muted">Loading secure access…</p></main>}>
      <LoginContent />
    </Suspense>
  );
}
