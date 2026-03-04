"use client";

import { useEffect, useState } from "react";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Sparkles,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────── */

interface InsightData {
    narrative: string;
    correlations: Record<string, unknown> | null;
    recommendations: Record<string, unknown> | null;
    date: string;
    created_at: string;
}

/* ─── Insight Card ───────────────────────────────── */

export default function InsightCard({ date }: { date?: string }) {
    const [insight, setInsight] = useState<InsightData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        const params = date ? `?date=${date}` : "";
        fetch(`/api/insights${params}`, { cache: "no-store" })
            .then((r) => r.json())
            .then((json) => {
                setInsight(json.insight ?? null);
            })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [date]);

    if (loading) {
        return (
            <Card className="insight-card animate-fade-in-up">
                <CardContent className="flex items-center gap-3 py-6">
                    <div className="skeleton h-5 w-full" />
                </CardContent>
            </Card>
        );
    }

    if (!insight) {
        return (
            <Card className="insight-card animate-fade-in-up">
                <CardContent className="flex items-center gap-4 py-5">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-indigo-500/20 flex items-center justify-center shrink-0">
                        <Sparkles className="w-5 h-5 text-violet-400" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">
                            No AI synthesis available yet. The Daily Brief will appear here
                            once Ollama generates an insight.
                        </p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="insight-card animate-fade-in-up">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    Daily Brief
                </CardTitle>
                <Badge
                    variant="outline"
                    className="text-xs border-0 text-violet-400 bg-violet-400/10"
                >
                    AI Insight
                </Badge>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="prose prose-invert prose-sm max-w-none">
                    {insight.narrative.split("\n\n").map((paragraph, i) => (
                        <p
                            key={i}
                            className="text-sm leading-relaxed text-muted-foreground/90 mb-3 last:mb-0"
                        >
                            {paragraph}
                        </p>
                    ))}
                </div>
                <div className="mt-4 pt-3 border-t border-white/[0.04]">
                    <span className="text-[10px] text-muted-foreground/40">
                        Generated{" "}
                        {new Date(insight.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                </div>
            </CardContent>
        </Card>
    );
}
