"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Battery, BatteryLow, BatteryFull } from "lucide-react";

export default function ResourceBudget({
  focusUnits,
  loading,
}: {
  focusUnits: number | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="bio-card">
        <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="skeleton h-20 w-20 rounded-full" />
          <div className="skeleton h-4 w-40" />
        </CardContent>
      </Card>
    );
  }

  const units = focusUnits ?? 0;
  const maxUnits = 6;
  const pct = Math.min(units / maxUnits, 1);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);

  // Color based on remaining focus
  let color = "#22c55e";
  let label = "Good reserves";
  if (units <= 1) {
    color = "#ef4444";
    label = "Nearly depleted";
  } else if (units <= 2.5) {
    color = "#eab308";
    label = "Conserve energy";
  } else if (units <= 4) {
    color = "#3b82f6";
    label = "Steady pace";
  }

  const BatteryIcon = units <= 1 ? BatteryLow : units >= 4 ? BatteryFull : Battery;

  return (
    <Card
      className="bio-card relative overflow-hidden"
      style={{
        borderColor: focusUnits != null ? `${color}20` : undefined,
      }}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <BatteryIcon className="w-4 h-4" style={{ color }} />
          Focus Battery
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col items-center justify-center pt-2 gap-3">
        {focusUnits != null ? (
          <>
            <div className="relative inline-flex items-center justify-center">
              <svg width={120} height={120} className="ring-gauge-svg">
                <defs>
                  <linearGradient id="focus-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={color} />
                    <stop offset="100%" stopColor={`${color}88`} />
                  </linearGradient>
                </defs>
                <circle
                  cx={60}
                  cy={60}
                  r={radius}
                  fill="none"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth={10}
                />
                <circle
                  cx={60}
                  cy={60}
                  r={radius}
                  fill="none"
                  stroke="url(#focus-grad)"
                  strokeWidth={10}
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={offset}
                  className="ring-gauge-fill"
                  transform="rotate(-90 60 60)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tracking-tight">{units.toFixed(1)}</span>
                <span className="text-[10px] text-muted-foreground">hours</span>
              </div>
            </div>

            <div className="text-center">
              <p className="text-xs text-muted-foreground">
                Deep Work remaining
              </p>
              <p className="text-[10px] mt-1" style={{ color }}>
                {label}
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <Battery className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-xs text-muted-foreground/50 italic">
              Calculating focus budget…
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
