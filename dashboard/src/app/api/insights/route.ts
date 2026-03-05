import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { insights } from "@/db/schema";
import { desc, sql } from "drizzle-orm";
import { requireApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
    try {
        const dateParam = req.nextUrl.searchParams.get("date");

        let query;
        if (dateParam) {
            query = db
                .select()
                .from(insights)
                .where(sql`DATE(${insights.date}) = ${dateParam}`)
                .orderBy(desc(insights.createdAt))
                .limit(1);
        } else {
            query = db
                .select()
                .from(insights)
                .orderBy(desc(insights.createdAt))
                .limit(1);
        }

        const [record] = await query;

        if (!record) {
            return NextResponse.json({
                insight: null,
                date: dateParam || new Date().toISOString().slice(0, 10),
            });
        }

        return NextResponse.json({
            insight: {
                narrative: record.narrative,
                correlations: record.correlations,
                recommendations: record.recommendations,
                date: record.date.toISOString().slice(0, 10),
                created_at: record.createdAt.toISOString(),
            },
            date: record.date.toISOString().slice(0, 10),
        });
    } catch (error) {
        console.error("Insights query error:", error);
        return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
}

/* POST /api/insights — Save a new LLM-generated insight */
export async function POST(req: NextRequest) {
    const authError = requireApiKey(req);
    if (authError) return authError;

    try {
        const body = await req.json();

        await db.insert(insights).values({
            narrative: body.narrative,
            correlations: body.correlations ?? null,
            recommendations: body.recommendations ?? null,
            date: new Date(body.date || new Date().toISOString().slice(0, 10)),
        });

        return NextResponse.json({ message: "Insight saved", status: 200 });
    } catch (error) {
        console.error("Insight save error:", error);
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
}
