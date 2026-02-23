import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { systemStats, biometrics } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

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
        cpuUsage: s.cpu_usage ?? null,
        memoryUsage: s.memory_usage ?? null,
        diskUsage: s.disk_usage ?? null,
        bytesSent: s.network_usage[0] ?? null,
        bytesRecv: s.network_usage[1] ?? null,
        batteryPercent: s.battery_info?.percent ?? null,
        batteryCharging: s.battery_info?.is_charging ?? null,
        portsServices: s.ports_services ?? null,
      });
    }

    if (payload.biometrics) {
      const b = payload.biometrics;
      const recordDate = payload.date
        ? new Date(payload.date + "T12:00:00")
        : new Date();

      // Check if a record for this date already exists
      const dateStr = recordDate.toISOString().slice(0, 10);
      const existing = await db
        .select({ id: biometrics.id })
        .from(biometrics)
        .where(
          sql`DATE(${biometrics.recordedAt}) = ${dateStr}`
        )
        .limit(1);

      if (existing.length > 0) {
        // Update existing record
        await db
          .update(biometrics)
          .set({
            sleepHours: b.sleep_hours ?? null,
            sleepHr: b.sleep_hr ?? null,
            hrvMs: b.hrv_ms ?? null,
            restingHr: b.resting_hr ?? null,
            steps: b.steps ?? null,
            activities: b.activities ?? null,
          })
          .where(eq(biometrics.id, existing[0].id));
      } else {
        // Insert new record
        await db.insert(biometrics).values({
          sleepHours: b.sleep_hours ?? null,
          sleepHr: b.sleep_hr ?? null,
          hrvMs: b.hrv_ms ?? null,
          restingHr: b.resting_hr ?? null,
          steps: b.steps ?? null,
          activities: b.activities ?? null,
          recordedAt: recordDate,
        });
      }
    }

    console.log("✅ Ingest complete");
    return NextResponse.json({ message: "Data ingested", status: 200 });
  } catch (error) {
    console.error("Ingest error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
