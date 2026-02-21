import { NextResponse } from "next/server";
import { db } from "@/db";
import { systemStats, biometrics } from "@/db/schema";
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

    return NextResponse.json({
      systemStats: latestSystem
        ? {
          cpu_usage: latestSystem.cpuUsage,
          memory_usage: latestSystem.memoryUsage,
          disk_usage: latestSystem.diskUsage,
          network_usage: [latestSystem.bytesSent, latestSystem.bytesRecv],
          battery_info: {
            percent: latestSystem.batteryPercent,
            is_charging: latestSystem.batteryCharging,
          },
          ports_services: latestSystem.portsServices,
        }
        : null,
      biometrics: latestBio
        ? {
          sleep_hours: latestBio.sleepHours,
          hrv_ms: latestBio.hrvMs,
          resting_hr: latestBio.restingHr,
          sleep_hr: latestBio.sleepHr,
          steps: latestBio.steps,
          activities: latestBio.activities,
        }
        : null,
      lastUpdate: latestSystem.recordedAt.toISOString(),
    });
  } catch (error) {
    console.error("Status query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}