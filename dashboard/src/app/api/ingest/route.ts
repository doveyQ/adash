import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemStats, biometrics, workflow } from "@/db/schema";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");

  if (authHeader !== `Bearer ${process.env.API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();

    if (payload.system) {
      const s = payload.system;
      await db.insert(systemStats).values({
        cpuUsage: s.cpu_usage,
        memoryUsage: s.memory_usage,
        diskUsage: s.disk_usage,
        bytesSent: s.network_usage[0],
        bytesRecv: s.network_usage[1],
        batteryPercent: s.battery_info?.percent ?? null,
        batteryCharging: s.battery_info?.is_charging ?? null,
        portsServices: s.ports_services ?? null,
      });
    }

    if (payload.biometrics) {
      const b = payload.biometrics;
      await db.insert(biometrics).values({
        sleepHours: b.sleep_hours,
        hrvMs: b.hrv_ms,
        calories: b.calories,
        heartRateBpm: b.heart_rate_bpm,
        activitySummary: b.activity_summary,
      });
    }

    if (payload.workflow) {
      const w = payload.workflow;
      await db.insert(workflow).values({
        githubCommits: w.github_commits,
        githubIssues: w.github_issues,
        projectStats: w.project_stats,
        calendarEntries: w.calendar_entries,
      });
    }

    console.log("✅ Ingest complete");
    return NextResponse.json({ message: "Data ingested", status: "ok" });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
