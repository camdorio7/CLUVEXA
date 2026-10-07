'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, ShieldCheck, Users, UserRound } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import NadorioLogo from '../../components/NadorioLogo';
import { createClient } from '../../lib/supabase/client';

function LoginContent() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (params.get('error')) setMsg('This account is not authorized for that area of NADORIO.');
  }, [params]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg('');
    const sb = createClient();
    const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) { setMsg(error?.message || 'Unable to sign in.'); setBusy(false); return; }

    const next = params.get('next');
    if (next && next.startsWith('/')) { router.replace(next); router.refresh(); return; }

    const [{ data: isSuper }, { data: profile }] = await Promise.all([
      sb.rpc('is_super_admin'),
      sb.from('profiles').select('platform_role').eq('id', data.user.id).maybeSingle(),
    ]);
    if (isSuper === true || profile?.platform_role === 'super_admin') { router.replace('/dashboard'); router.refresh(); return; }

    const { data: memberships } = await sb.from('club_users').select('club_id, role').eq('user_id', data.user.id).eq('active', true).limit(2);
    if (!memberships?.length) {
      const { data: requests } = await sb.rpc('my_club_join_requests');
      const pending = (requests || []).find((r: any) => r.status === 'pending');
      if (pending) { router.replace('/member/pending'); router.refresh(); return; }
      setMsg('No active club access was found. If you are joining a club, submit a membership application below.');
      setBusy(false); return;
    }
    router.replace('/workspace/' + memberships[0].club_id);
    router.refresh();
  }

  return (
    <main className="authPage">
      <div className="authGlow authGlowOne" />
      <div className="authGlow authGlowTwo" />
      <section className="authShell">
        <header className="authBrand"><NadorioLogo /></header>
        <div className="authCard">
          <div className="authIntro">
            <span className="authEyebrow">SECURE CLUB ACCESS</span>
            <h1>Welcome back</h1>
            <p>Sign in to access your club.</p>
          </div>

          <div className="authAudience" aria-label="NADORIO account types">
            <span><UserRound size={15}/> Members</span>
            <span><Users size={15}/> Staff</span>
            <span><ShieldCheck size={15}/> Club Admins</span>
          </div>

          <form className="authForm" onSubmit={submit}>
            <label className="authField">
              <span>Email address</span>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required autoComplete="email" placeholder="you@example.com" />
            </label>
            <label className="authField">
              <span>Password</span>
              <div className="passwordField">
                <input value={password} onChange={(e) => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} required autoComplete="current-password" placeholder="Enter your password" />
                <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={18}/> : <Eye size={18}/>}</button>
              </div>
            </label>
            <div className="authUtilityRow"><a className="authUtilityLink" href="/forgot-password">Forgot password?</a></div>
            {msg && <div className="authError">{msg}</div>}
            <button className="authPrimary" disabled={busy}><LockKeyhole size={17}/>{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>

          <div className="authJoin">
            <div><strong>Joining a club?</strong><span>Create your NADORIO account and request membership.</span></div>
            <a href="/member/join">Create an account <span>→</span></a>
          </div>
        </div>
        <footer className="authFooter"><span>Secure access powered by NADORIO</span><span>CD7 Technologies</span></footer>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<main className="authPage"><section className="authShell"><header className="authBrand"><NadorioLogo /></header></section></main>}><LoginContent /></Suspense>;
}
