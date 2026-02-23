"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Heart, Monitor } from "lucide-react";
import BiometricsView from "./components/BiometricsView";
import SystemView from "./components/SystemView";

/* ─── Types ──────────────────────────────────────── */

interface PortEntry {
  port: number;
  service: string;
  process: string;
}

interface SystemStats {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  network_usage: [number, number];
  battery_info: { percent: number | null; is_charging: boolean | null };
  ports_services?: PortEntry[];
}

interface AgentData {
  systemStats: SystemStats | null;
  lastUpdate: string;
}

/* ─── Helpers ────────────────────────────────────── */

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/* ─── Main Page ──────────────────────────────────── */

export default function Home() {
  const [data, setData] = useState<AgentData | null>(null);
  const [error, setError] = useState(false);
  const [, setTick] = useState(0);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    let active = true;

    async function poll() {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (active && json.lastUpdate) {
          setData(json);
          setError(false);
        }
      } catch {
        if (active) setError(true);
      }
    }

    poll();
    const id = setInterval(poll, 2000);
    const tickId = setInterval(() => setTick((t) => t + 1), 1000);

    return () => {
      active = false;
      clearInterval(id);
      clearInterval(tickId);
    };
  }, []);

  const isFresh =
    data?.lastUpdate &&
    Date.now() - new Date(data.lastUpdate).getTime() < 120_000;

  return (
    <div className="min-h-screen px-6 py-12 md:px-12 lg:px-20">
      {/* ── Header ────────────────────────────── */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agent Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time system &amp; health telemetry
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            className="inline-block w-2 h-2 rounded-full animate-pulse-soft"
            style={{ background: isFresh ? "#22c55e" : "#ef4444" }}
          />
          {data?.lastUpdate ? (
            <span>Updated {timeAgo(data.lastUpdate)}</span>
          ) : error ? (
            <span className="text-red-400">Connection lost</span>
          ) : (
            <span>Waiting for data…</span>
          )}
        </div>
      </header>

      {/* ── Tabs ──────────────────────────────── */}
      <Tabs defaultValue="biometrics" className="w-full">
        <TabsList variant="line" className="mb-8 bg-transparent border-b border-white/[0.06] rounded-none w-full justify-start gap-1">
          <TabsTrigger
            value="biometrics"
            className="data-[state=active]:text-rose-400 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-rose-400 px-4 py-2 transition-all"
          >
            <Heart className="w-4 h-4" />
            Biometrics
          </TabsTrigger>
          <TabsTrigger
            value="system"
            className="data-[state=active]:text-sky-400 gap-2 rounded-none border-b-2 border-transparent data-[state=active]:border-sky-400 px-4 py-2 transition-all"
          >
            <Monitor className="w-4 h-4" />
            System
          </TabsTrigger>
        </TabsList>

        <TabsContent value="biometrics" className="tab-content-enter">
          <BiometricsView
            selectedDate={selectedDate}
            onDateChange={setSelectedDate}
          />
        </TabsContent>

        <TabsContent value="system" className="tab-content-enter">
          <SystemView data={data?.systemStats ?? null} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
