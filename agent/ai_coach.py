"""
FlowState AI Coach v5 — Local State + Extracted Analyzers.

Changes from v4:
- Reads data from local SQLite store (no HTTP round-trips to dashboard)
- Scoring/detection functions moved to analyzers.py
- Still POSTs results to the dashboard (legitimate writes)
- Still calls Ollama for LLM-powered insights
"""

import os
import logging
import time
import requests
from datetime import datetime
from constants import PRODUCTIVE_KEYWORDS

from analyzers import (
    clamp,
    compute_bio_score,
    compute_focus_score,
    compute_distraction_score,
    compute_stress_score,
    compute_activity_modifier,
    detect_mode,
    compute_focus_units,
    generate_energy_curve,
    compute_hours_awake,
    compute_sweet_spot_stats,
    compute_efficiency_factors,
)

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


class AICoach:
    def __init__(self, store=None):
        self.api_url = os.getenv("API_URL", "http://localhost:3000")
        self.api_key = os.getenv("API_KEY", "")
        self.analysis_interval = int(os.getenv("AI_ANALYSIS_INTERVAL", "300"))
        self.store = store  # LocalStore instance — reads data from here

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    # ── Data Access (local store OR HTTP fallback) ─────

    def _get_data(self) -> dict:
        """Get all data from local store. Falls back to HTTP if no store."""
        if self.store:
            return self.store.get_all_state()

        # Legacy HTTP fallback (will be removed in Phase 3)
        data = {}
        endpoints = [
            "status", "productivity", "github",
            "coach_history", "settings", "tasks",
        ]
        for ep in endpoints:
            try:
                r = requests.get(f"{self.api_url}/api/{ep}", timeout=10)
                if r.ok:
                    data[ep.replace("/", "_")] = r.json()
            except Exception as e:
                logger.debug("Failed to fetch %s: %s", ep, e)
        return data

    def _get_insight_history(self) -> list[str]:
        """Get previous insights for memory context."""
        if self.store:
            return self.store.get_coach_history(5)

        # Legacy HTTP fallback
        try:
            r = requests.get(
                f"{self.api_url}/api/ai/insights?history=5",
                timeout=10,
            )
            if r.ok:
                history = r.json().get("insightHistory", [])
                insights = []
                for h in history:
                    nudges = h.get("nudges") or []
                    if isinstance(nudges, list) and nudges:
                        insights.append(str(nudges[0]))
                    elif isinstance(nudges, str):
                        insights.append(nudges)
                return insights[:5]
        except Exception as e:
            logger.debug("Failed to fetch insight history: %s", e)
        return []

    # ── LLM: Single Insight with Memory ──────────────────

    def _generate_insight(self, state: dict, previous_insights: list[str]) -> str:
        """Use LLM to generate a SINGLE high-impact insight, aware of past insights."""
        app_summary = ", ".join(
            f"{app}: {mins}min" for app, mins in list(state.get("app_durations", {}).items())[:5]
        ) or "no app data"

        tasks = state.get("user_tasks", [])
        task_str = ", ".join(
            f"{'✅' if t.get('completed') else '⬜'} {t.get('title', '?')}" for t in tasks[:5]
        ) if tasks else "no tasks set"

        memory_str = ""
        if previous_insights:
            memory_str = "\n\nYour previous insights (DO NOT repeat these, build on them):\n"
            for i, insight in enumerate(previous_insights, 1):
                memory_str += f"  {i}. {insight}\n"

        prompt = f"""You are FlowState, an expert AI productivity and wellness coach. Based on this person's COMPLETE state, provide the ONE single most important, actionable insight they need RIGHT NOW.

Think deeply about all the data. Consider trade-offs between productivity and health. Reason about what matters most at this moment in their day.

Current state:
- Mode: {state['mode']}
- Hours awake: {state['hours_awake']:.1f}h
- Focus battery: {state['focus_units']}/8 units
- Bio score: {state['bio_score']:.0%} (Sleep: {state['sleep_hours']}h, HRV: {state['hrv_ms']}ms)
- Currently using: {state['active_window']}
- Browser tab: {state.get('browser_tab', 'none')}
- App time today: {app_summary}
- Productive app focus: {state['focus_score']:.0%}
- Distraction level: {state['distraction_score']:.0%}
- Commit frustration: {state['stress_score']:.0%}
- Physical activity: training load {state['training_load']}, steps {state.get('steps', 'N/A')}
- Crash hour estimate: {state['crash_hour']}:00
- Current tasks: {task_str}
{memory_str}

IMPORTANT rules:
1. Give exactly ONE insight — the most impactful thing they should know or do right now
2. Reference ACTUAL data from above. Never invent values.
3. Max 25 words. Be specific — name the app, time, or metric.
4. Think holistically: balance work performance with physical and mental wellness
5. If you've given similar insights before (see previous insights), find a NEW angle
6. Consider: break timing, hydration, posture, task progress, energy management

Respond ONLY with a single string (no JSON, no quotes, no explanation): your one insight."""

        try:
            r = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
                timeout=120,
            )
            r.raise_for_status()
            text = r.json().get("response", "").strip().strip('"\'')
            if text and len(text) < 200:
                return text
        except Exception as e:
            logger.error("Insight generation error: %s", e)

        # Fallback
        active = state.get('active_window', 'your current app')
        awake = state['hours_awake']
        load = state.get('training_load', 0)
        fallbacks = {
            "flow_state": f"Deep focus on {active} — protect this flow, avoid context switches",
            "critical_fatigue": f"You've been awake {awake:.0f}h — start winding down, your body needs recovery",
            "high_stress_grind": f"High commit frustration detected — take 5 min walk before continuing on {active}",
            "distracted_procrastination": "Low focus detected — pick ONE task, commit to 25 min of focused work"
                + (f" (consider a walk first, {load} training load)" if load < 10 else ""),
        }
        return fallbacks.get(state["mode"], fallbacks["distracted_procrastination"])

    # ── LLM: Efficiency Summary ──────────────────────────

    def _generate_efficiency_summary(self, state: dict) -> str:
        """Use LLM to generate one-line efficiency interpretation."""
        factors_str = "\n".join(
            f"  - {f['name']}: {f['score']:.0%} ({f['detail']})"
            for f in state.get("factors", [])
        )
        prompt = f"""You are an efficiency analyst. Based on this data, write ONE concise sentence (max 20 words) interpreting the user's current efficiency and what's driving it.

Efficiency: {state['efficiency_score']:.0%}
Mode: {state['mode']}
Hours awake: {state['hours_awake']:.1f}h
Focus battery: {state['focus_units']}/8
Soreness: {state['soreness_level']}
Commits: {state['commit_count']} (frustration: {state['frustration']:.2f})
Factors:
{factors_str}

Respond ONLY with the single sentence, no quotes."""

        try:
            r = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
                timeout=60,
            )
            r.raise_for_status()
            text = r.json().get("response", "").strip().strip('"\'')
            if text and len(text) < 150:
                return text
        except Exception as e:
            logger.debug("Efficiency summary LLM error: %s", e)

        score = state["efficiency_score"]
        if score >= 0.7:
            return "Strong efficiency — sleep and focus are supporting high output today"
        elif score >= 0.4:
            return "Moderate efficiency — consider optimizing either recovery or focus time"
        else:
            return "Low efficiency — prioritize rest and recovery to boost tomorrow's output"

    # ── LLM: Sweet Spot Summary ──────────────────────────

    def _generate_sweet_spot_summary(self, hour_stats: list[dict]) -> str:
        """Use LLM to summarize best working times."""
        stats_str = "\n".join(
            f"  {s['hour']}:00 — {s['productiveRatio']:.0%} productive "
            f"({s['totalEntries']} entries, top app: {s['topApp']})"
            for s in hour_stats
        )
        prompt = f"""You are a productivity analyst. Based on this hourly breakdown of a person's day, identify their BEST working time window and explain why in ONE sentence (max 20 words).

Hourly productivity:
{stats_str}

Respond ONLY with the single sentence, no quotes."""

        try:
            r = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={"model": OLLAMA_MODEL, "prompt": prompt, "stream": False},
                timeout=60,
            )
            r.raise_for_status()
            text = r.json().get("response", "").strip().strip('"\'')
            if text and len(text) < 150:
                return text
        except Exception as e:
            logger.debug("Sweet spot summary LLM error: %s", e)

        if hour_stats:
            best = max(hour_stats, key=lambda s: s["productiveRatio"])
            return f"Peak productivity at {best['hour']}:00 ({best['productiveRatio']:.0%} focus) on {best['topApp']}"
        return "Not enough data to determine your sweet spot yet"

    # ── Report Builders ──────────────────────────────────

    def _build_efficiency_report(self, data: dict, mode: str, focus_units: float,
                                  hours_awake: float, energy_curve: dict) -> dict:
        """Build efficiency report using analyzers + LLM summary."""
        status = data.get("status", {})
        bio = status.get("biometrics") or {}
        prod = data.get("productivity", {})
        timeline = prod.get("timeline", [])
        gh = data.get("github", {})
        entries = gh.get("entries", [])

        factors = compute_efficiency_factors(bio, timeline, gh)

        # Training load / soreness
        activities = bio.get("activities") or []
        total_load = sum(a.get("icu_training_load", 0) or 0 for a in activities)
        soreness_level = "none"
        if total_load > 80:
            soreness_level = "high"
        elif total_load > 40:
            soreness_level = "moderate"
        elif total_load > 15:
            soreness_level = "mild"

        factor_scores = [f["score"] for f in factors]
        efficiency_score = sum(factor_scores) / max(len(factor_scores), 1)

        commit_count = 0
        frustration = 0
        if entries:
            commits_data = entries[0].get("commitMessages") or []
            commit_count = len(commits_data)
            frustration = entries[0].get("frustrationScore", 0) or 0

        ai_summary = self._generate_efficiency_summary({
            "efficiency_score": efficiency_score,
            "factors": factors,
            "soreness_level": soreness_level,
            "hours_awake": hours_awake,
            "mode": mode,
            "focus_units": focus_units,
            "commit_count": commit_count,
            "frustration": frustration,
        })

        crash_hour = energy_curve.get("estimated_crash_hour", 23)
        return {
            "efficiency_score": round(efficiency_score, 2),
            "factors": factors,
            "soreness_level": soreness_level,
            "ai_summary": ai_summary,
            "overall_score": round(efficiency_score, 2),
            "best_window": {"start": "09:00", "end": f"{min(crash_hour, 12)}:00"},
            "bullets": [f"Efficiency: {efficiency_score:.0%} — {ai_summary}"],
        }

    def _build_sweet_spot(self, timeline: list) -> dict | None:
        """Build sweet spot analysis using analyzers + LLM summary."""
        hour_stats = compute_sweet_spot_stats(timeline)
        if hour_stats is None:
            return None
        ai_summary = self._generate_sweet_spot_summary(hour_stats)
        return {"hourStats": hour_stats, "aiSummary": ai_summary}

    # ── Post Results (legitimate writes to dashboard) ────

    def _post_results(self, mode: str, insight: str, focus_units: float,
                      energy_curve: dict, daily_report: dict | None = None,
                      sweet_spot: dict | None = None):
        """Post analysis results to the dashboard."""
        payload = {
            "mode": mode,
            "nudges": [insight],
            "focus_units_remaining": focus_units,
            "flow_prediction": energy_curve,
            "daily_report": daily_report,
            "sweet_spot_analysis": sweet_spot,
            "analysis_data": {
                "timestamp": datetime.now().isoformat(),
                "confidence": energy_curve.get("confidence", 0),
            },
        }
        try:
            r = requests.post(
                f"{self.api_url}/api/ai/analyze",
                headers=self._headers(),
                json=payload,
                timeout=10,
            )
            r.raise_for_status()
            logger.info("✅ Analysis posted — mode: %s, focus: %.1f/8", mode, focus_units)
        except Exception as e:
            logger.error("Failed to post analysis: %s", e)

        # Save to local store for memory
        if self.store:
            self.store.add_coach_insight([insight], mode)

    def _post_snapshot(self, data: dict, mode: str, focus_units: float):
        """Save a metric snapshot for persistent memory."""
        status = data.get("status", {})
        bio = status.get("biometrics", {})
        sys_stats = status.get("systemStats", {})
        prod = data.get("productivity", {})
        timeline = prod.get("timeline", [])
        gh = data.get("github", {})
        entries = gh.get("entries", [])

        snapshot = {
            "hrv_ms": bio.get("hrv_ms"),
            "resting_hr": bio.get("resting_hr"),
            "sleep_hours": bio.get("sleep_hours"),
            "steps": bio.get("steps"),
            "active_window": timeline[0].get("activeWindow") if timeline else None,
            "ide_time_minutes": timeline[0].get("ideTimeMinutes") if timeline else None,
            "cpu_usage": sys_stats.get("cpu_usage"),
            "memory_usage": sys_stats.get("memory_usage"),
            "commit_count": len(entries[0].get("commitMessages") or []) if entries else 0,
            "frustration_score": entries[0].get("frustrationScore") if entries else None,
            "mode": mode,
            "focus_units_remaining": focus_units,
        }
        try:
            r = requests.post(
                f"{self.api_url}/api/coach/history",
                headers=self._headers(),
                json=snapshot,
                timeout=10,
            )
            if r.ok:
                logger.debug("📸 Snapshot saved")
        except Exception as e:
            logger.error("Failed to save snapshot: %s", e)

    # ── Main Analysis ──────────────────────────────────

    def analyze(self) -> dict | None:
        """Run a single analysis cycle — deterministic mode/focus, AI-powered insight."""
        logger.info("🧠 Running analysis cycle...")
        data = self._get_data()
        if not data or not data.get("status"):
            logger.warning("No data available")
            return None

        status = data.get("status", {})
        bio = status.get("biometrics") or {}
        settings = data.get("settings", {})
        prod = data.get("productivity", {})
        timeline = prod.get("timeline", [])
        gh = data.get("github", {})

        # ── Compute all scores (via analyzers) ──
        hours_awake = compute_hours_awake(settings)
        bio_score = compute_bio_score(bio)
        focus_score = compute_focus_score(timeline)
        distraction_score = compute_distraction_score(timeline)
        stress_score = compute_stress_score(gh)
        activity_boost, activity_drain = compute_activity_modifier(bio)

        # ── Deterministic mode ──
        mode, confidence = detect_mode(
            hours_awake, bio_score, focus_score, distraction_score, stress_score
        )

        # ── Deterministic focus battery ──
        focus_units_val = compute_focus_units(
            bio_score, hours_awake, activity_boost, activity_drain
        )

        # ── Deterministic energy curve ──
        wakeup = settings.get("wakeup_time", "07:00")
        try:
            wakeup_hour = int(wakeup.split(":")[0])
        except (ValueError, AttributeError):
            wakeup_hour = 7
        energy_curve = generate_energy_curve(bio_score, hours_awake, wakeup_hour)

        logger.info(
            "📊 Awake: %.1fh | Bio: %.0f%% | Focus: %.0f%% | "
            "Distraction: %.0f%% | Stress: %.0f%% | Mode: %s | Battery: %.1f/8",
            hours_awake, bio_score * 100, focus_score * 100,
            distraction_score * 100, stress_score * 100, mode, focus_units_val,
        )

        # ── Context for insight ──
        activities = bio.get("activities") or []
        total_load = sum(a.get("icu_training_load", 0) or 0 for a in activities)
        steps = bio.get("steps") or 0
        app_durations = timeline[0].get("appDurations") or {} if timeline else {}
        browser_tab = timeline[0].get("browserTab") or "none" if timeline else "none"
        tasks_data = data.get("tasks", {})
        user_tasks = tasks_data.get("tasks", [])

        previous_insights = self._get_insight_history()

        state = {
            "mode": mode,
            "hours_awake": hours_awake,
            "focus_units": focus_units_val,
            "bio_score": bio_score,
            "sleep_hours": bio.get("sleep_hours", "N/A"),
            "hrv_ms": bio.get("hrv_ms", "N/A"),
            "active_window": timeline[0].get("activeWindow", "unknown") if timeline else "idle",
            "browser_tab": browser_tab,
            "app_durations": app_durations,
            "focus_score": focus_score,
            "distraction_score": distraction_score,
            "stress_score": stress_score,
            "training_load": total_load,
            "steps": steps,
            "crash_hour": energy_curve["estimated_crash_hour"],
            "user_tasks": user_tasks,
        }
        insight = self._generate_insight(state, previous_insights)

        efficiency_report = self._build_efficiency_report(
            data, mode, focus_units_val, hours_awake, energy_curve
        )
        sweet_spot = self._build_sweet_spot(timeline)

        # ── Post results (legitimate writes) ──
        self._post_results(mode, insight, focus_units_val, energy_curve,
                           efficiency_report, sweet_spot)
        self._post_snapshot(data, mode, focus_units_val)

        return {"mode": mode, "focus_units": focus_units_val, "insight": insight}

    def run_loop(self):
        """Continuous analysis loop."""
        logger.info("🚀 AI Coach v5 started (interval: %ds)", self.analysis_interval)
        while True:
            try:
                self.analyze()
            except Exception as e:
                logger.error("Analysis cycle error: %s", e)
            time.sleep(self.analysis_interval)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    coach = AICoach()
    coach.run_loop()
