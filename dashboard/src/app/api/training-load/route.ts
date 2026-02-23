import { NextResponse } from "next/server";
import { db } from "@/db";
import { biometrics } from "@/db/schema";
import { desc, gte } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface ActivityEntry {
    icu_training_load?: number;
    [key: string]: unknown;
}

export async function GET() {
    try {
        const since = new Date();
        since.setDate(since.getDate() - 14);

        const records = await db
            .select({
                recordedAt: biometrics.recordedAt,
                activities: biometrics.activities,
            })
            .from(biometrics)
            .where(gte(biometrics.recordedAt, since))
            .orderBy(desc(biometrics.recordedAt));

        // Group by date and sum TSS from activities
        const byDate = new Map<string, number>();

        for (const row of records) {
            const date = row.recordedAt.toISOString().slice(0, 10);
            if (byDate.has(date)) continue; // only first (latest) record per day

            let dayTSS = 0;
            if (Array.isArray(row.activities)) {
                for (const act of row.activities as ActivityEntry[]) {
                    dayTSS += act.icu_training_load ?? 0;
                }
            }
            byDate.set(date, Math.round(dayTSS));
        }

        // Fill in missing days with 0
        const result: { date: string; tss: number }[] = [];
        const cursor = new Date();
        cursor.setDate(cursor.getDate() - 13);

        for (let i = 0; i < 14; i++) {
            const d = cursor.toISOString().slice(0, 10);
            result.push({ date: d, tss: byDate.get(d) ?? 0 });
            cursor.setDate(cursor.getDate() + 1);
        }

        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("Training load query error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}
