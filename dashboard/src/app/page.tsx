"use client";

import { useEffect, useState } from "react";


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
  biometrics: Record<string, unknown> | null;
  lastUpdate: string;
}


function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function barColor(pct: number): string {
  if (pct < 50) return "#22c55e";
  if (pct < 80) return "#eab308";
  return "#ef4444";
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 5) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}


function StatCard({
  title,
  icon,
  value,
  sub,
  percent,
  delay,
}: {
  title: string;
  icon: string;
  value: string;
  sub?: string;
  percent?: number;
  delay: number;
}) {
  return (
    <div
      className="card animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{icon}</span>
          <span className="text-sm font-medium text-zinc-400">{title}</span>
        </div>
        {percent !== undefined && (
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{
              color: barColor(percent),
              background: `${barColor(percent)}18`,
            }}
          >
            {percent.toFixed(1)}%
          </span>
        )}
      </div>

      <p className="text-2xl font-semibold tracking-tight mb-1">{value}</p>

      {sub && <p className="text-xs text-zinc-500">{sub}</p>}

      {percent !== undefined && (
        <div className="progress-track mt-4">
          <div
            className="progress-fill"
            style={{
              width: `${Math.min(percent, 100)}%`,
              background: barColor(percent),
            }}
          />
        </div>
      )}
    </div>
  );
}


function PortsCard({
  ports,
  delay,
}: {
  ports: PortEntry[];
  delay: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = ports.filter(
    (p) =>
      String(p.port).includes(search) ||
      p.service.toLowerCase().includes(search.toLowerCase()) ||
      p.process.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="card animate-fade-in-up col-span-full"
      style={{ animationDelay: `${delay}ms` }}
    >

      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🔌</span>
          <span className="text-sm font-medium text-zinc-400">
            Ports &amp; Services
          </span>
          <span
            className="text-xs font-mono px-2 py-0.5 rounded-full"
            style={{ color: "#3b82f6", background: "#3b82f618" }}
          >
            {ports.length}
          </span>
        </div>
        <span
          className="text-zinc-500 transition-transform duration-300"
          style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          ▾
        </span>
      </button>

      <div
        className="ports-body"
        style={{
          maxHeight: expanded ? "400px" : "0px",
          opacity: expanded ? 1 : 0,
          marginTop: expanded ? "1rem" : "0",
        }}
      >
        <input
          type="text"
          placeholder="Filter by port, service, or process…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ports-search"
        />

        <div className="ports-list">
          {filtered.length === 0 && (
            <p className="text-xs text-zinc-600 text-center py-4">
              No matching ports
            </p>
          )}
          {filtered.map((p) => (
            <div key={p.port} className="port-row">
              <span className="port-badge">{p.port}</span>
              <span className="text-sm text-zinc-300 flex-1 truncate">
                {p.service}
              </span>
              <span className="text-xs text-zinc-500 font-mono truncate max-w-[140px]">
                {p.process}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


function SkeletonCard({ delay }: { delay: number }) {
  return (
    <div
      className="card animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="skeleton h-4 w-24 mb-4" />
      <div className="skeleton h-7 w-20 mb-2" />
      <div className="skeleton h-3 w-32 mb-4" />
      <div className="skeleton h-2 w-full" />
    </div>
  );
}


export default function Home() {
  const [data, setData] = useState<AgentData | null>(null);
  const [error, setError] = useState(false);

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
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const isFresh =
    data?.lastUpdate &&
    Date.now() - new Date(data.lastUpdate).getTime() < 120_000;

  return (
    <div className="min-h-screen px-6 py-12 md:px-12 lg:px-20">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10 animate-fade-in-up">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Agent Dashboard
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Real-time system telemetry
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-zinc-500">
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

      {data && data.systemStats ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="CPU Usage"
            icon="⚡"
            value={`${data.systemStats.cpu_usage.toFixed(1)}%`}
            percent={data.systemStats.cpu_usage}
            delay={0}
          />
          <StatCard
            title="Memory"
            icon="🧠"
            value={`${data.systemStats.memory_usage.toFixed(1)}%`}
            percent={data.systemStats.memory_usage}
            delay={60}
          />
          <StatCard
            title="Disk"
            icon="💾"
            value={`${data.systemStats.disk_usage.toFixed(1)}%`}
            percent={data.systemStats.disk_usage}
            delay={120}
          />
          <StatCard
            title="Network Sent"
            icon="📤"
            value={formatBytes(data.systemStats.network_usage[0])}
            sub="Total bytes transmitted"
            delay={180}
          />
          <StatCard
            title="Network Received"
            icon="📥"
            value={formatBytes(data.systemStats.network_usage[1])}
            sub="Total bytes received"
            delay={240}
          />
          <StatCard
            title="Battery"
            icon={
              data.systemStats.battery_info.is_charging
                ? "🔌"
                : data.systemStats.battery_info.percent !== null
                  ? data.systemStats.battery_info.percent > 20
                    ? "🔋"
                    : "🪫"
                  : "🔋"
            }
            value={
              data.systemStats.battery_info.percent !== null
                ? `${data.systemStats.battery_info.percent}%`
                : "N/A"
            }
            sub={
              data.systemStats.battery_info.is_charging
                ? "Charging"
                : data.systemStats.battery_info.percent !== null
                  ? "On battery"
                  : "No battery detected"
            }
            percent={data.systemStats.battery_info.percent ?? undefined}
            delay={300}
          />

          {data.systemStats.ports_services && data.systemStats.ports_services.length > 0 && (
            <PortsCard ports={data.systemStats.ports_services} delay={360} />
          )}
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 60, 120, 180, 240, 300].map((d) => (
            <SkeletonCard key={d} delay={d} />
          ))}
        </div>
      )}
    </div>
  );
}
