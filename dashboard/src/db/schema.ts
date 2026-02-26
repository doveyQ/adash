import {
  integer,
  pgTable,
  real,
  bigint,
  boolean,
  jsonb,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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

export const biometrics = pgTable("biometrics", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  sleepHours: real("sleep_hours"),
  sleepHr: real("avgSleepingHR"),
  hrvMs: real("hrv_ms"),
  restingHr: integer("resting_hr"),
  steps: integer("steps"),
  activities: jsonb("activities"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

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

/* ─── New Tables for FlowState Agent ─────────────── */

export const aiInsights = pgTable("ai_insights", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  mode: text("mode").notNull(),
  nudges: jsonb("nudges"),
  flowPrediction: jsonb("flow_prediction"),
  focusUnitsRemaining: real("focus_units_remaining"),
  dailyReport: jsonb("daily_report"),
  triggerAlerts: jsonb("trigger_alerts"),
  analysisData: jsonb("analysis_data"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const productivityLogs = pgTable("productivity_logs", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  activeWindow: text("active_window"),
  browserTab: text("browser_tab"),
  ideTimeMinutes: integer("ide_time_minutes"),
  calendarEvent: text("calendar_event"),
  appDurations: jsonb("app_durations"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const githubActivity = pgTable("github_activity", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  commitMessages: jsonb("commit_messages"),
  pushEvents: jsonb("push_events"),
  frustrationScore: real("frustration_score"),
  sentimentDetail: jsonb("sentiment_detail"),
  issues: jsonb("issues"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const coachSnapshots = pgTable("coach_snapshots", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  hrvMs: real("hrv_ms"),
  restingHr: integer("resting_hr"),
  sleepHours: real("sleep_hours"),
  steps: integer("steps"),
  activeWindow: text("active_window"),
  ideTimeMinutes: integer("ide_time_minutes"),
  cpuUsage: real("cpu_usage"),
  memoryUsage: real("memory_usage"),
  commitCount: integer("commit_count"),
  frustrationScore: real("frustration_score"),
  mode: text("mode"),
  focusUnitsRemaining: real("focus_units_remaining"),
  recordedAt: timestamp("recorded_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userSettings = pgTable(
  "user_settings",
  {
    id: integer().primaryKey().generatedAlwaysAsIdentity(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("user_settings_key_idx").on(table.key)]
);

export const userTasks = pgTable("user_tasks", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  title: text("title").notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

