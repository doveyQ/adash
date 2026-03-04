"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Brain,
    MessageSquare,
    Globe,
    Pause,
    MoreHorizontal,
    AppWindow,
    CalendarIcon,
    ArrowRightLeft,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────── */

interface ActivitySummary {
    focus_minutes: number;
    communication_minutes: number;
    browsing_minutes: number;
    idle_minutes: number;
    other_minutes: number;
    top_app: string | null;
    snapshot_count: number;
}

interface ActivitySnapshot {
    focus_minutes: number;
    communication_minutes: number;
    browsing_minutes: number;
    idle_minutes: number;
    other_minutes: number;
    top_app: string | null;
    category_breakdown: Record<string, number> | null;
    session_count: number;
    recorded_at: string;
}

/* ─── Helpers ────────────────────────────────────── */

function formatDate(d: Date): string {
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

function toDateString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

/* ─── Donut Chart ────────────────────────────────── */

const CATEGORIES = [
    { key: "focus_minutes", label: "Deep Work", color: "#818cf8", icon: Brain },
    { key: "communication_minutes", label: "Communication", color: "#f472b6", icon: MessageSquare },
    { key: "browsing_minutes", label: "Browsing", color: "#38bdf8", icon: Globe },
    { key: "idle_minutes", label: "Idle", color: "#6b7280", icon: Pause },
    { key: "other_minutes", label: "Other", color: "#a78bfa", icon: MoreHorizontal },
] as const;

function DonutChart({
    data,
    size = 180,
    strokeWidth = 24,
}: {
    data: ActivitySummary;
    size?: number;
    strokeWidth?: number;
}) {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const values = CATEGORIES.map((c) => ({
        ...c,
        value: (data[c.key as keyof ActivitySummary] as number) || 0,
    }));

    const total = values.reduce((s, v) => s + v.value, 0) || 1;
    let cumulativeOffset = 0;

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size}>
                {/* Background ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.04)"
                    strokeWidth={strokeWidth}
                />
                {/* Segment arcs */}
                {values.map((seg) => {
                    const pct = seg.value / total;
                    const dashLen = circumference * pct;
                    const gap = circumference - dashLen;
                    const offset = -circumference * cumulativeOffset + circumference * 0.25;
                    cumulativeOffset += pct;

                    if (pct === 0) return null;

                    return (
                        <circle
                            key={seg.key}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={`${dashLen} ${gap}`}
                            strokeDashoffset={offset}
                            strokeLinecap="butt"
                            className="transition-all duration-700 ease-out"
                            style={{ filter: `drop-shadow(0 0 4px ${seg.color}40)` }}
                        />
                    );
                })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tracking-tight">
                    {Math.round(total)}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">minutes</span>
            </div>
        </div>
    );
}

/* ─── Legend ──────────────────────────────────────── */

function CategoryLegend({ data }: { data: ActivitySummary }) {
    const total =
        CATEGORIES.reduce(
            (s, c) => s + ((data[c.key as keyof ActivitySummary] as number) || 0),
            0
        ) || 1;

    return (
        <div className="flex flex-col gap-2.5 w-full">
            {CATEGORIES.map((cat) => {
                const value = (data[cat.key as keyof ActivitySummary] as number) || 0;
                const pct = Math.round((value / total) * 100);
                const Icon = cat.icon;

                return (
                    <div key={cat.key} className="flex items-center gap-3">
                        <div
                            className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                            style={{ background: `${cat.color}20` }}
                        >
                            <Icon className="w-3.5 h-3.5" style={{ color: cat.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs text-muted-foreground">
                                    {cat.label}
                                </span>
                                <span className="text-xs font-mono font-medium">
                                    {Math.round(value)}m
                                </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700"
                                    style={{
                                        width: `${pct}%`,
                                        background: cat.color,
                                        boxShadow: `0 0 8px ${cat.color}30`,
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/* ─── Top App Card ───────────────────────────────── */

function TopAppCard({ app, sessions }: { app: string | null; sessions: number }) {
    return (
        <div className="flex items-center gap-4 p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center">
                <AppWindow className="w-6 h-6 text-indigo-400" />
            </div>
            <div className="flex-1">
                <p className="text-sm font-medium capitalize">
                    {app || "No activity"}
                </p>
                <p className="text-xs text-muted-foreground">Top application today</p>
            </div>
            <div className="text-right">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ArrowRightLeft className="w-3 h-3" />
                    {sessions} switches
                </div>
            </div>
        </div>
    );
}

/* ─── Timeline ───────────────────────────────────── */

function ActivityTimeline({ snapshots }: { snapshots: ActivitySnapshot[] }) {
    if (snapshots.length === 0) return null;

    // Group snapshots by hour
    const hours: Record<string, ActivitySnapshot[]> = {};
    for (const snap of snapshots) {
        const hour = new Date(snap.recorded_at).getHours();
        const key = `${hour.toString().padStart(2, "0")}:00`;
        if (!hours[key]) hours[key] = [];
        hours[key].push(snap);
    }

    const sortedHours = Object.keys(hours).sort();

    return (
        <Card className="bio-card animate-fade-in-up col-span-full" style={{ animationDelay: "200ms" }}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-sky-400" />
                    Hourly Breakdown
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="flex gap-1 items-end h-32">
                    {sortedHours.map((hour) => {
                        const snaps = hours[hour];
                        const focus = snaps.reduce((s, sn) => s + (sn.focus_minutes ?? 0), 0);
                        const comm = snaps.reduce((s, sn) => s + (sn.communication_minutes ?? 0), 0);
                        const browse = snaps.reduce((s, sn) => s + (sn.browsing_minutes ?? 0), 0);
                        const total = focus + comm + browse || 1;
                        const maxBar = 100;
                        const scale = Math.min(total / 60, 1);

                        return (
                            <div
                                key={hour}
                                className="flex-1 flex flex-col items-center gap-1"
                            >
                                <div
                                    className="w-full rounded-t-md flex flex-col justify-end overflow-hidden"
                                    style={{ height: `${scale * maxBar}%`, minHeight: "4px" }}
                                >
                                    <div
                                        style={{
                                            height: `${(focus / total) * 100}%`,
                                            background: "#818cf8",
                                            minHeight: focus > 0 ? "2px" : 0,
                                        }}
                                    />
                                    <div
                                        style={{
                                            height: `${(comm / total) * 100}%`,
                                            background: "#f472b6",
                                            minHeight: comm > 0 ? "2px" : 0,
                                        }}
                                    />
                                    <div
                                        style={{
                                            height: `${(browse / total) * 100}%`,
                                            background: "#38bdf8",
                                            minHeight: browse > 0 ? "2px" : 0,
                                        }}
                                    />
                                </div>
                                <span className="text-[9px] text-muted-foreground/50">
                                    {hour.slice(0, 2)}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── No Data Placeholder ────────────────────────── */

function NoActivityData() {
    return (
        <Card className="bio-card animate-fade-in-up col-span-full">
            <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 flex items-center justify-center">
                    <Brain className="w-8 h-8 text-muted-foreground/30" />
                </div>
                <div className="text-center">
                    <p className="text-sm font-medium text-muted-foreground/70">
                        No activity data yet
                    </p>
                    <p className="text-xs text-muted-foreground/40 mt-1">
                        The Pulse agent will start tracking once it&apos;s running
                    </p>
                </div>
            </CardContent>
        </Card>
    );
}

/* ─── Date Picker ────────────────────────────────── */

function DateFilter({
    date,
    onDateChange,
}: {
    date: Date;
    onDateChange: (d: Date) => void;
}) {
    const [open, setOpen] = useState(false);
    const isToday = date.toDateString() === new Date().toDateString();

    return (
        <div
            className="flex items-center gap-3 mb-6 animate-fade-in-up"
            style={{ animationDelay: "0ms" }}
        >
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="gap-2 text-sm font-normal bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06]"
                    >
                        <CalendarIcon className="w-4 h-4 text-muted-foreground" />
                        {formatDate(date)}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        mode="single"
                        selected={date}
                        onSelect={(d) => {
                            if (d) {
                                onDateChange(d);
                                setOpen(false);
                            }
                        }}
                        disabled={(d) => d > new Date()}
                    />
                </PopoverContent>
            </Popover>
            {!isToday && (
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => onDateChange(new Date())}
                >
                    Back to today
                </Button>
            )}
        </div>
    );
}

/* ─── Skeleton ───────────────────────────────────── */

function ProductivitySkeleton() {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bio-card animate-fade-in-up">
                <CardContent className="flex items-center justify-center py-12">
                    <div className="skeleton h-44 w-44 rounded-full" />
                </CardContent>
            </Card>
            <Card className="bio-card animate-fade-in-up" style={{ animationDelay: "80ms" }}>
                <CardContent className="py-8 space-y-4">
                    <div className="skeleton h-5 w-3/4" />
                    <div className="skeleton h-5 w-1/2" />
                    <div className="skeleton h-5 w-2/3" />
                    <div className="skeleton h-5 w-1/3" />
                    <div className="skeleton h-5 w-3/5" />
                </CardContent>
            </Card>
        </div>
    );
}

/* ─── Main View ──────────────────────────────────── */

export default function ProductivityView({
    selectedDate,
    onDateChange,
}: {
    selectedDate: Date;
    onDateChange: (d: Date) => void;
}) {
    const [activity, setActivity] = useState<ActivitySummary | null>(null);
    const [snapshots, setSnapshots] = useState<ActivitySnapshot[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const dateStr = toDateString(selectedDate);
            const res = await fetch(`/api/activity?date=${dateStr}`, {
                cache: "no-store",
            });
            const json = await res.json();
            setActivity(json.activity ?? null);
            setSnapshots(json.snapshots ?? []);
        } catch {
            setActivity(null);
            setSnapshots([]);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchData();
        // Refresh every 60 seconds
        const id = setInterval(fetchData, 60_000);
        return () => clearInterval(id);
    }, [fetchData]);

    return (
        <div>
            <DateFilter date={selectedDate} onDateChange={onDateChange} />

            {loading ? (
                <ProductivitySkeleton />
            ) : !activity ? (
                <NoActivityData />
            ) : (
                <div className="space-y-6">
                    {/* Donut + Legend */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card
                            className="bio-card animate-fade-in-up"
                            style={{ animationDelay: "0ms" }}
                        >
                            <CardHeader className="flex flex-row items-center justify-between pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                    <Brain className="w-4 h-4 text-indigo-400" />
                                    Focus Distribution
                                </CardTitle>
                                <Badge
                                    variant="outline"
                                    className="text-xs border-0 text-muted-foreground"
                                >
                                    {activity.snapshot_count} samples
                                </Badge>
                            </CardHeader>
                            <CardContent className="flex items-center justify-center pt-4">
                                <DonutChart data={activity} />
                            </CardContent>
                        </Card>

                        <Card
                            className="bio-card animate-fade-in-up"
                            style={{ animationDelay: "80ms" }}
                        >
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm font-medium text-muted-foreground">
                                    Category Breakdown
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="pt-2">
                                <CategoryLegend data={activity} />
                            </CardContent>
                        </Card>
                    </div>

                    {/* Top App + Context Switches */}
                    <div className="animate-fade-in-up" style={{ animationDelay: "120ms" }}>
                        <TopAppCard
                            app={activity.top_app}
                            sessions={activity.snapshot_count}
                        />
                    </div>

                    {/* Hourly Timeline */}
                    <ActivityTimeline snapshots={snapshots} />
                </div>
            )}
        </div>
    );
}
