"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, TrendingUp, Moon, Footprints, Dumbbell, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

interface EfficiencyFactor {
  name: string;
  score: number;
  detail: string;
}

interface DailyReportProps {
  report: {
    efficiency_score?: number;
    factors?: EfficiencyFactor[];
    soreness_level?: string;
    ai_summary?: string;
    overall_score?: number;
    best_window?: { start: string; end: string };
    bullets?: string[];
  } | null;
  reportDate: string | null;
}

const FACTOR_ICONS: Record<string, React.ReactNode> = {
  "Sleep & Recovery": <Moon className="w-3.5 h-3.5 text-blue-400" />,
  "Physical Activity": <Footprints className="w-3.5 h-3.5 text-green-400" />,
  "Productive Focus": <Zap className="w-3.5 h-3.5 text-amber-400" />,
};

const SORENESS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  none: { bg: "bg-green-400/10", text: "text-green-400", label: "Fresh" },
  mild: { bg: "bg-blue-400/10", text: "text-blue-400", label: "Mild soreness" },
  moderate: { bg: "bg-amber-400/10", text: "text-amber-400", label: "Moderate soreness" },
  high: { bg: "bg-red-400/10", text: "text-red-400", label: "High soreness" },
};

function scoreColor(s: number): string {
  if (s >= 0.7) return "#22c55e";
  if (s >= 0.4) return "#eab308";
  return "#ef4444";
}

function scoreGrade(s: number): string {
  if (s >= 0.85) return "A+";
  if (s >= 0.7) return "A";
  if (s >= 0.55) return "B";
  if (s >= 0.4) return "C";
  if (s >= 0.25) return "D";
  return "F";
}

export default function DailyReport({ report, reportDate }: DailyReportProps) {
  if (!report) {
    return (
      <Card className="bio-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            Efficiency
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[140px] flex flex-col items-center justify-center text-muted-foreground/40 text-sm">
            <Zap className="w-8 h-8 mb-2 opacity-30" />
            Waiting for enough data…
          </div>
        </CardContent>
      </Card>
    );
  }

  const score = report.efficiency_score ?? report.overall_score ?? 0;
  const factors = report.factors ?? [];
  const soreness = report.soreness_level ?? "none";
  const sorenessInfo = SORENESS_COLORS[soreness] ?? SORENESS_COLORS.none;
  const aiSummary = report.ai_summary;

  return (
    <Card className="bio-card relative overflow-hidden">
      {/* subtle glow based on score */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at top right, ${scoreColor(score)}10, transparent 70%)`,
        }}
      />

      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          Efficiency
        </CardTitle>
        <div className="flex items-center gap-2">
          {soreness !== "none" && (
            <Badge
              variant="outline"
              className={`text-[10px] border-0 ${sorenessInfo.bg} ${sorenessInfo.text}`}
            >
              <Dumbbell className="w-3 h-3 mr-0.5" />
              {sorenessInfo.label}
            </Badge>
          )}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{
              background: `${scoreColor(score)}15`,
              boxShadow: `0 0 20px ${scoreColor(score)}20`,
            }}
          >
            <span
              className="text-base font-bold"
              style={{ color: scoreColor(score) }}
            >
              {scoreGrade(score)}
            </span>
          </motion.div>
        </div>
      </CardHeader>

      <CardContent className="pt-3 relative z-10">
        {/* AI Summary */}
        {aiSummary && (
          <div className="flex items-start gap-2 mb-4 px-2 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/70 leading-relaxed">{aiSummary}</p>
          </div>
        )}

        {/* Factor bars */}
        <div className="space-y-3">
          {factors.map((factor, i) => (
            <motion.div
              key={factor.name}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {FACTOR_ICONS[factor.name] ?? (
                    <Zap className="w-3.5 h-3.5 text-muted-foreground/50" />
                  )}
                  <span className="text-xs text-foreground/70">{factor.name}</span>
                </div>
                <span className="text-[10px] text-muted-foreground/50">
                  {factor.detail}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/[0.05] overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${factor.score * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.1, ease: "easeOut" }}
                  style={{ background: scoreColor(factor.score) }}
                />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Overall score bar */}
        <div className="mt-4 pt-3 border-t border-white/[0.04]">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-foreground/70 font-medium">Overall</span>
            <span
              className="text-sm font-bold"
              style={{ color: scoreColor(score) }}
            >
              {Math.round(score * 100)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/[0.05] overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${score * 100}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{
                background: `linear-gradient(90deg, ${scoreColor(score)}80, ${scoreColor(score)})`,
              }}
            />
          </div>
        </div>

        {reportDate && (
          <p className="text-[10px] text-muted-foreground/30 mt-2 text-right">
            {reportDate}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
