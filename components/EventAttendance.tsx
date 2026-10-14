"use client";
import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";
export default function EventAttendance({
  clubId,
  eventId,
}: {
  clubId: string;
  eventId: string;
}) {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(0),
    [rows, setRows] = useState<any[]>([]),
    [count, setCount] = useState(0),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!open) return;
    let live = true;
    (async () => {
      const { data, error, count } = await createClient()
        .from("event_registrations")
        .select("id,attendee_name,status,attended_at", { count: "exact" })
        .eq("club_id", clubId)
        .eq("event_id", eventId)
        .in("status", ["registered", "waitlisted"])
        .order("created_at")
        .order("id")
        .range(page * 50, page * 50 + 49);
      if (live) {
        if (error) setMessage(error.message);
        else {
          setRows(data || []);
          setCount(count || 0);
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [open, page, clubId, eventId, revision]);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Attendance & waitlist</summary>
      {message && <p role="status">{message}</p>}
      {rows.map((r) => (
        <div className="v12Actions" key={r.id}>
          <span>
            {r.attendee_name || "Member"} · {r.status}
          </span>
          {r.status === "registered" && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const { error } = await createClient().rpc("v12_attendance", {
                    registration_id: r.id,
                    present: !r.attended_at,
                  });
                  if (error) throw error;
                  setRevision((v) => v + 1);
                } catch (e: any) {
                  setMessage(e.message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {r.attended_at ? "Undo check-in" : "Mark attended"}
            </button>
          )}
        </div>
      ))}
      <div className="v12Actions">
        <button disabled={!page || busy} onClick={() => setPage((p) => p - 1)}>
          Previous attendees
        </button>
        <span>
          {count} total · page {page + 1}
        </span>
        <button
          disabled={(page + 1) * 50 >= count || busy}
          onClick={() => setPage((p) => p + 1)}
        >
          Next attendees
        </button>
        <button onClick={() => setRevision((v) => v + 1)}>
          Refresh attendees
        </button>
      </div>
    </details>
  );
}
