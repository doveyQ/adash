"""
FlowState AI Coach v4 — Single Insight with Memory + Aggressive AI Reasoning.

The AI coach now:
- Produces a SINGLE high-impact insight per cycle (not 3 nudges)
- Remembers its last 5 insights to avoid repetition and build context
- Fetches user tasks to provide goal-oriented coaching
- Generates AI-powered efficiency scores and sweet spot analysis
- Uses LLM reasoning for all contextual output
"""

import os
import math
import logging
import time
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

MODES = [
    "flow_state",
    "high_stress_grind",
    "distracted_procrastination",
    "critical_fatigue",
]


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def circadian_factor(hour: float) -> float:
    """Circadian rhythm model: morning ramp, post-lunch dip, evening decline."""
    if hour < 6:
        return 0.3
    if hour < 9:
        return 0.5 + (hour - 6) * 0.167  # ramp to 1.0
    if hour < 12:
        return 1.0
    if hour < 14:
        return 0.85 - (hour - 12) * 0.075  # post-lunch dip
    if hour < 17:
        return 0.8
    if hour < 21:
        return 0.8 - (hour - 17) * 0.1  # evening decline
    return 0.4


class AICoach:
    def __init__(self):
        self.api_url = os.getenv("API_URL", "http://localhost:3000")
        self.api_key = os.getenv("API_KEY", "")
        self.analysis_interval = int(os.getenv("AI_ANALYSIS_INTERVAL", "300"))

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _fetch_all_data(self) -> dict:
        """Pull current state from all dashboard APIs."""
        data = {}
        endpoints = [
            "status", "productivity", "github",
            "coach/history", "settings", "tasks",
        ]
        for ep in endpoints:
            try:
                r = requests.get(f"{self.api_url}/api/{ep}", timeout=10)
                if r.ok:
                    data[ep.replace("/", "_")] = r.json()
            except Exception as e:
                logger.debug("Failed to fetch %s: %s", ep, e)
        return data

    def _fetch_insight_history(self) -> list[str]:
        """Fetch last 5 insights for memory context."""
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

    # ── Deterministic Calculations ──────────────────────

    def _compute_hours_awake(self, settings: dict) -> float:
        """Calculate hours since wake-up from settings."""
        wakeup = settings.get("wakeup_time", "07:00")
        try:
            h, m = map(int, wakeup.split(":"))
        except (ValueError, AttributeError):
            h, m = 7, 0
        now = datetime.now()
        wake_minutes = h * 60 + m
        now_minutes = now.hour * 60 + now.minute
        diff = now_minutes - wake_minutes
        return max(0, diff / 60)

    def _compute_bio_score(self, bio: dict) -> float:
        """Score from 0-1 based on sleep quality and HRV."""
        sleep = bio.get("sleep_hours") or 7
        hrv = bio.get("hrv_ms") or 40
        # Sleep: 8h = 1.0, 6h = 0.5, 4h = 0.0
        sleep_norm = clamp((sleep - 4) / 4)
        # HRV: 60+ = 1.0, 30 = 0.5, <15 = 0.0
        hrv_norm = clamp((hrv - 15) / 45)
        return (sleep_norm * 0.6 + hrv_norm * 0.4)

    def _compute_focus_score(self, timeline: list) -> float:
        """Score productive usage from recent logs (0-1). includes IDEs and research/docs."""
        if not timeline:
            return 0.0
        recent = timeline[:30]
        productive_keywords = (
            "IDE:", "Terminal:", "Code", "vim", "nvim", "emacs",
            "Figma", "Blender", "Godot", "Unity",
        )
        research_keywords = (
            "roadmap.sh", "github.com", "stackoverflow.com", "docs.",
            "mdn", "typescriptlang.org", "react.dev", "nextjs.org",
            "chatgpt.com", "claude.ai", "gemini.google.com",
            "localhost:", "127.0.0.1:", "adash", "google search"
        )
        
        count = 0
        for e in recent:
            window = e.get("activeWindow", "")
            tab = (e.get("browserTab") or "").lower()
            
            # Count if it's a known productive app
            if any(window.startswith(kw) for kw in productive_keywords):
                count += 1
                continue
            
            # Count if it's a browser tab matching research/docs/dev
            if any(kw in tab for kw in research_keywords):
                count += 1
        
        return clamp(count / max(len(recent), 1))

    def _compute_distraction_score(self, timeline: list) -> float:
        """Score window switching rate (0-1). Only counts switches to non-productive targets."""
        if len(timeline) < 2:
            return 0.0
        recent = timeline[:60]
        
        productive_keywords = ("IDE:", "Terminal:", "Code", "vim", "nvim", "emacs")
        research_keywords = ("roadmap.sh", "github.com", "stackoverflow.com", "docs.", "mdn", "localhost:", "127.0.0.1:", "adash")

        def is_productive(entry: dict) -> bool:
            window = entry.get("activeWindow", "")
            tab = (entry.get("browserTab") or "").lower()
            if any(window.startswith(kw) for kw in productive_keywords):
                return True
            if any(kw in tab for kw in research_keywords):
                return True
            return False

        switches = 0
        for i in range(1, len(recent)):
            current = recent[i]
            prev = recent[i-1]
            if current.get("activeWindow") != prev.get("activeWindow"):
                # If we switch to something NOT productive, it's a distraction
                if not is_productive(current):
                    switches += 1
        
        # 12+ non-productive switches per hour = max distraction
        return clamp(switches / 12)

    def _compute_stress_score(self, github: dict) -> float:
        """Score from commit frustration (0-1)."""
        entries = github.get("entries", [])
        if not entries:
            return 0.0
        return clamp(entries[0].get("frustrationScore", 0))

    def _compute_activity_modifier(self, bio: dict) -> tuple[float, float]:
        """Returns (boost, drain) from physical activity."""
        activities = bio.get("activities") or []
        total_load = sum(a.get("icu_training_load", 0) or 0 for a in activities)

        # Mild exercise (load < 30, <60min) → small boost
        boost = clamp(min(total_load, 30) * 0.015, 0, 0.5)
        # Heavy exercise (load > 50) → fatigue drain
        drain = clamp(max(total_load - 50, 0) * 0.01, 0, 1.0)

        return boost, drain

    def _detect_mode(
        self,
        hours_awake: float,
        bio_score: float,
        focus_score: float,
        distraction_score: float,
        stress_score: float,
    ) -> tuple[str, float]:
        """Deterministic mode detection. Returns (mode, confidence)."""
        fatigue = clamp(hours_awake / 16)

        # Critical fatigue: very tired OR terrible biometrics
        if fatigue > 0.8 or bio_score < 0.25:
            return "critical_fatigue", clamp(0.6 + fatigue * 0.3)

        # Flow state: deep IDE focus, low distraction, decent bio
        if focus_score > 0.5 and distraction_score < 0.35 and bio_score > 0.4:
            return "flow_state", clamp(0.5 + focus_score * 0.4)

        # High stress grind: working hard but frustrated
        if stress_score > 0.4 and focus_score > 0.3:
            return "high_stress_grind", clamp(0.5 + stress_score * 0.3)

        # Default: distracted
        return "distracted_procrastination", clamp(0.4 + distraction_score * 0.4)

    def _compute_focus_units(
        self,
        bio_score: float,
        hours_awake: float,
        activity_boost: float,
        activity_drain: float,
    ) -> float:
        """Deterministic focus battery (0-8 units)."""
        base = 8.0 * bio_score
        awake_drain = hours_awake * 0.5
        remaining = base - awake_drain + activity_boost - activity_drain
        return round(clamp(remaining, 0, 8), 1)

    def _generate_energy_curve(
        self,
        bio_score: float,
        hours_awake: float,
        wakeup_hour: float,
    ) -> dict:
        """Deterministic energy curve from wake to midnight."""
        points = []
        crash_hour = None
        base_energy = bio_score * 100

        for h_offset in range(0, 18):
            hour = wakeup_hour + h_offset
            if hour >= 24:
                break
            awake_h = h_offset
            # Exponential decay based on hours awake
            decay = math.exp(-0.08 * awake_h)
            circ = circadian_factor(hour)
            energy = base_energy * decay * circ

            energy = max(0, min(100, energy))
            points.append({
                "hour": int(hour),
                "energy": round(energy, 1),
            })

            if crash_hour is None and energy < 20:
                crash_hour = int(hour)

        return {
            "estimated_crash_hour": crash_hour or 23,
            "energy_curve": points,
            "confidence": round(bio_score, 2),
        }

    # ── LLM: Single Insight with Memory ──────────────────

    def _generate_insight(self, state: dict, previous_insights: list[str]) -> str:
        """Use LLM to generate a SINGLE high-impact insight, aware of past insights."""
        # Build app durations summary
        app_summary = ", ".join(
            f"{app}: {mins}min" for app, mins in list(state.get("app_durations", {}).items())[:5]
        ) or "no app data"

        # Build tasks context
        tasks = state.get("user_tasks", [])
        task_str = ", ".join(
            f"{'✅' if t.get('completed') else '⬜'} {t.get('title', '?')}" for t in tasks[:5]
        ) if tasks else "no tasks set"

        # Build previous insights memory
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
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=120,
            )
            r.raise_for_status()
            text = r.json().get("response", "").strip()
            # Clean up: remove quotes, JSON artifacts
            text = text.strip('"\'')
            if text and len(text) < 200:
                return text
        except Exception as e:
            logger.error("Insight generation error: %s", e)

        # Fallback insight based on mode and actual state
        active = state.get('active_window', 'your current app')
        awake = state['hours_awake']
        load = state.get('training_load', 0)

        fallbacks = {
            "flow_state": f"Deep focus on {active} — protect this flow, avoid context switches",
            "critical_fatigue": f"You've been awake {awake:.0f}h — start winding down, your body needs recovery",
            "high_stress_grind": f"High commit frustration detected — take 5 min walk before continuing on {active}",
            "distracted_procrastination": "Low focus detected — pick ONE task, commit to 25 min of focused work" + (f" (consider a walk first, {load} training load)" if load < 10 else ""),
        }
        return fallbacks.get(state["mode"], fallbacks["distracted_procrastination"])

    # ── AI-Powered Efficiency Report ─────────────────────

    def _generate_efficiency_report(self, data: dict, mode: str, focus_units: float,
                                     hours_awake: float, energy_curve: dict) -> dict:
        """Build an efficiency report with AI-powered summary."""
        status = data.get("status", {})
        bio = status.get("biometrics") or {}
        prod = data.get("productivity", {})
        timeline = prod.get("timeline", [])
        gh = data.get("github", {})
        entries = gh.get("entries", [])

        # ── Compute efficiency factors ──
        factors = []

        # Sleep factor
        sleep = bio.get("sleep_hours")
        hrv = bio.get("hrv_ms")
        if sleep:
            sleep_score = clamp((sleep - 4) / 4)
            detail = f"{sleep}h sleep"
            if hrv:
                detail += f", HRV {hrv}ms"
            factors.append({"name": "Sleep & Recovery", "score": round(sleep_score, 2), "detail": detail})

        # Activity factor
        activities = bio.get("activities") or []
        steps = bio.get("steps") or 0
        total_load = sum(a.get("icu_training_load", 0) or 0 for a in activities)
        if activities or steps > 0:
            activity_score = clamp(min(steps, 8000) / 8000 * 0.6 + min(total_load, 50) / 50 * 0.4)
            sport_names = [a.get("type", "exercise") for a in activities[:3]]
            detail = f"{steps} steps"
            if sport_names:
                detail += f", {', '.join(sport_names)}"
            factors.append({"name": "Physical Activity", "score": round(activity_score, 2), "detail": detail})
        else:
            factors.append({"name": "Physical Activity", "score": 0.0, "detail": "No activity tracked"})

        # Focus / productivity factor
        productive_keywords = ("IDE:", "Terminal:", "Code", "vim", "nvim", "emacs", "Figma")
        productive_entries = [
            e for e in timeline
            if any(e.get("activeWindow", "").startswith(kw) for kw in productive_keywords)
        ]
        prod_mins = len(productive_entries)
        focus_score = clamp(prod_mins / 120)
        factors.append({
            "name": "Productive Focus",
            "score": round(focus_score, 2),
            "detail": f"{prod_mins} min deep work across {len(timeline)} tracked entries",
        })

        # Soreness / recovery (based on training load — high load = potential soreness)
        soreness_level = "none"
        if total_load > 80:
            soreness_level = "high"
        elif total_load > 40:
            soreness_level = "moderate"
        elif total_load > 15:
            soreness_level = "mild"

        # Overall efficiency score
        factor_scores = [f["score"] for f in factors]
        efficiency_score = sum(factor_scores) / max(len(factor_scores), 1)

        # Commits data
        commit_count = 0
        frustration = 0
        if entries:
            commits_data = entries[0].get("commitMessages") or []
            commit_count = len(commits_data)
            frustration = entries[0].get("frustrationScore", 0) or 0

        # AI-powered efficiency summary
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
            "best_window": {
                "start": "09:00",
                "end": f"{min(crash_hour, 12)}:00",
            },
            "bullets": [
                f"Efficiency: {efficiency_score:.0%} — {ai_summary}",
            ],
        }

    def _generate_efficiency_summary(self, state: dict) -> str:
        """Use LLM to generate a one-line efficiency interpretation."""
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
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=60,
            )
            r.raise_for_status()
            text = r.json().get("response", "").strip().strip('"\'')
            if text and len(text) < 150:
                return text
        except Exception as e:
            logger.debug("Efficiency summary LLM error: %s", e)

        # Fallback
        score = state["efficiency_score"]
        if score >= 0.7:
            return "Strong efficiency — sleep and focus are supporting high output today"
        elif score >= 0.4:
            return "Moderate efficiency — consider optimizing either recovery or focus time"
        else:
            return "Low efficiency — prioritize rest and recovery to boost tomorrow's output"

    # ── AI-Powered Sweet Spot Analysis ──────────────────

    def _generate_sweet_spot_analysis(self, timeline: list) -> dict | None:
        """Analyze productivity patterns and find best working times using AI."""
        if not timeline or len(timeline) < 5:
            return None

        # Group productive time by hour
        hour_buckets: dict[int, list[dict]] = {}
        for entry in timeline:
            ts = entry.get("recordedAt", "")
            window = entry.get("activeWindow", "")
            if not ts:
                continue
            try:
                hour = int(ts[11:13])
            except (ValueError, IndexError):
                continue
            if hour not in hour_buckets:
                hour_buckets[hour] = []
            hour_buckets[hour].append({"window": window, "ide_min": entry.get("ideTimeMinutes", 0)})

        if not hour_buckets:
            return None

        # Calculate productive ratio per hour
        productive_keywords = ("IDE:", "Terminal:", "Code", "vim", "nvim", "emacs", "Figma")
        hour_stats = []
        for hour in sorted(hour_buckets.keys()):
            entries = hour_buckets[hour]
            total = len(entries)
            productive = sum(
                1 for e in entries
                if any(e["window"].startswith(kw) for kw in productive_keywords)
            )
            ratio = productive / max(total, 1)
            # Get most common app
            apps = [e["window"] for e in entries if e["window"]]
            top_app = max(set(apps), key=apps.count) if apps else "unknown"
            hour_stats.append({
                "hour": hour,
                "productiveRatio": round(ratio, 2),
                "totalEntries": total,
                "topApp": top_app[:40],
            })

        # Use AI to interpret
        ai_summary = self._generate_sweet_spot_summary(hour_stats)

        return {
            "hourStats": hour_stats,
            "aiSummary": ai_summary,
        }

    def _generate_sweet_spot_summary(self, hour_stats: list[dict]) -> str:
        """Use LLM to generate a natural-language summary of best working times."""
        stats_str = "\n".join(
            f"  {s['hour']}:00 — {s['productiveRatio']:.0%} productive ({s['totalEntries']} entries, top app: {s['topApp']})"
            for s in hour_stats
        )

        prompt = f"""You are a productivity analyst. Based on this hourly breakdown of a person's day, identify their BEST working time window and explain why in ONE sentence (max 20 words).

Hourly productivity:
{stats_str}

Respond ONLY with the single sentence, no quotes."""

        try:
            r = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=60,
            )
            r.raise_for_status()
            text = r.json().get("response", "").strip().strip('"\'')
            if text and len(text) < 150:
                return text
        except Exception as e:
            logger.debug("Sweet spot summary LLM error: %s", e)

        # Fallback: find the peak hour
        if hour_stats:
            best = max(hour_stats, key=lambda s: s["productiveRatio"])
            return f"Peak productivity at {best['hour']}:00 ({best['productiveRatio']:.0%} focus) on {best['topApp']}"
        return "Not enough data to determine your sweet spot yet"

    # ── Post Results ───────────────────────────────────

    def _post_results(self, mode: str, insight: str, focus_units: float,
                      energy_curve: dict, daily_report: dict | None = None,
                      sweet_spot: dict | None = None):
        """Post analysis results to the dashboard."""
        payload = {
            "mode": mode,
            "nudges": [insight],  # Single insight in list for backwards compat
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
        data = self._fetch_all_data()
        if not data or not data.get("status"):
            logger.warning("No data available")
            return None

        status = data.get("status", {})
        bio = status.get("biometrics") or {}
        settings = data.get("settings", {})
        prod = data.get("productivity", {})
        timeline = prod.get("timeline", [])
        gh = data.get("github", {})

        # ── Compute all scores ──
        hours_awake = self._compute_hours_awake(settings)
        bio_score = self._compute_bio_score(bio)
        focus_score = self._compute_focus_score(timeline)
        distraction_score = self._compute_distraction_score(timeline)
        stress_score = self._compute_stress_score(gh)
        activity_boost, activity_drain = self._compute_activity_modifier(bio)

        # ── Deterministic mode ──
        mode, confidence = self._detect_mode(
            hours_awake, bio_score, focus_score, distraction_score, stress_score
        )

        # ── Deterministic focus battery ──
        focus_units = self._compute_focus_units(
            bio_score, hours_awake, activity_boost, activity_drain
        )

        # ── Deterministic energy curve ──
        wakeup = settings.get("wakeup_time", "07:00")
        try:
            wakeup_hour = int(wakeup.split(":")[0])
        except (ValueError, AttributeError):
            wakeup_hour = 7
        energy_curve = self._generate_energy_curve(bio_score, hours_awake, wakeup_hour)

        # Log computed state
        logger.info(
            "📊 Awake: %.1fh | Bio: %.0f%% | Focus: %.0f%% | "
            "Distraction: %.0f%% | Stress: %.0f%% | Mode: %s | Battery: %.1f/8",
            hours_awake, bio_score * 100, focus_score * 100,
            distraction_score * 100, stress_score * 100, mode, focus_units,
        )

        # ── Compute training load for insight context ──
        activities = bio.get("activities") or []
        total_load = sum(a.get("icu_training_load", 0) or 0 for a in activities)
        steps = bio.get("steps") or 0

        # ── Get app durations from most recent timeline entry
        app_durations = {}
        browser_tab = "none"
        if timeline:
            app_durations = timeline[0].get("appDurations") or {}
            browser_tab = timeline[0].get("browserTab") or "none"

        # ── Fetch user tasks ──
        tasks_data = data.get("tasks", {})
        user_tasks = tasks_data.get("tasks", [])

        # ── Fetch previous insights for memory ──
        previous_insights = self._fetch_insight_history()

        # ── AI: generate single insight with memory ──
        state = {
            "mode": mode,
            "hours_awake": hours_awake,
            "focus_units": focus_units,
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

        # ── Generate efficiency report (replaces daily report) ──
        efficiency_report = self._generate_efficiency_report(
            data, mode, focus_units, hours_awake, energy_curve
        )

        # ── Generate sweet spot analysis ──
        sweet_spot = self._generate_sweet_spot_analysis(timeline)

        # ── Post everything ──
        self._post_results(mode, insight, focus_units, energy_curve,
                           efficiency_report, sweet_spot)
        self._post_snapshot(data, mode, focus_units)

        return {"mode": mode, "focus_units": focus_units, "insight": insight}

    def run_loop(self):
        """Continuous analysis loop."""
        logger.info("🚀 AI Coach v4 started (interval: %ds)", self.analysis_interval)
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
