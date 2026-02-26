"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  ReferenceLine,
} from "recharts";
import { TrendingDown, Clock } from "lucide-react";

const chartConfig: ChartConfig = {
  energy: {
    label: "Energy",
    color: "oklch(0.627 0.265 303.9)",
  },
};

export default function FlowPredictor({
  prediction,
  loading,
}: {
  prediction: {
    estimated_crash_hour: number;
    energy_curve: { hour: number; energy: number }[];
    confidence: number;
  } | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="bio-card">
        <CardHeader className="pb-2">
          <div className="skeleton h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="skeleton h-[180px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const now = new Date().getHours();

  // Generate default energy curve if no prediction exists
  const data = prediction?.energy_curve?.length
    ? prediction.energy_curve.map((p) => ({
      ...p,
      label: `${p.hour}:00`,
      isPast: p.hour <= now,
    }))
    : Array.from({ length: 16 }, (_, i) => {
      const h = 6 + i;
      return {
        hour: h,
        energy: 0,
        label: `${h}:00`,
        isPast: h <= now,
      };
    });

  const crashHour = prediction?.estimated_crash_hour ?? null;
  const confidence = prediction?.confidence ?? 0;

  return (
    <Card className="bio-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingDown className="w-4 h-4 text-violet-400" />
          Flow Predictor
        </CardTitle>
        {crashHour != null && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
            <Clock className="w-3 h-3" />
            <span>
              Crash at{" "}
              <span className="font-semibold text-amber-400">
                {crashHour}:00
              </span>
            </span>
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-2">
        {prediction ? (
          <>
            <ChartContainer config={chartConfig} className="h-[180px] w-full">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="energyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="oklch(0.627 0.265 303.9)"
                      stopOpacity={0.25}
                    />
                    <stop
                      offset="95%"
                      stopColor="oklch(0.627 0.265 303.9)"
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  vertical={false}
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.05)"
                />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  interval={2}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10 }}
                  domain={[0, 100]}
                  ticks={[0, 25, 50, 75, 100]}
                />
                <ChartTooltip content={<ChartTooltipContent />} />

                {crashHour != null && (
                  <ReferenceLine
                    x={`${crashHour}:00`}
                    stroke="#ef4444"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                    label={{
                      value: "⚡ Crash",
                      position: "top",
                      fill: "#ef4444",
                      fontSize: 10,
                    }}
                  />
                )}

                {/* Current time marker */}
                <ReferenceLine
                  x={`${now}:00`}
                  stroke="#818cf8"
                  strokeOpacity={0.3}
                  strokeWidth={2}
                />

                <Area
                  type="monotone"
                  dataKey="energy"
                  stroke="var(--color-energy)"
                  strokeWidth={2}
                  fill="url(#energyGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--color-energy)" }}
                />
              </AreaChart>
            </ChartContainer>

            <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground/50">
              <span>Confidence: {(confidence * 100).toFixed(0)}%</span>
              <span>Based on today&apos;s biometrics</span>
            </div>
          </>
        ) : (
          <div className="h-[180px] flex flex-col items-center justify-center text-muted-foreground/40">
            <TrendingDown className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">No prediction yet</span>
            <span className="text-xs mt-1">
              AI will generate flow predictions after first analysis
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
