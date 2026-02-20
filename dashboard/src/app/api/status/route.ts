import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemStats, biometrics, workflow } from "@/db/schema";
import { desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [latestSystem] = await db
      .select()
      .from(systemStats)
      .orderBy(desc(systemStats.recordedAt))
      .limit(1);

    if (!latestSystem) {
      return NextResponse.json({});
    }

    const [latestBio] = await db
      .select()
      .from(biometrics)
      .orderBy(desc(biometrics.recordedAt))
      .limit(1);

    const [latestWorkflow] = await db
      .select()
      .from(workflow)
      .orderBy(desc(workflow.recordedAt))
      .limit(1);

    return NextResponse.json({
      cpu_usage: latestSystem.cpuUsage,
      memory_usage: latestSystem.memoryUsage,
      disk_usage: latestSystem.diskUsage,
      network_usage: [latestSystem.bytesSent, latestSystem.bytesRecv],
      battery_info: {
        percent: latestSystem.batteryPercent,
        is_charging: latestSystem.batteryCharging,
      },
      ports_services: latestSystem.portsServices,
      biometrics: latestBio
        ? {
          sleep_hours: latestBio.sleepHours,
          hrv_ms: latestBio.hrvMs,
          calories: latestBio.calories,
          heart_rate_bpm: latestBio.heartRateBpm,
          activity_summary: latestBio.activitySummary,
        }
        : null,
      workflow: latestWorkflow
        ? {
          github_commits: latestWorkflow.githubCommits,
          github_issues: latestWorkflow.githubIssues,
          project_stats: latestWorkflow.projectStats,
          calendar_entries: latestWorkflow.calendarEntries,
        }
        : null,
      lastUpdate: latestSystem.recordedAt.toISOString(),
    });
  } catch (error) {
    console.error("Status query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}