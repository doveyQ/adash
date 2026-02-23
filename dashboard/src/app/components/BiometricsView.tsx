"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  Moon,
  Heart,
  Activity,
  Footprints,
  BrainCircuit,
  Zap,
  Info,
  CalendarIcon,
  ChevronDown,
  Timer,
  Flame,
  Mountain,
  Gauge,
  TrendingUp,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────── */

export interface ActivityEntry {
  id?: string | number;
  type: string;
  name?: string;
  start_date_local?: string;
  moving_time?: number;
  distance?: number;
  total_elevation_gain?: number;
  calories?: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed?: number;
  max_speed?: number;
  average_cadence?: number;
  average_watts?: number;
  weighted_average_watts?: number;
  icu_training_load?: number;
  icu_intensity?: number;
  icu_ftp?: number;
  icu_w_prime?: number;
  suffer_score?: number;
  average_temp?: number;
}

export interface BiometricsData {
  sleep_hours: number | null;
  sleep_hr: number | null;
  hrv_ms: number | null;
  resting_hr: number | null;
  steps: number | null;
  activities: ActivityEntry[] | null;
}

interface TrainingLoadPoint {
  date: string;
  tss: number;
}

/* ─── Helpers ────────────────────────────────────── */

function sleepStatus(hours: number): { label: string; color: string } {
  if (hours >= 7.5) return { label: "Optimal", color: "#22c55e" };
  if (hours >= 6) return { label: "Fair", color: "#eab308" };
  return { label: "Low", color: "#ef4444" };
}

function hrStatus(hr: number): { label: string; color: string } {
  if (hr <= 60) return { label: "Excellent", color: "#22c55e" };
  if (hr <= 75) return { label: "Good", color: "#3b82f6" };
  return { label: "Elevated", color: "#eab308" };
}

function hrvStatus(hrv: number): { label: string; color: string } {
  if (hrv >= 50) return { label: "Strong", color: "#22c55e" };
  if (hrv >= 30) return { label: "Moderate", color: "#eab308" };
  return { label: "Low", color: "#ef4444" };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatSpeed(ms: number): string {
  return `${(ms * 3.6).toFixed(1)} km/h`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Timezone-safe YYYY-MM-DD using local date components */
function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ─── Ring Gauge Component ───────────────────────── */

function RingGauge({
  value,
  max,
  size = 120,
  strokeWidth = 10,
  gradientId,
  colors,
  empty,
  children,
}: {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  gradientId: string;
  colors: [string, string];
  empty?: boolean;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = empty ? 0 : Math.min(value / max, 1);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="ring-gauge-svg">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={colors[0]} />
            <stop offset="100%" stopColor={colors[1]} />
          </linearGradient>
        </defs>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={strokeWidth}
          strokeDasharray={empty ? "6 6" : "none"}
        />
        {!empty && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - pct)}
            className="ring-gauge-fill"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/* ─── ECG Heartbeat Canvas ───────────────────────── */

function ECGCanvas({ bpm, color }: { bpm: number; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    let x = 0;
    const speed = Math.max(1, bpm / 30);

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 6;
      ctx.beginPath();

      const mid = h / 2;
      const waveLength = w / 3;

      for (let i = 0; i < w; i++) {
        const pos = (i + x) % waveLength;
        const t = pos / waveLength;
        let y = mid;

        if (t > 0.1 && t < 0.2) y = mid - Math.sin((t - 0.1) * Math.PI * 10) * 6;
        else if (t > 0.25 && t < 0.28) y = mid + 8;
        else if (t > 0.28 && t < 0.34) y = mid - Math.sin((t - 0.28) * Math.PI / 0.06) * (h * 0.35);
        else if (t > 0.34 && t < 0.37) y = mid + 10;
        else if (t > 0.42 && t < 0.55) y = mid - Math.sin((t - 0.42) * Math.PI / 0.13) * 10;

        if (i === 0) ctx.moveTo(i, y);
        else ctx.lineTo(i, y);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;
      x += speed;
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [bpm, color]);

  return <canvas ref={canvasRef} className="w-full h-16 opacity-80" />;
}

/* ─── No Data Placeholder ────────────────────────── */

function NoDataLabel() {
  return (
    <span className="text-xs text-muted-foreground/50 italic">
      No data today
    </span>
  );
}

/* ─── Sleep Card ─────────────────────────────────── */

function SleepCard({ hours, delay }: { hours: number | null; delay: number }) {
  const hasData = hours !== null;
  const status = hasData ? sleepStatus(hours) : null;

  return (
    <Card className="bio-card animate-fade-in-up group" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Moon className="w-4 h-4 text-indigo-400" />
          Sleep Duration
        </CardTitle>
        {status && (
          <Badge variant="outline" className="text-xs border-0" style={{ color: status.color, background: `${status.color}15` }}>
            {status.label}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-center pt-2">
        <RingGauge
          value={hasData ? hours : 0}
          max={10}
          size={140}
          strokeWidth={12}
          gradientId="sleep-grad"
          colors={["#818cf8", "#a78bfa"]}
          empty={!hasData}
        >
          {hasData ? (
            <>
              <span className="text-3xl font-bold tracking-tight">{hours.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground mt-0.5">hours</span>
            </>
          ) : (
            <NoDataLabel />
          )}
        </RingGauge>
      </CardContent>
    </Card>
  );
}

/* ─── Sleep HR Card ──────────────────────────────── */

function SleepHRCard({ hr, delay }: { hr: number | null; delay: number }) {
  const hasData = hr !== null;
  const status = hasData ? hrStatus(hr) : null;

  return (
    <Card className="bio-card animate-fade-in-up group" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Heart className="w-4 h-4 text-rose-400" />
          Sleep Heart Rate
        </CardTitle>
        {status && (
          <Badge variant="outline" className="text-xs border-0" style={{ color: status.color, background: `${status.color}15` }}>
            {status.label}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center pt-2 gap-2">
        {hasData ? (
          <>
            <div className="relative">
              <Heart className="w-16 h-16 heartbeat-icon" style={{ color: "#fb7185" }} fill="#fb7185" />
              <div className="absolute inset-0 rounded-full heartbeat-glow" style={{ background: "radial-gradient(circle, #fb718530 0%, transparent 70%)" }} />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-bold tracking-tight">{Math.round(hr)}</span>
              <span className="text-sm text-muted-foreground">bpm</span>
            </div>
            <span className="text-xs text-muted-foreground">avg during sleep</span>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <Heart className="w-12 h-12 text-muted-foreground/20" />
            <NoDataLabel />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── HRV Card ───────────────────────────────────── */

function HRVCard({ hrv, delay }: { hrv: number | null; delay: number }) {
  const hasData = hrv !== null;
  const status = hasData ? hrvStatus(hrv) : null;
  const pct = hasData ? Math.min(hrv / 100, 1) * 100 : 0;

  return (
    <Card className="bio-card animate-fade-in-up group" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <BrainCircuit className="w-4 h-4 text-emerald-400" />
          Heart Rate Variability
        </CardTitle>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Info className="w-3.5 h-3.5 text-muted-foreground/50" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs max-w-48">Higher HRV = better recovery & stress resilience.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center pt-4 gap-4">
        {hasData ? (
          <>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight">{Math.round(hrv)}</span>
              <span className="text-sm text-muted-foreground">ms</span>
            </div>
            <div className="w-full space-y-2">
              <div className="hrv-bar-track">
                <div
                  className="hrv-bar-fill"
                  style={{
                    width: `${pct}%`,
                    background: `linear-gradient(90deg, ${status!.color}, ${status!.color}aa)`,
                    boxShadow: `0 0 12px ${status!.color}40`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground/60 px-0.5">
                <span>Low</span>
                <span>Moderate</span>
                <span>Strong</span>
              </div>
            </div>
            <Badge variant="outline" className="text-xs border-0" style={{ color: status!.color, background: `${status!.color}15` }}>
              {status!.label} Recovery
            </Badge>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <BrainCircuit className="w-12 h-12 text-muted-foreground/20" />
            <NoDataLabel />
            <div className="w-full">
              <div className="hrv-bar-track"><div className="hrv-bar-fill" style={{ width: "0%" }} /></div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Resting HR Card ────────────────────────────── */

function RestingHRCard({ hr, delay }: { hr: number | null; delay: number }) {
  const hasData = hr !== null;
  const status = hasData ? hrStatus(hr) : null;

  return (
    <Card className="bio-card animate-fade-in-up group" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          Resting Heart Rate
        </CardTitle>
        {status && (
          <Badge variant="outline" className="text-xs border-0" style={{ color: status!.color, background: `${status!.color}15` }}>
            {status!.label}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col items-center pt-2 gap-1">
        {hasData ? (
          <>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-3xl font-bold tracking-tight">{Math.round(hr)}</span>
              <span className="text-sm text-muted-foreground">bpm</span>
            </div>
            <ECGCanvas bpm={hr} color="#22d3ee" />
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <Activity className="w-12 h-12 text-muted-foreground/20" />
            <NoDataLabel />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Steps Card ─────────────────────────────────── */

function StepsCard({ steps, delay }: { steps: number | null; delay: number }) {
  const hasData = steps !== null;
  const goal = 10000;
  const pct = hasData ? Math.min(steps / goal, 1) * 100 : 0;
  const hit = hasData && steps >= goal;

  return (
    <Card className="bio-card animate-fade-in-up group" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Footprints className="w-4 h-4 text-emerald-400" />
          Steps
        </CardTitle>
        {hasData && (
          <Badge variant="outline" className="text-xs border-0"
            style={{ color: hit ? "#22c55e" : "#eab308", background: hit ? "#22c55e15" : "#eab30815" }}>
            {hit ? "Goal Reached!" : `${pct.toFixed(0)}%`}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex items-center justify-center pt-2">
        <RingGauge
          value={hasData ? steps : 0}
          max={goal}
          size={140}
          strokeWidth={12}
          gradientId="steps-grad"
          colors={["#34d399", "#10b981"]}
          empty={!hasData}
        >
          {hasData ? (
            <>
              <span className="text-3xl font-bold tracking-tight">
                {steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps}
              </span>
              <span className="text-xs text-muted-foreground mt-0.5">/ {goal / 1000}k goal</span>
            </>
          ) : (
            <NoDataLabel />
          )}
        </RingGauge>
      </CardContent>
    </Card>
  );
}

/* ─── Activity Detail Row ────────────────────────── */

function StatRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <Icon className="w-3.5 h-3.5 text-muted-foreground/60" />
      <span className="text-xs text-muted-foreground flex-1">{label}</span>
      <span className="text-xs font-medium font-mono">{value}</span>
    </div>
  );
}

function ActivityItem({ activity }: { activity: ActivityEntry }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg bg-white/[0.02] border border-white/[0.04] overflow-hidden transition-colors hover:bg-white/[0.04]">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium">{activity.name || activity.type}</p>
            <p className="text-xs text-muted-foreground">
              {activity.moving_time ? formatDuration(activity.moving_time) : "—"}
              {activity.distance ? ` · ${(activity.distance / 1000).toFixed(1)}km` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activity.icu_training_load && (
            <Badge variant="outline" className="text-xs border-0 text-amber-400 bg-amber-400/10">
              TSS {Math.round(activity.icu_training_load)}
            </Badge>
          )}
          <ChevronDown
            className="w-4 h-4 text-muted-foreground/50 transition-transform duration-200"
            style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </div>
      </button>

      <div
        className="activity-detail-panel"
        style={{
          maxHeight: open ? "400px" : "0px",
          opacity: open ? 1 : 0,
          paddingTop: open ? "0" : "0",
          paddingBottom: open ? "12px" : "0",
        }}
      >
        <div className="px-4 pt-1 border-t border-white/[0.04]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
            {activity.average_heartrate != null && (
              <StatRow icon={Heart} label="Avg HR" value={`${Math.round(activity.average_heartrate)} bpm`} />
            )}
            {activity.max_heartrate != null && (
              <StatRow icon={Heart} label="Max HR" value={`${Math.round(activity.max_heartrate)} bpm`} />
            )}
            {activity.average_speed != null && (
              <StatRow icon={Gauge} label="Avg Speed" value={formatSpeed(activity.average_speed)} />
            )}
            {activity.max_speed != null && (
              <StatRow icon={Gauge} label="Max Speed" value={formatSpeed(activity.max_speed)} />
            )}
            {activity.average_watts != null && (
              <StatRow icon={Zap} label="Avg Power" value={`${Math.round(activity.average_watts)} W`} />
            )}
            {activity.weighted_average_watts != null && (
              <StatRow icon={Zap} label="Weighted Avg Power" value={`${Math.round(activity.weighted_average_watts)} W`} />
            )}
            {activity.total_elevation_gain != null && (
              <StatRow icon={Mountain} label="Elevation" value={`${Math.round(activity.total_elevation_gain)} m`} />
            )}
            {activity.calories != null && (
              <StatRow icon={Flame} label="Calories" value={`${Math.round(activity.calories)} kcal`} />
            )}
            {activity.average_cadence != null && (
              <StatRow icon={Activity} label="Cadence" value={`${Math.round(activity.average_cadence)} rpm`} />
            )}
            {activity.icu_intensity != null && (
              <StatRow icon={TrendingUp} label="Intensity" value={`${(activity.icu_intensity * 100).toFixed(0)}%`} />
            )}
            {activity.suffer_score != null && (
              <StatRow icon={Flame} label="Suffer Score" value={activity.suffer_score} />
            )}
            {activity.average_temp != null && (
              <StatRow icon={Activity} label="Avg Temp" value={`${activity.average_temp}°C`} />
            )}
            {activity.start_date_local && (
              <StatRow icon={Timer} label="Date" value={new Date(activity.start_date_local).toLocaleDateString()} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Activities List ────────────────────────────── */

function ActivitiesList({ activities, delay }: { activities: ActivityEntry[]; delay: number }) {
  return (
    <Card className="bio-card animate-fade-in-up group col-span-full" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          Activities
        </CardTitle>
        <Badge variant="outline" className="text-xs border-0 text-muted-foreground">
          {activities.length} recorded
        </Badge>
      </CardHeader>
      <CardContent className="pt-2 space-y-2">
        {activities.map((a, i) => (
          <ActivityItem key={a.id ?? i} activity={a} />
        ))}
      </CardContent>
    </Card>
  );
}

/* ─── Training Load Chart ────────────────────────── */

const tssChartConfig: ChartConfig = {
  tss: {
    label: "Training Load (TSS)",
    color: "oklch(0.627 0.265 303.9)",
  },
};

function TrainingLoadChart({ delay }: { delay: number }) {
  const [data, setData] = useState<TrainingLoadPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/training-load", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (json.data) {
          setData(
            json.data.map((d: TrainingLoadPoint) => ({
              ...d,
              date: new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            }))
          );
        }
      })
      .catch(() => { })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="bio-card animate-fade-in-up group" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-violet-400" />
          Training Load — Last 14 Days
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        {loading ? (
          <div className="h-[200px] flex items-center justify-center">
            <div className="skeleton h-full w-full rounded-lg" />
          </div>
        ) : data.length === 0 ? (
          <div className="h-[200px] flex flex-col items-center justify-center text-muted-foreground/50">
            <TrendingUp className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">No training data available</span>
          </div>
        ) : (
          <ChartContainer config={tssChartConfig} className="h-[200px] w-full">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="tssGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="oklch(0.627 0.265 303.9)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="oklch(0.627 0.265 303.9)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="tss"
                stroke="var(--color-tss)"
                strokeWidth={2}
                fill="url(#tssGrad)"
                dot={{ r: 3, fill: "var(--color-tss)" }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ChartContainer>
        )}
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
    <div className="flex items-center gap-3 mb-6 animate-fade-in-up" style={{ animationDelay: "0ms" }}>
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

/* ─── Skeleton Cards ─────────────────────────────── */

function BioSkeletonCard({ delay }: { delay: number }) {
  return (
    <Card className="bio-card animate-fade-in-up" style={{ animationDelay: `${delay}ms` }}>
      <CardHeader className="pb-2">
        <div className="skeleton h-4 w-28" />
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3 pt-4">
        <div className="skeleton h-32 w-32 rounded-full" />
        <div className="skeleton h-4 w-16" />
      </CardContent>
    </Card>
  );
}

/* ─── Main View ──────────────────────────────────── */

export default function BiometricsView({
  selectedDate,
  onDateChange,
}: {
  selectedDate: Date;
  onDateChange: (d: Date) => void;
}) {
  const [data, setData] = useState<BiometricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const fetchBiometrics = useCallback(async (d: Date) => {
    setLoading(true);
    try {
      const dateStr = toDateString(d);
      const res = await fetch(`/api/biometrics?date=${dateStr}`, { cache: "no-store" });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setData(json.biometrics);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mounted) fetchBiometrics(selectedDate);
  }, [mounted, selectedDate, fetchBiometrics]);

  if (!mounted) return null;

  return (
    <div>
      <DateFilter date={selectedDate} onDateChange={onDateChange} />

      {loading ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 60, 120, 180, 240].map((d) => (
            <BioSkeletonCard key={d} delay={d} />
          ))}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {/* Row 1: Sleep metrics + Resting HR */}
          <SleepCard hours={data?.sleep_hours ?? null} delay={0} />
          <SleepHRCard hr={data?.sleep_hr ?? null} delay={80} />
          <RestingHRCard hr={data?.resting_hr ?? null} delay={160} />

          {/* Row 2: HRV, Steps, Training Load fills last spot */}
          <HRVCard hrv={data?.hrv_ms ?? null} delay={240} />
          <StepsCard steps={data?.steps ?? null} delay={320} />
          <TrainingLoadChart delay={400} />

          {/* Activities list full-width */}
          {data?.activities && data.activities.length > 0 && (
            <ActivitiesList activities={data.activities} delay={480} />
          )}
        </div>
      )}
    </div>
  );
}
