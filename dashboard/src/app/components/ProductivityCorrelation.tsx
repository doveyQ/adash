"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  ResponsiveContainer,
} from "recharts";
import { motion } from "framer-motion";
import { Clock, Sparkles, TrendingUp, Monitor } from "lucide-react";

interface HourStat {
  hour: number;
  productiveRatio: number;
  totalEntries: number;
  topApp: string;
}

interface SweetSpotData {
  hourStats: HourStat[];
  aiSummary?: string;
  topWindows?: HourStat[];
}

const BAR_COLORS = (ratio: number): string => {
  if (ratio >= 0.7) return "#22c55e";
  if (ratio >= 0.4) return "#eab308";
  if (ratio >= 0.2) return "#f97316";
  return "#ef444430";
};

export default function ProductivityCorrelation() {
  const [data, setData] = useState<SweetSpotData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const r = await fetch("/api/productivity", { cache: "no-store" });
        const json = await r.json();
        setData(json.sweetSpotAnalysis ?? null);
      } catch {
        // retry next poll
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <Card className="bio-card">
        <CardHeader className="pb-2">
          <div className="skeleton h-4 w-36" />
        </CardHeader>
        <CardContent>
          <div className="skeleton h-[200px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const hourStats = data?.hourStats ?? [];
  const aiSummary = data?.aiSummary;
  const topWindows = data?.topWindows ?? [];

  if (hourStats.length === 0) {
    return (
      <Card className="bio-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Sweet Spot Finder
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[180px] flex flex-col items-center justify-center text-muted-foreground/40 text-sm">
            <Clock className="w-8 h-8 mb-2 opacity-30" />
            <span>Need more activity data</span>
            <span className="text-xs mt-1">
              Your best working times will appear here
            </span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Find the peak hour
  const peakHour = hourStats.reduce(
    (best, h) =>
      h.productiveRatio > (best?.productiveRatio ?? 0) ? h : best,
    hourStats[0]
  );

  // Chart data
  const chartData = hourStats.map((h) => ({
    hour: `${h.hour}:00`,
    productive: Math.round(h.productiveRatio * 100),
    topApp: h.topApp,
    entries: h.totalEntries,
    fill: BAR_COLORS(h.productiveRatio),
  }));

  const chartConfig = {
    productive: {
      label: "Focus %",
    },
  };

  return (
    <Card className="bio-card relative overflow-hidden">
      {/* Subtle glow at peak */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at center, rgba(34,197,94,0.05), transparent 70%)`,
        }}
      />

      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4 text-cyan-400" />
          Sweet Spot Finder
        </CardTitle>
        {peakHour && (
          <Badge
            variant="outline"
            className="text-[10px] border-0 bg-emerald-400/10 text-emerald-400"
          >
            <TrendingUp className="w-3 h-3 mr-0.5" />
            Peak {peakHour.hour}:00
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-3 relative z-10">
        {/* AI Summary */}
        {aiSummary && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 mb-4 px-2 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/70 leading-relaxed">
              {aiSummary}
            </p>
          </motion.div>
        )}

        {/* Hourly chart */}
        <ChartContainer config={chartConfig} className="h-[140px] w-full">
          <BarChart data={chartData} barCategoryGap="15%">
            <XAxis
              dataKey="hour"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={Math.max(0, Math.floor(chartData.length / 8))}
            />
            <YAxis
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              domain={[0, 100]}
              tickFormatter={(v: number) => `${v}%`}
              width={35}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  formatter={(value, name, item) => {
                    const payload = item?.payload;
                    return (
                      <div className="text-xs">
                        <div className="font-medium">{value}% productive</div>
                        <div className="text-muted-foreground">
                          {payload?.entries} entries • {payload?.topApp}
                        </div>
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar dataKey="productive" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ChartContainer>

        {/* Top windows summary */}
        {topWindows.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/[0.04]">
            <div className="flex items-center gap-1.5 mb-2">
              <Monitor className="w-3 h-3 text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wider">
                Top Focus Windows (7-day analysis)
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topWindows.slice(0, 3).map((w, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="text-[10px] border-white/[0.06] text-foreground/50"
                >
                  {w.hour}:00 — {Math.round(w.productiveRatio * 100)}% on{" "}
                  {w.topApp.split(":")[0]}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
