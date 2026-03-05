import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { aiInsights } from "@/db/schema";
import { requireApiKey } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const authError = requireApiKey(req);
  if (authError) return authError;

  try {
    const payload = await req.json();

    await db.insert(aiInsights).values({
      mode: payload.mode,
      nudges: payload.nudges ?? null,
      flowPrediction: payload.flow_prediction ?? null,
      focusUnitsRemaining: payload.focus_units_remaining ?? null,
      dailyReport: payload.daily_report ?? null,
      triggerAlerts: payload.trigger_alerts ?? null,
      analysisData: payload.analysis_data ?? null,
    });

    return NextResponse.json({ message: "Analysis stored", status: 200 });
  } catch (error) {
    console.error("AI analyze error:", error);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}
