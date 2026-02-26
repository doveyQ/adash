"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ModeIndicator from "./ModeIndicator";
import AIWhisperer from "./AIWhisperer";
import FlowPredictor from "./FlowPredictor";
import ResourceBudget from "./ResourceBudget";
import DailyReport from "./DailyReport";
import GitHubSentiment from "./GitHubSentiment";
import ProductivityCorrelation from "./ProductivityCorrelation";

/* ─── Types ──────────────────────────────────────── */

export interface AIInsight {
  mode: string | null;
  nudges: string[];
  flowPrediction: {
    estimated_crash_hour: number;
    energy_curve: { hour: number; energy: number }[];
    confidence: number;
  } | null;
  focusUnitsRemaining: number | null;
  dailyReport: {
    efficiency_score?: number;
    factors?: { name: string; score: number; detail: string }[];
    soreness_level?: string;
    ai_summary?: string;
    overall_score?: number;
    best_window?: { start: string; end: string };
    bullets?: string[];
  } | null;
  dailyReportDate: string | null;
  triggerAlerts: string[] | null;
  lastAnalysis: string | null;
}

/* ─── Main HUD ───────────────────────────────────── */

export default function FlowStateHUD() {
  const [insight, setInsight] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/insights", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setInsight(data);
      }
    } catch {
      // Silently retry
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    const id = setInterval(fetchInsights, 10_000);
    return () => clearInterval(id);
  }, [fetchInsights]);

  return (
    <div className="space-y-6">
      {/* ── Top Row: Mode + Nudges + Focus Budget ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="grid gap-5 lg:grid-cols-3"
      >
        <ModeIndicator
          mode={insight?.mode ?? null}
          loading={loading}
          lastAnalysis={insight?.lastAnalysis ?? null}
          triggerAlerts={insight?.triggerAlerts ?? null}
        />
        <AIWhisperer
          nudges={insight?.nudges ?? []}
          mode={insight?.mode ?? undefined}
        />
        <ResourceBudget
          focusUnits={insight?.focusUnitsRemaining ?? null}
          loading={loading}
        />
      </motion.div>

      {/* ── Alert Banner ── */}
      <AnimatePresence>
        {insight?.triggerAlerts && insight.triggerAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-xl border border-red-500/30 bg-red-500/5 backdrop-blur-sm px-5 py-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
              <span className="text-sm font-semibold text-red-400">
                ⚠ System Override
              </span>
            </div>
            {insight.triggerAlerts.map((alert, i) => (
              <p key={i} className="text-sm text-red-300/80 ml-6">
                {alert}
              </p>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Middle Row: Flow Predictor + Daily Report ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        className="grid gap-5 lg:grid-cols-2"
      >
        <FlowPredictor
          prediction={insight?.flowPrediction ?? null}
          loading={loading}
        />
        <DailyReport
          report={insight?.dailyReport ?? null}
          reportDate={insight?.dailyReportDate ?? null}
        />
      </motion.div>

      {/* ── Bottom Row: GitHub Sentiment + Productivity Correlation ── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="grid gap-5 lg:grid-cols-2"
      >
        <GitHubSentiment />
        <ProductivityCorrelation />
      </motion.div>
    </div>
  );
}
