import { NextRequest, NextResponse } from "next/server";
import { requireScheduler } from "../../../../lib/scheduler-auth";
import {
  serviceClient,
  apiError,
  HttpError,
} from "../../../../lib/server-access";
import { processEmailJob } from "../../../../lib/email-worker";
import { withRequestTimeout } from "../../../../lib/request-fetch";
export const maxDuration = 60;
export async function GET(req: NextRequest) {
  try {
    requireScheduler(req);
    if (!process.env.RESEND_API_KEY)
      throw new HttpError(503, "Email delivery is not configured.");
    const sb = serviceClient(5000),
      start = Date.now();
    let processed = 0;
    const heartbeat = await sb.from("job_heartbeats").upsert({
      name: "email",
      started_at: new Date().toISOString(),
      status: "running",
    });
    if (heartbeat.error) throw heartbeat.error;
    const reminders = await sb.rpc("v12_queue_reminders");
    if (reminders.error) throw reminders.error;
    while (processed < 20 && Date.now() - start < 20000) {
      const { data: job, error } = await sb.rpc("v12_claim_email");
      if (error) throw error;
      if (!job) break;
      await processEmailJob(sb, job, withRequestTimeout(8000));
      processed++;
      await new Promise((resolve) => setTimeout(resolve, 550));
    }
    const saved = await sb
      .from("job_heartbeats")
      .update({
        finished_at: new Date().toISOString(),
        status: "complete",
        details: { processed, reminders: reminders.data },
      })
      .eq("name", "email");
    if (saved.error) throw saved.error;
    return NextResponse.json(
      { processed, reminders: reminders.data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return apiError(error);
  }
}
