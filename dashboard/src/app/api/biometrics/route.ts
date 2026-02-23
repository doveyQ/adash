import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { biometrics } from "@/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const dateParam = req.nextUrl.searchParams.get("date");

        let query;
        if (dateParam) {
            // Filter by specific date using DATE() for timezone-safe comparison
            query = db
                .select()
                .from(biometrics)
                .where(sql`DATE(${biometrics.recordedAt}) = ${dateParam}`)
                .orderBy(desc(biometrics.recordedAt))
                .limit(1);
        } else {
            // Latest record
            query = db
                .select()
                .from(biometrics)
                .orderBy(desc(biometrics.recordedAt))
                .limit(1);
        }

        const [record] = await query;

        if (!record) {
            return NextResponse.json({
                biometrics: null,
                date: dateParam || new Date().toISOString().slice(0, 10),
            });
        }

        return NextResponse.json({
            biometrics: {
                sleep_hours: record.sleepHours,
                hrv_ms: record.hrvMs,
                resting_hr: record.restingHr,
                sleep_hr: record.sleepHr,
                steps: record.steps,
                activities: record.activities,
            },
            date: record.recordedAt.toISOString().slice(0, 10),
        });
    } catch (error) {
        console.error("Biometrics query error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}
