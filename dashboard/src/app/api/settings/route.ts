import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireApiKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.select().from(userSettings);
    const settings: Record<string, string> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    return NextResponse.json(settings);
  } catch (error) {
    console.error("Settings query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  // Allow unauthenticated requests from the webapp (no Authorization header)
  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader !== "Bearer undefined") {
    const authError = requireApiKey(req);
    if (authError) return authError;
  }

  try {
    const { key, value } = await req.json();
    if (!key || value === undefined) {
      return NextResponse.json(
        { error: "Missing key or value" },
        { status: 400 }
      );
    }

    // Upsert: insert or update on conflict
    await db
      .insert(userSettings)
      .values({ key, value: String(value), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userSettings.key,
        set: { value: String(value), updatedAt: new Date() },
      });

    return NextResponse.json({ message: "Setting saved", key, value });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}
