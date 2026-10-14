"use client";
import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LockKeyhole } from "lucide-react";
import NadorioLogo from "../../components/NadorioLogo";
import { createClient } from "../../lib/supabase/client";
export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState(""),
    [message, setMessage] = useState("");
  const [ready, setReady] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let live = true;
    let unsubscribe: (() => void) | undefined;
    try {
      const sb = createClient();
      sb.auth
        .getUser()
        .then(({ data, error }) => {
          if (!live) return;
          setReady(!error && !!data.user);
          setLoading(false);
        })
        .catch(() => {
          if (live) {
            setMessage("Unable to verify your reset link. Please retry.");
            setLoading(false);
          }
        });
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        if (live && session) {
          setReady(true);
          setLoading(false);
        }
      });
      unsubscribe = () => data.subscription.unsubscribe();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to open password recovery.",
      );
      setLoading(false);
    }
    return () => {
      live = false;
      unsubscribe?.();
    };
  }, []);
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (password.length < 8) return setMessage("Use at least 8 characters.");
    if (password !== confirmation)
      return setMessage("The passwords do not match.");
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) throw error;
      router.replace("/organizations");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to update your password. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="authPage">
      <section className="authShell">
        <header className="authBrand">
          <NadorioLogo />
        </header>
        <div className="authCard">
          <div className="authIntro">
            <span className="authEyebrow">SECURE ACCOUNT</span>
            <h1>Create a new password</h1>
            <p>
              {loading
                ? "Opening your secure link…"
                : ready
                  ? "Choose a new password for your NADORIO account."
                  : "Your reset link is missing or has expired. Request a new link and open it in the browser where you requested it."}
            </p>
          </div>
          {message && (
            <div className="authError" role="alert">
              {message}
            </div>
          )}
          {ready && (
            <form className="authForm" onSubmit={submit}>
              <label className="authField">
                <span>New password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="authField">
                <span>Confirm password</span>
                <input
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                />
              </label>
              <button className="authPrimary" disabled={busy}>
                <LockKeyhole size={17} />
                {busy ? "Saving…" : "Save new password"}
              </button>
            </form>
          )}
          {!loading && !ready && (
            <div className="authJoin">
              <Link href="/forgot-password">Request a new reset link</Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
