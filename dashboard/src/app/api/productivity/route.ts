import { NextResponse } from "next/server";
import { db } from "@/db";
import { productivityLogs, biometrics, coachSnapshots } from "@/db/schema";
import { desc, sql, isNotNull, and } from "drizzle-orm";
import { PRODUCTIVE_PREFIXES } from "@/lib/constants";
import { withCacheHeaders } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Today's logs for timeline
    const logs = await db
      .select()
      .from(productivityLogs)
      .where(sql`${productivityLogs.recordedAt} >= ${since24h}`)
      .orderBy(desc(productivityLogs.recordedAt))
      .limit(200);

    // 7-day logs for sweet spot analysis
    const weekLogs = await db
      .select({
        activeWindow: productivityLogs.activeWindow,
        ideTimeMinutes: productivityLogs.ideTimeMinutes,
        recordedAt: productivityLogs.recordedAt,
      })
      .from(productivityLogs)
      .where(sql`${productivityLogs.recordedAt} >= ${since7d}`)
      .orderBy(desc(productivityLogs.recordedAt))
      .limit(2000);

    // Get today's biometrics for correlation pairing
    const todayBio = await db
      .select({ hrvMs: biometrics.hrvMs, restingHr: biometrics.restingHr })
      .from(biometrics)
      .where(sql`${biometrics.recordedAt} >= ${since24h}`)
      .orderBy(desc(biometrics.recordedAt))
      .limit(1);

    const hrvMs = todayBio[0]?.hrvMs ?? null;

    // Build correlation: every productivity log with IDE time > 0 paired with HRV
    let correlation: { time: string; ideTimeMinutes: number | null; hrvMs: number | null }[] = [];

    if (hrvMs !== null) {
      correlation = logs
        .filter((l) => l.ideTimeMinutes != null && l.ideTimeMinutes > 0)
        .map((l) => ({
          time: l.recordedAt.toISOString(),
          ideTimeMinutes: l.ideTimeMinutes,
          hrvMs,
        }));
    }

    // If no productivity-based correlation, try coachSnapshots
    if (correlation.length === 0) {
      const snapshots = await db
        .select({
          ideTimeMinutes: coachSnapshots.ideTimeMinutes,
          hrvMs: coachSnapshots.hrvMs,
          recordedAt: coachSnapshots.recordedAt,
        })
        .from(coachSnapshots)
        .where(
          and(
            sql`${coachSnapshots.recordedAt} >= ${since24h}`,
            isNotNull(coachSnapshots.ideTimeMinutes),
            isNotNull(coachSnapshots.hrvMs)
          )
        )
        .orderBy(desc(coachSnapshots.recordedAt))
        .limit(100);

      correlation = snapshots.map((s) => ({
        time: s.recordedAt.toISOString(),
        ideTimeMinutes: s.ideTimeMinutes,
        hrvMs: s.hrvMs,
      }));
    }

    // Get latest app durations from the most recent log that has them
    const latestWithDurations = logs.find((l) => l.appDurations != null);
    const appDurations = latestWithDurations?.appDurations ?? null;

    // ── Sweet Spot Analysis: 7-DAY data grouped by hour ──

    const hourBuckets: Record<
      number,
      { total: number; productive: number; apps: string[]; days: Set<string> }
    > = {};

    for (const l of weekLogs) {
      const hour = l.recordedAt.getHours();
      const dayStr = l.recordedAt.toISOString().slice(0, 10);
      if (!hourBuckets[hour]) {
        hourBuckets[hour] = { total: 0, productive: 0, apps: [], days: new Set() };
      }
      hourBuckets[hour].total++;
      hourBuckets[hour].days.add(dayStr);
      const win = l.activeWindow ?? "";
      if (PRODUCTIVE_PREFIXES.some((p) => win.startsWith(p))) {
        hourBuckets[hour].productive++;
      }
      if (win) hourBuckets[hour].apps.push(win);
    }

    const hourStats = Object.entries(hourBuckets)
      .map(([h, b]) => {
        const apps = b.apps;
        const topApp =
          apps.length > 0
            ? [...new Set(apps)]
              .map((a) => ({ app: a, count: apps.filter((x) => x === a).length }))
              .sort((a, b) => b.count - a.count)[0]?.app ?? "unknown"
            : "unknown";
        return {
          hour: parseInt(h, 10),
          productiveRatio: Math.round((b.productive / Math.max(b.total, 1)) * 100) / 100,
          totalEntries: b.total,
          daysTracked: b.days.size,
          topApp: topApp.slice(0, 40),
        };
      })
      .sort((a, b) => a.hour - b.hour);

    // Find peak windows
    const topWindows = hourStats
      .filter((h) => h.productiveRatio > 0.5)
      .sort((a, b) => b.productiveRatio - a.productiveRatio)
      .slice(0, 3);

    return withCacheHeaders(NextResponse.json({
      timeline: logs.map((l) => ({
        activeWindow: l.activeWindow,
        browserTab: l.browserTab,
        ideTimeMinutes: l.ideTimeMinutes,
        calendarEvent: l.calendarEvent,
        appDurations: l.appDurations,
        recordedAt: l.recordedAt.toISOString(),
      })),
      correlation,
      appDurations,
      sweetSpotAnalysis: {
        hourStats,
        topWindows,
        dataRange: "7d",
      },
    }));
  } catch (error) {
    console.error("Productivity query error:", error);
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }
}
