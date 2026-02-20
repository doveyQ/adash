import {
  integer,
  pgTable,
  real,
  bigint,
  boolean,
  text,
  jsonb,
  timestamp,
} from "drizzle-orm/pg-core";

/* ── System Stats ──────────────────────────────── */

export const systemStats = pgTable("system_stats", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  cpuUsage: real("cpu_usage").notNull(),
  memoryUsage: real("memory_usage").notNull(),
  diskUsage: real("disk_usage").notNull(),
  bytesSent: bigint("bytes_sent", { mode: "number" }).notNull(),
  bytesRecv: bigint("bytes_recv", { mode: "number" }).notNull(),
  batteryPercent: real("battery_percent"),
  batteryCharging: boolean("battery_charging"),
  portsServices: jsonb("ports_services"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* ── Biometrics ────────────────────────────────── */

export const biometrics = pgTable("biometrics", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  sleepHours: real("sleep_hours").notNull(),
  hrvMs: integer("hrv_ms").notNull(),
  calories: integer("calories").notNull(),
  heartRateBpm: integer("heart_rate_bpm").notNull(),
  activitySummary: text("activity_summary").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/* ── Workflow ──────────────────────────────────── */

export const workflow = pgTable("workflow", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  githubCommits: jsonb("github_commits"),
  githubIssues: jsonb("github_issues"),
  projectStats: jsonb("project_stats"),
  calendarEntries: jsonb("calendar_entries"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
