import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { activitySnapshots } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const dateParam = req.nextUrl.searchParams.get("date");

        let query;
        if (dateParam) {
            query = db
                .select()
                .from(activitySnapshots)
                .where(sql`DATE(${activitySnapshots.recordedAt}) = ${dateParam}`)
                .orderBy(desc(activitySnapshots.recordedAt));
        } else {
            // Last 24 hours of snapshots
            query = db
                .select()
                .from(activitySnapshots)
                .where(
                    sql`${activitySnapshots.recordedAt} >= NOW() - INTERVAL '24 hours'`
                )
                .orderBy(desc(activitySnapshots.recordedAt));
        }

        const records = await query;

        if (!records.length) {
            return NextResponse.json({
                activity: null,
                snapshots: [],
                date: dateParam || new Date().toISOString().slice(0, 10),
            });
        }

        // Aggregate all snapshots into a daily summary
        const totalFocus = records.reduce(
            (s, r) => s + (r.focusMinutes ?? 0),
            0
        );
        const totalComm = records.reduce(
            (s, r) => s + (r.communicationMinutes ?? 0),
            0
        );
        const totalBrowsing = records.reduce(
            (s, r) => s + (r.browsingMinutes ?? 0),
            0
        );
        const totalIdle = records.reduce(
            (s, r) => s + (r.idleMinutes ?? 0),
            0
        );
        const totalOther = records.reduce(
            (s, r) => s + (r.otherMinutes ?? 0),
            0
        );

        // Most common top app
        const appCounts: Record<string, number> = {};
        for (const r of records) {
            if (r.topApp) {
                appCounts[r.topApp] = (appCounts[r.topApp] || 0) + 1;
            }
        }
        const topApp =
            Object.entries(appCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

        return NextResponse.json({
            activity: {
                focus_minutes: Math.round(totalFocus * 10) / 10,
                communication_minutes: Math.round(totalComm * 10) / 10,
                browsing_minutes: Math.round(totalBrowsing * 10) / 10,
                idle_minutes: Math.round(totalIdle * 10) / 10,
                other_minutes: Math.round(totalOther * 10) / 10,
                top_app: topApp,
                snapshot_count: records.length,
            },
            snapshots: records.slice(0, 100).map((r) => ({
                focus_minutes: r.focusMinutes,
                communication_minutes: r.communicationMinutes,
                browsing_minutes: r.browsingMinutes,
                idle_minutes: r.idleMinutes,
                other_minutes: r.otherMinutes,
                top_app: r.topApp,
                category_breakdown: r.categoryBreakdown,
                session_count: r.sessionCount,
                recorded_at: r.recordedAt.toISOString(),
            })),
            date: dateParam || new Date().toISOString().slice(0, 10),
        });
    } catch (error) {
        console.error("Activity query error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}
