"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Sparkles } from "lucide-react";

interface AIWhispererProps {
  nudges?: string[];
  mode?: string;
}

const MODE_GLOW: Record<string, string> = {
  flow_state: "from-emerald-500/20 to-emerald-500/0",
  high_stress_grind: "from-amber-500/20 to-amber-500/0",
  distracted_procrastination: "from-rose-400/20 to-rose-400/0",
  critical_fatigue: "from-red-500/20 to-red-500/0",
};

export default function AIWhisperer({ nudges = [], mode }: AIWhispererProps) {
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);

  // Get the single insight (first and only nudge)
  const insight = nudges.length > 0 ? nudges[0] : null;

  useEffect(() => {
    if (!insight) {
      setDisplayedText("");
      return;
    }

    setDisplayedText("");
    setIsTyping(true);
    let idx = 0;

    const interval = setInterval(() => {
      idx++;
      setDisplayedText(insight.slice(0, idx));
      if (idx >= insight.length) {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 22);

    return () => clearInterval(interval);
  }, [insight]);

  const glowClass = MODE_GLOW[mode ?? ""] ?? MODE_GLOW.distracted_procrastination;

  if (!insight) {
    return (
      <Card className="bio-card relative overflow-hidden">
        <div
          className={`absolute inset-0 bg-gradient-to-br ${glowClass} pointer-events-none`}
        />
        <CardHeader className="pb-2 relative z-10">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-400" />
            AI Coach
          </CardTitle>
        </CardHeader>
        <CardContent className="relative z-10">
          <div className="h-[60px] flex items-center justify-center text-muted-foreground/40 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-indigo-400/40 animate-pulse" />
              Analyzing your state…
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bio-card relative overflow-hidden">
      <div
        className={`absolute inset-0 bg-gradient-to-br ${glowClass} pointer-events-none`}
      />

      {/* Shimmer effect */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent pointer-events-none"
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
      />

      <CardHeader className="pb-2 relative z-10">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Brain className="w-4 h-4 text-indigo-400" />
          AI Coach
          <Sparkles className="w-3 h-3 text-amber-400/60" />
        </CardTitle>
      </CardHeader>

      <CardContent className="relative z-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={insight}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
          >
            <p className="text-sm text-foreground/90 leading-relaxed min-h-[48px]">
              {displayedText}
              {isTyping && (
                <motion.span
                  className="inline-block w-[2px] h-[14px] bg-indigo-400 ml-0.5 align-middle"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              )}
            </p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-2 mt-3 text-[10px] text-muted-foreground/40">
          <div className="w-1.5 h-1.5 rounded-full bg-indigo-400/40" />
          AI-powered insight with contextual memory
        </div>
      </CardContent>
    </Card>
  );
}
