import { NextResponse } from "next/server";
import { serviceClient, apiError } from "../../../../lib/server-access";
import { requireScheduler } from "../../../../lib/scheduler-auth";
export async function GET(req: Request) {
  try {
    requireScheduler(req);
    const sb = serviceClient();
    const [heartbeat, queued, failed] = await Promise.all([
      sb
        .from("job_heartbeats")
        .select("finished_at,status")
        .eq("name", "email")
        .maybeSingle(),
      sb
        .from("email_deliveries")
        .select("id", { count: "exact", head: true })
        .in("status", ["queued", "retry", "sending"])
        .lt("created_at", new Date(Date.now() - 15 * 60000).toISOString()),
      sb
        .from("email_deliveries")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed")
        .gt("updated_at", new Date(Date.now() - 86400000).toISOString()),
    ]);
    if (heartbeat.error || queued.error || failed.error)
      throw heartbeat.error || queued.error || failed.error;
    const fresh =
      !!heartbeat.data?.finished_at &&
      Date.now() - new Date(heartbeat.data.finished_at).getTime() < 10 * 60000;
    const healthy = fresh && queued.count === 0 && failed.count === 0;
    return NextResponse.json(
      {
        status: healthy ? "ok" : "attention",
        schedulerFresh: fresh,
        overdueEmails: queued.count,
        failedLast24Hours: failed.count,
      },
      {
        status: healthy ? 200 : 503,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (error) {
    return apiError(error);
  }
}
