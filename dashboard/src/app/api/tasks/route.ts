import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { userTasks } from "@/db/schema";
import { desc, eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const todayStr = new Date().toISOString().slice(0, 10);
    const tasks = await db
      .select()
      .from(userTasks)
      .where(sql`DATE(${userTasks.createdAt}) = ${todayStr}`)
      .orderBy(desc(userTasks.createdAt));

    return NextResponse.json({
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        completed: t.completed,
        createdAt: t.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Tasks query error:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { title } = await req.json();
    if (!title || typeof title !== "string") {
      return NextResponse.json({ error: "Title required" }, { status: 400 });
    }

    const result = await db
      .insert(userTasks)
      .values({ title: title.trim() })
      .returning();

    return NextResponse.json({ task: result[0], status: 201 });
  } catch (error) {
    console.error("Task create error:", error);
    return NextResponse.json({ error: "Create failed" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, completed, title } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (typeof completed === "boolean") updates.completed = completed;
    if (typeof title === "string") updates.title = title.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates" }, { status: 400 });
    }

    await db
      .update(userTasks)
      .set(updates as typeof userTasks.$inferInsert)
      .where(eq(userTasks.id, id));

    return NextResponse.json({ message: "Updated", status: 200 });
  } catch (error) {
    console.error("Task update error:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await db.delete(userTasks).where(eq(userTasks.id, id));

    return NextResponse.json({ message: "Deleted", status: 200 });
  } catch (error) {
    console.error("Task delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
