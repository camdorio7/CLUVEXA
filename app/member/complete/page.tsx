"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import NadorioLogo from "../../../components/NadorioLogo";
import { createClient } from "../../../lib/supabase/client";
function Complete() {
  const query = useSearchParams(),
    router = useRouter();
  const [message, setMessage] = useState(
    "Finishing your membership application…",
  );
  const [failed, setFailed] = useState(false),
    [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    setFailed(false);
    setMessage("Finishing your membership application…");
    (async () => {
      try {
        const sb = createClient();
        const {
          data: { user },
          error: authError,
        } = await sb.auth.getUser();
        if (!live) return;
        if (!user) {
          router.replace(
            `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
          );
          return;
        }
        if (authError) throw authError;
        const club = query.get("club"),
          plan = query.get("plan");
        if (!club || !plan)
          throw new Error(
            "The organization or membership level was not included. Start a new application.",
          );
        const name =
          query.get("name") ||
          user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Member";
        const { error } = await sb.rpc("request_club_membership_v41", {
          target_club: club,
          requested_membership_type: plan,
          requested_name: name,
          requested_note: query.get("note") || null,
          requested_member_number: query.get("number") || null,
        });
        if (!live) return;
        if (error && !error.message.includes("already have access"))
          throw error;
        router.replace(
          error?.message.includes("already have access")
            ? `/workspace/${club}`
            : "/member/pending",
        );
      } catch (error) {
        if (live) {
          setFailed(true);
          setMessage(
            error instanceof Error
              ? error.message
              : typeof (error as { message?: unknown })?.message === "string"
                ? (error as { message: string }).message
                : "Unable to finish your application. Please retry.",
          );
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [query, router, attempt]);
  return (
    <main className="joinPage">
      <div className="joinCard">
        <NadorioLogo />
        <h1>Membership application</h1>
        <p className="joinSub" role={failed ? "alert" : "status"}>
          {message}
        </p>
        {failed && (
          <>
            <button
              className="joinButton"
              onClick={() => setAttempt((v) => v + 1)}
            >
              Try again
            </button>
            <Link href="/member/join">Start a new application</Link>
          </>
        )}
      </div>
    </main>
  );
}
export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="joinPage">
          <div className="joinCard">Loading…</div>
        </main>
      }
    >
      <Complete />
    </Suspense>
  );
}
