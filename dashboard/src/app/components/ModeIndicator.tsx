"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Zap,
  Flame,
  Brain,
  AlertTriangle,
  Coffee,
  Sparkles,
} from "lucide-react";

const MODE_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    color: string;
    glow: string;
    bg: string;
    description: string;
  }
> = {
  flow_state: {
    label: "Flow State",
    icon: <Zap className="w-6 h-6" />,
    color: "#22c55e",
    glow: "0 0 40px rgba(34, 197, 94, 0.3), 0 0 80px rgba(34, 197, 94, 0.1)",
    bg: "linear-gradient(135deg, rgba(34, 197, 94, 0.08), rgba(16, 185, 129, 0.04))",
    description: "You're in the zone. Protect this state.",
  },
  high_stress_grind: {
    label: "High-Stress Grind",
    icon: <Flame className="w-6 h-6" />,
    color: "#eab308",
    glow: "0 0 40px rgba(234, 179, 8, 0.3), 0 0 80px rgba(234, 179, 8, 0.1)",
    bg: "linear-gradient(135deg, rgba(234, 179, 8, 0.08), rgba(251, 146, 60, 0.04))",
    description: "Pushing hard. Watch your stress levels.",
  },
  distracted_procrastination: {
    label: "Distracted",
    icon: <Coffee className="w-6 h-6" />,
    color: "#f97316",
    glow: "0 0 40px rgba(249, 115, 22, 0.3), 0 0 80px rgba(249, 115, 22, 0.1)",
    bg: "linear-gradient(135deg, rgba(249, 115, 22, 0.08), rgba(239, 68, 68, 0.04))",
    description: "Time to refocus. Pick one task.",
  },
  critical_fatigue: {
    label: "Critical Fatigue",
    icon: <AlertTriangle className="w-6 h-6" />,
    color: "#ef4444",
    glow: "0 0 40px rgba(239, 68, 68, 0.3), 0 0 80px rgba(239, 68, 68, 0.1)",
    bg: "linear-gradient(135deg, rgba(239, 68, 68, 0.08), rgba(220, 38, 38, 0.04))",
    description: "Your body needs rest. Step away.",
  },
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export default function ModeIndicator({
  mode,
  loading,
  lastAnalysis,
  triggerAlerts,
}: {
  mode: string | null;
  loading: boolean;
  lastAnalysis: string | null;
  triggerAlerts: string[] | null;
}) {
  const config = mode ? MODE_CONFIG[mode] : null;
  const hasAlert = triggerAlerts && triggerAlerts.length > 0;

  if (loading) {
    return (
      <Card className="bio-card">
        <CardContent className="flex flex-col items-center justify-center py-10 gap-4">
          <div className="skeleton h-16 w-16 rounded-full" />
          <div className="skeleton h-5 w-32" />
          <div className="skeleton h-3 w-48" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className="bio-card relative overflow-hidden"
      style={{
        background: config?.bg ?? "rgba(255,255,255,0.03)",
        boxShadow: config?.glow ?? "none",
        borderColor: config
          ? `${config.color}30`
          : "rgba(255,255,255,0.06)",
      }}
    >
      {/* Ambient glow */}
      {config && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 30%, ${config.color}08 0%, transparent 70%)`,
          }}
        />
      )}

      <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          Current Mode
        </CardTitle>
        {lastAnalysis && (
          <span className="text-[10px] text-muted-foreground/50">
            {timeAgo(lastAnalysis)}
          </span>
        )}
      </CardHeader>

      <CardContent className="flex flex-col items-center justify-center pt-2 gap-3 relative z-10">
        {config ? (
          <>
            <motion.div
              animate={{
                scale: [1, 1.05, 1],
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{
                background: `${config.color}15`,
                color: config.color,
                boxShadow: `0 0 20px ${config.color}20`,
              }}
            >
              {config.icon}
            </motion.div>

            <div className="text-center">
              <motion.h3
                key={mode}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-lg font-bold tracking-tight"
                style={{ color: config.color }}
              >
                {config.label}
              </motion.h3>
              <p className="text-xs text-muted-foreground mt-1">
                {config.description}
              </p>
            </div>

            {hasAlert && (
              <Badge
                variant="outline"
                className="text-[10px] border-red-500/30 text-red-400 bg-red-500/10 animate-pulse"
              >
                ⚠ Override Active
              </Badge>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 py-4">
            <Sparkles className="w-10 h-10 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground/50">
              Waiting for analysis…
            </p>
            <p className="text-xs text-muted-foreground/30">
              AI Coach will analyze your data shortly
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
