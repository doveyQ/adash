import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { coachSnapshots } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const data = await db
      .select()
      .from(coachSnapshots)
      .where(sql`${coachSnapshots.recordedAt} >= ${since}`)
      .orderBy(desc(coachSnapshots.recordedAt))
      .limit(500);

    return NextResponse.json({
      snapshots: data.map((d) => ({
        hrvMs: d.hrvMs,
        restingHr: d.restingHr,
        sleepHours: d.sleepHours,
        steps: d.steps,
        activeWindow: d.activeWindow,
        ideTimeMinutes: d.ideTimeMinutes,
        cpuUsage: d.cpuUsage,
        memoryUsage: d.memoryUsage,
        commitCount: d.commitCount,
        frustrationScore: d.frustrationScore,
        mode: d.mode,
        focusUnitsRemaining: d.focusUnitsRemaining,
        recordedAt: d.recordedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Coach history query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.API_KEY}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await req.json();

    await db.insert(coachSnapshots).values({
      hrvMs: payload.hrv_ms ?? null,
      restingHr: payload.resting_hr ?? null,
      sleepHours: payload.sleep_hours ?? null,
      steps: payload.steps ?? null,
      activeWindow: payload.active_window ?? null,
      ideTimeMinutes: payload.ide_time_minutes ?? null,
      cpuUsage: payload.cpu_usage ?? null,
      memoryUsage: payload.memory_usage ?? null,
      commitCount: payload.commit_count ?? null,
      frustrationScore: payload.frustration_score ?? null,
      mode: payload.mode ?? null,
      focusUnitsRemaining: payload.focus_units_remaining ?? null,
    });

    return NextResponse.json({ message: "Snapshot stored", status: 200 });
  } catch (error) {
    console.error("Coach snapshot error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
