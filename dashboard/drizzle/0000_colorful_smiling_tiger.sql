CREATE TABLE "activity_snapshots" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "activity_snapshots_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"focus_minutes" real,
	"communication_minutes" real,
	"browsing_minutes" real,
	"idle_minutes" real,
	"other_minutes" real,
	"top_app" text,
	"category_breakdown" jsonb,
	"session_count" integer,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "biometrics" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "biometrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sleep_hours" real,
	"avgSleepingHR" real,
	"hrv_ms" real,
	"resting_hr" integer,
	"steps" integer,
	"activities" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "insights" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "insights_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"narrative" text NOT NULL,
	"correlations" jsonb,
	"recommendations" jsonb,
	"date" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_stats" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "system_stats_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cpu_usage" real NOT NULL,
	"memory_usage" real NOT NULL,
	"disk_usage" real NOT NULL,
	"bytes_sent" bigint NOT NULL,
	"bytes_recv" bigint NOT NULL,
	"battery_percent" real,
	"battery_charging" boolean,
	"ports_services" jsonb,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
