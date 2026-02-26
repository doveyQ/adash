import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiInsights } from "@/db/schema";
import { desc, isNotNull, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const historyCount = parseInt(url.searchParams.get("history") || "0", 10);

    // Get latest analysis (mode, nudges, focus, energy curve)
    const latest = await db
      .select()
      .from(aiInsights)
      .orderBy(desc(aiInsights.recordedAt))
      .limit(1);

    const row = latest[0] ?? null;

    // Get the most recent record that has a daily report
    const reportRow = await db
      .select({
        dailyReport: aiInsights.dailyReport,
        recordedAt: aiInsights.recordedAt,
      })
      .from(aiInsights)
      .where(isNotNull(aiInsights.dailyReport))
      .orderBy(desc(aiInsights.recordedAt))
      .limit(1);

    const latestReport = reportRow[0] ?? null;

    // If history is requested, fetch recent insights for AI memory
    let insightHistory: { nudges: unknown; mode: string | null; recordedAt: string }[] = [];
    if (historyCount > 0) {
      const historyRows = await db
        .select({
          nudges: aiInsights.nudges,
          mode: aiInsights.mode,
          recordedAt: aiInsights.recordedAt,
        })
        .from(aiInsights)
        .where(isNotNull(aiInsights.nudges))
        .orderBy(desc(aiInsights.recordedAt))
        .limit(historyCount + 1); // +1 because the latest is the current one

      // Skip the very latest (that's the current cycle) and return previous ones
      insightHistory = historyRows.slice(1).map((r) => ({
        nudges: r.nudges,
        mode: r.mode,
        recordedAt: r.recordedAt.toISOString(),
      }));
    }

    return NextResponse.json({
      mode: row?.mode ?? null,
      nudges: row?.nudges ?? [],
      flowPrediction: row?.flowPrediction ?? null,
      focusUnitsRemaining: row?.focusUnitsRemaining ?? null,
      dailyReport: latestReport?.dailyReport ?? null,
      dailyReportDate: latestReport?.recordedAt?.toISOString()?.slice(0, 10) ?? null,
      triggerAlerts: row?.triggerAlerts ?? null,
      lastAnalysis: row?.recordedAt?.toISOString() ?? null,
      ...(historyCount > 0 ? { insightHistory } : {}),
    });
  } catch (error) {
    console.error("Insights query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
