"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Sunrise, AlertCircle, Lightbulb } from "lucide-react";

export default function DailyPostMortem({
  postmortem,
  loading,
}: {
  postmortem: {
    bullets: string[];
    best_window?: { start: string; end: string };
    wall_time?: string;
    overall_score?: number;
  } | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <Card className="bio-card">
        <CardHeader className="pb-2">
          <div className="skeleton h-4 w-40" />
        </CardHeader>
        <CardContent className="space-y-3 pt-4">
          <div className="skeleton h-4 w-full" />
          <div className="skeleton h-4 w-5/6" />
          <div className="skeleton h-4 w-full" />
        </CardContent>
      </Card>
    );
  }

  const icons = [Sunrise, AlertCircle, Lightbulb];
  const colors = ["#22c55e", "#eab308", "#3b82f6"];

  return (
    <Card className="bio-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-400" />
          Daily Post-Mortem
        </CardTitle>
        {postmortem?.overall_score != null && (
          <Badge
            variant="outline"
            className="text-[10px] border-0"
            style={{
              color:
                postmortem.overall_score >= 0.7
                  ? "#22c55e"
                  : postmortem.overall_score >= 0.4
                    ? "#eab308"
                    : "#ef4444",
              background:
                postmortem.overall_score >= 0.7
                  ? "#22c55e15"
                  : postmortem.overall_score >= 0.4
                    ? "#eab30815"
                    : "#ef444415",
            }}
          >
            Score: {(postmortem.overall_score * 100).toFixed(0)}%
          </Badge>
        )}
      </CardHeader>

      <CardContent className="pt-3">
        {postmortem && postmortem.bullets?.length > 0 ? (
          <div className="space-y-3">
            {postmortem.bullets.map((bullet, i) => {
              const Icon = icons[i] ?? Lightbulb;
              const color = colors[i] ?? "#3b82f6";

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.15, duration: 0.3 }}
                  className="flex gap-3"
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                    style={{ background: `${color}15` }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <p className="text-sm leading-relaxed text-foreground/80">
                    {bullet}
                  </p>
                </motion.div>
              );
            })}

            {(postmortem.best_window || postmortem.wall_time) && (
              <div className="flex gap-4 pt-2 mt-2 border-t border-white/5 text-[10px] text-muted-foreground/50">
                {postmortem.best_window && (
                  <span>
                    Peak: {postmortem.best_window.start}–
                    {postmortem.best_window.end}
                  </span>
                )}
                {postmortem.wall_time && (
                  <span>Wall: {postmortem.wall_time}</span>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="h-[140px] flex flex-col items-center justify-center text-muted-foreground/40">
            <FileText className="w-8 h-8 mb-2 opacity-30" />
            <span className="text-sm">No post-mortem yet</span>
            <span className="text-xs mt-1">
              Generated at end of each day
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
