"use client";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../lib/supabase/client";
import { authCallbackUrl } from "../../lib/auth-navigation";
import NadorioLogo from "../../components/NadorioLogo";
function JoinContent() {
  const query = useSearchParams(),
    router = useRouter(),
    token = query.get("token") || "";
  const [invite, setInvite] = useState<any>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState("");
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [confirmation, setConfirmation] = useState(false),
    [sessionEmail, setSessionEmail] = useState("");
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!token) return;
        const sb = createClient();
        const [{ data, error }, { data: session }] = await Promise.all([
          sb.rpc("get_public_club_invitation", { invite_token: token }),
          sb.auth.getUser(),
        ]);
        if (!live) return;
        if (error) throw new Error(error.message);
        const row = Array.isArray(data) ? data[0] : data;
        setInvite(row || null);
        setName(row?.full_name || "");
        setSessionEmail(session.user?.email || "");
      } catch (error) {
        if (live)
          setLoadError(
            error instanceof Error
              ? error.message
              : "Unable to load your invitation. Please reload.",
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [token]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !invite) return;
    setBusy(true);
    setMessage("");
    try {
      const sb = createClient();
      if (!sessionEmail) {
        if (mode === "signin") {
          const { error } = await sb.auth.signInWithPassword({
            email: invite.email,
            password,
          });
          if (error) throw new Error(error.message);
          setSessionEmail(invite.email);
        } else {
          const origin =
            process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
          const { data, error } = await sb.auth.signUp({
            email: invite.email,
            password,
            options: {
              data: { full_name: name },
              emailRedirectTo: authCallbackUrl(
                origin,
                `/join?token=${encodeURIComponent(token)}`,
              ),
            },
          });
          if (error) throw new Error(error.message);
          if (!data.session) {
            setConfirmation(true);
            return;
          }
          setSessionEmail(invite.email);
        }
      }
      const { data: club, error } = await sb.rpc("accept_club_invitation", {
        invite_token: token,
      });
      if (error) throw new Error(error.message);
      if (!club)
        throw new Error("The invitation could not be accepted. Please retry.");
      router.replace(`/workspace/${club}`);
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to accept your invitation. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function switchAccount() {
    setBusy(true);
    setMessage("");
    try {
      const { error } = await createClient().auth.signOut();
      if (error) throw new Error(error.message);
      setSessionEmail("");
      setMode("signin");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to sign out. Please retry.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <main className="joinPage">
        <div className="joinCard" role="status">
          Loading your invitation…
        </div>
      </main>
    );
  if (!invite)
    return (
      <main className="joinPage">
        <div className="joinCard">
          <NadorioLogo />
          <h1>
            {loadError ? "Unable to load invitation" : "Invitation unavailable"}
          </h1>
          <p className="joinSub" role={loadError ? "alert" : undefined}>
            {loadError ||
              "This invitation is invalid, expired, or already used. Ask your organization administrator to resend it."}
          </p>
        </div>
      </main>
    );
  const wrongAccount =
    sessionEmail &&
    sessionEmail.toLowerCase() !== String(invite.email).toLowerCase();
  return (
    <main className="joinPage">
      <section className="joinCard">
        <div className="joinBrand">
          <NadorioLogo />
        </div>
        <div className="joinClub">
          {invite.club_logo_url && (
            <img className="joinLogo" src={invite.club_logo_url} alt="" />
          )}
          <div>
            <span>YOU’RE INVITED TO</span>
            <strong>{invite.club_name || "Your organization"}</strong>
          </div>
        </div>
        <h1>
          {confirmation
            ? "Check your email"
            : sessionEmail
              ? "Accept your invitation"
              : mode === "signin"
                ? "Sign in to accept"
                : "Create your NADORIO account"}
        </h1>
        {confirmation ? (
          <>
            <p className="joinSub" role="status">
              If a new account was created, a confirmation link has been sent to{" "}
              {invite.email}. Open it in this browser to finish joining. If you
              already have an account, sign in below.
            </p>
            <button
              className="joinButton"
              onClick={() => {
                setConfirmation(false);
                setMode("signin");
              }}
            >
              Sign in to an existing account
            </button>
          </>
        ) : (
          <>
            <p className="joinSub">
              {wrongAccount
                ? `You are signed in as ${sessionEmail}. This invitation is for ${invite.email}.`
                : `This invitation was sent to ${invite.email}.`}
            </p>
            {wrongAccount ? (
              <button
                className="joinButton"
                disabled={busy}
                onClick={switchAccount}
              >
                Use another account
              </button>
            ) : (
              <form className="joinForm" onSubmit={submit}>
                {!sessionEmail && (
                  <>
                    {mode === "create" && (
                      <label>
                        Full name
                        <input
                          autoComplete="name"
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </label>
                    )}
                    <label>
                      Email address
                      <input
                        type="email"
                        autoComplete="email"
                        value={invite.email}
                        readOnly
                      />
                    </label>
                    <label>
                      Password
                      <input
                        type="password"
                        autoComplete={
                          mode === "create"
                            ? "new-password"
                            : "current-password"
                        }
                        minLength={mode === "create" ? 8 : undefined}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </label>
                  </>
                )}
                <button className="joinButton" disabled={busy}>
                  {busy
                    ? "Please wait…"
                    : sessionEmail
                      ? "Accept invitation"
                      : mode === "signin"
                        ? "Sign in & accept invitation"
                        : "Create account & accept invitation"}
                </button>
              </form>
            )}
            {!sessionEmail && (
              <button
                className="textButton"
                disabled={busy}
                onClick={() => {
                  setMode(mode === "create" ? "signin" : "create");
                  setMessage("");
                }}
              >
                {mode === "create"
                  ? "Already have an account? Sign in"
                  : "New to NADORIO? Create an account"}
              </button>
            )}
          </>
        )}
        {message && (
          <div className="joinError" role="alert">
            {message}
          </div>
        )}
      </section>
    </main>
  );
}
export default function Join() {
  return (
    <Suspense
      fallback={
        <main className="joinPage">
          <div className="joinCard">Loading your invitation…</div>
        </main>
      }
    >
      <JoinContent />
    </Suspense>
  );
}
