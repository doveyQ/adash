"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  GitCommit,
  Frown,
  Smile,
  Meh,
  CircleDot,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  History,
} from "lucide-react";

/* ─── Types ────────────────────────────────────── */

interface CommitMessage {
  sha: string;
  message: string;
  repo: string;
  timestamp: string;
  author?: string;
}

interface Issue {
  number: number;
  title: string;
  state: string;
  repo: string;
  labels: string[];
  url: string;
  updated_at: string;
}

interface RepoHistory {
  repo: string;
  totalCommits: number;
  latestDate: string;
  commits: { sha: string; message: string; timestamp: string; author?: string; date: string }[];
}

interface SentimentEntry {
  message: string;
  score: number;
  signal: string;
}

/* ─── Helpers ───────────────────────────────────── */

function frustrationColor(score: number): string {
  if (score <= 0.3) return "#22c55e";
  if (score <= 0.6) return "#eab308";
  return "#ef4444";
}

function frustrationLabel(score: number): string {
  if (score <= 0.2) return "Calm";
  if (score <= 0.4) return "Focused";
  if (score <= 0.6) return "Stressed";
  if (score <= 0.8) return "Frustrated";
  return "Critical";
}

const LABEL_COLORS: Record<string, string> = {
  bug: "#ef4444",
  enhancement: "#3b82f6",
  feature: "#8b5cf6",
  documentation: "#6b7280",
  "good first issue": "#22c55e",
  "help wanted": "#eab308",
};

/* ─── Main Component ───────────────────────────── */

export default function GitHubSentiment() {
  const [todayCommits, setTodayCommits] = useState<CommitMessage[]>([]);
  const [todaySentiment, setTodaySentiment] = useState<SentimentEntry[]>([]);
  const [todayFrustration, setTodayFrustration] = useState(0);
  const [todayIssues, setTodayIssues] = useState<Issue[]>([]);
  const [recentRepos, setRecentRepos] = useState<RepoHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"commits" | "repos" | "issues">("commits");
  const [expandedRepo, setExpandedRepo] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const r = await fetch("/api/github", { cache: "no-store" });
        const data = await r.json();
        setTodayCommits(data.todayCommits ?? []);
        setTodaySentiment(data.todaySentiment ?? []);
        setTodayFrustration(data.todayFrustration ?? 0);
        setTodayIssues(data.todayIssues ?? []);
        setRecentRepos(data.recentRepos ?? []);
      } catch {
        // retry on next poll
      } finally {
        setLoading(false);
      }
    };
    fetchData();
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <Card className="bio-card">
        <CardHeader className="pb-2">
          <div className="skeleton h-4 w-36" />
        </CardHeader>
        <CardContent>
          <div className="skeleton h-[160px] w-full rounded-lg" />
        </CardContent>
      </Card>
    );
  }

  const hasCommits = todayCommits.length > 0 || todaySentiment.length > 0;
  const hasRepos = recentRepos.length > 0;
  const hasIssues = todayIssues.length > 0;

  // Deduplicate issues
  const uniqueIssues = todayIssues.filter(
    (issue, idx, arr) =>
      arr.findIndex((i) => i.number === issue.number && i.repo === issue.repo) === idx
  );

  const FrustrationIcon =
    todayFrustration <= 0.3 ? Smile : todayFrustration <= 0.6 ? Meh : Frown;

  return (
    <Card className="bio-card">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <GitCommit className="w-4 h-4 text-purple-400" />
          GitHub
        </CardTitle>
        <div className="flex items-center gap-2">
          {/* Tab toggle */}
          <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.03] p-0.5">
            <button
              onClick={() => setTab("commits")}
              className={`px-2 py-0.5 rounded-md text-[10px] transition-all ${tab === "commits"
                ? "bg-purple-400/15 text-purple-400"
                : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}
            >
              Today{hasCommits ? ` (${todayCommits.length})` : ""}
            </button>
            <button
              onClick={() => setTab("repos")}
              className={`px-2 py-0.5 rounded-md text-[10px] transition-all ${tab === "repos"
                ? "bg-indigo-400/15 text-indigo-400"
                : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}
            >
              Repos{hasRepos ? ` (${recentRepos.length})` : ""}
            </button>
            <button
              onClick={() => setTab("issues")}
              className={`px-2 py-0.5 rounded-md text-[10px] transition-all ${tab === "issues"
                ? "bg-amber-400/15 text-amber-400"
                : "text-muted-foreground/50 hover:text-muted-foreground"
                }`}
            >
              Issues{hasIssues ? ` (${uniqueIssues.length})` : ""}
            </button>
          </div>
          {tab === "commits" && hasCommits && (
            <Badge
              variant="outline"
              className="text-[10px] border-0 gap-1"
              style={{
                color: frustrationColor(todayFrustration),
                background: `${frustrationColor(todayFrustration)}15`,
              }}
            >
              <FrustrationIcon className="w-3 h-3" />
              {frustrationLabel(todayFrustration)}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-3">
        {/* ── Today's Commits ── */}
        {tab === "commits" ? (
          hasCommits ? (
            <div className="space-y-2">
              {todaySentiment.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap mb-3">
                  <TooltipProvider>
                    {todaySentiment.slice(0, 30).map((s, i) => (
                      <Tooltip key={i}>
                        <TooltipTrigger>
                          <span
                            className="inline-block w-3 h-3 rounded-full transition-transform hover:scale-150 cursor-pointer"
                            style={{
                              background: frustrationColor(s.score),
                              boxShadow: `0 0 6px ${frustrationColor(s.score)}40`,
                            }}
                          />
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px]">
                          <p className="text-xs font-medium mb-1">
                            {s.message?.slice(0, 60)}
                            {s.message?.length > 60 ? "…" : ""}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Score: {s.score?.toFixed(2)}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>
              )}

              <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                {todaySentiment.length > 0
                  ? todaySentiment.slice(0, 10).map((s, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: frustrationColor(s.score) }}
                      />
                      <span className="text-xs truncate flex-1 text-foreground/70">
                        {s.message?.slice(0, 50)}
                        {s.message?.length > 50 ? "…" : ""}
                      </span>
                      <span
                        className="text-[10px] font-mono shrink-0"
                        style={{ color: frustrationColor(s.score) }}
                      >
                        {s.score?.toFixed(1)}
                      </span>
                    </div>
                  ))
                  : todayCommits.slice(0, 10).map((c, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: frustrationColor(todayFrustration) }}
                      />
                      <span className="text-xs truncate flex-1 text-foreground/70">
                        {c.message?.slice(0, 50)}
                        {c.message?.length > 50 ? "…" : ""}
                      </span>
                      <span className="text-[10px] font-mono shrink-0 text-muted-foreground/60">
                        {c.repo?.split("/")[1]}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          ) : (
            <div className="h-[160px] flex flex-col items-center justify-center text-muted-foreground/40">
              <GitCommit className="w-8 h-8 mb-2 opacity-30" />
              <span className="text-sm">No commits today</span>
              <span className="text-xs mt-1">Commits from today will appear here</span>
            </div>
          )
        ) : tab === "repos" ? (
          /* ── Recent Repos History ── */
          hasRepos ? (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {recentRepos.map((repo, i) => (
                <div key={i}>
                  <button
                    onClick={() =>
                      setExpandedRepo(expandedRepo === repo.repo ? null : repo.repo)
                    }
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
                  >
                    {expandedRepo === repo.repo ? (
                      <ChevronDown className="w-3 h-3 text-indigo-400 shrink-0" />
                    ) : (
                      <ChevronRight className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    )}
                    <History className="w-3 h-3 text-indigo-400/60 shrink-0" />
                    <span className="text-xs flex-1 text-foreground/80">
                      {repo.repo.split("/")[1] || repo.repo}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {repo.totalCommits} commits
                    </span>
                    <span className="text-[10px] text-muted-foreground/40">
                      {repo.latestDate}
                    </span>
                  </button>
                  {expandedRepo === repo.repo && (
                    <div className="ml-6 mt-1 space-y-1 mb-2">
                      {repo.commits.slice(0, 10).map((c, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.01]"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400/40 shrink-0" />
                          <span className="text-[11px] truncate flex-1 text-foreground/60">
                            {c.message?.slice(0, 50)}
                            {c.message?.length > 50 ? "…" : ""}
                          </span>
                          <span className="text-[9px] text-muted-foreground/40">
                            {c.date}
                          </span>
                        </div>
                      ))}
                      {repo.commits.length > 10 && (
                        <span className="text-[10px] text-muted-foreground/40 ml-2">
                          +{repo.commits.length - 10} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[160px] flex flex-col items-center justify-center text-muted-foreground/40">
              <History className="w-8 h-8 mb-2 opacity-30" />
              <span className="text-sm">No repo history</span>
              <span className="text-xs mt-1">Previous day commits will appear here</span>
            </div>
          )
        ) : /* ── Issues ── */
          hasIssues ? (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto">
              {uniqueIssues.slice(0, 15).map((issue, i) => (
                <a
                  key={i}
                  href={issue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 px-2 py-1.5 rounded-md bg-white/[0.02] hover:bg-white/[0.04] transition-colors group"
                >
                  <CircleDot className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-foreground/70 truncate block group-hover:text-foreground/90">
                      {issue.title}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] text-muted-foreground/50">
                        #{issue.number}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">
                        {issue.repo.split("/")[1]}
                      </span>
                      {issue.labels.slice(0, 2).map((label) => (
                        <span
                          key={label}
                          className="text-[9px] px-1 py-0 rounded"
                          style={{
                            color: LABEL_COLORS[label.toLowerCase()] ?? "#818cf8",
                            background:
                              (LABEL_COLORS[label.toLowerCase()] ?? "#818cf8") + "15",
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground/30 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ))}
            </div>
          ) : (
            <div className="h-[160px] flex flex-col items-center justify-center text-muted-foreground/40">
              <CircleDot className="w-8 h-8 mb-2 opacity-30" />
              <span className="text-sm">No open issues</span>
              <span className="text-xs mt-1">Issues assigned to you will appear here</span>
            </div>
          )}
      </CardContent>
    </Card>
  );
}
