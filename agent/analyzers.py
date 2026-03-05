"""
Deterministic Analyzers — scoring, mode detection, and energy modeling.

Extracted from ai_coach.py to reduce the God Object.
These are pure functions (no HTTP, no LLM, no side effects).
"""

import math
from constants import PRODUCTIVE_KEYWORDS, RESEARCH_KEYWORDS


def clamp(v: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, v))


def circadian_factor(hour: float) -> float:
    """Circadian rhythm model: morning ramp, post-lunch dip, evening decline."""
    if hour < 6:
        return 0.3
    if hour < 9:
        return 0.5 + (hour - 6) * 0.167
    if hour < 12:
        return 1.0
    if hour < 14:
        return 0.85 - (hour - 12) * 0.075
    if hour < 17:
        return 0.8
    if hour < 21:
        return 0.8 - (hour - 17) * 0.1
    return 0.4


# ── Score Computations ─────────────────────────────

def compute_bio_score(bio: dict) -> float:
    """Score from 0-1 based on sleep quality and HRV."""
    sleep = bio.get("sleep_hours") or 7
    hrv = bio.get("hrv_ms") or 50
    sleep_norm = clamp((sleep - 4) / 4)
    hrv_norm = clamp((hrv - 20) / 60)
    return sleep_norm * 0.6 + hrv_norm * 0.4


def compute_focus_score(timeline: list) -> float:
    """Score productive usage from recent logs (0-1). Includes IDEs and research/docs."""
    if not timeline:
        return 0.0
    recent = timeline[:30]
    count = 0
    for e in recent:
        window = e.get("activeWindow", "")
        tab = (e.get("browserTab") or "").lower()
        if any(window.startswith(kw) for kw in PRODUCTIVE_KEYWORDS):
            count += 1
            continue
        if any(kw in tab for kw in RESEARCH_KEYWORDS):
            count += 1
    return clamp(count / max(len(recent), 1))


def compute_distraction_score(timeline: list) -> float:
    """Score window switching rate (0-1). Only counts switches to non-productive targets."""
    if len(timeline) < 2:
        return 0.0
    recent = timeline[:60]

    def is_productive(entry: dict) -> bool:
        window = entry.get("activeWindow", "")
        tab = (entry.get("browserTab") or "").lower()
        if any(window.startswith(kw) for kw in PRODUCTIVE_KEYWORDS):
            return True
        if any(kw in tab for kw in RESEARCH_KEYWORDS):
            return True
        return False

    switches = 0
    for i in range(1, len(recent)):
        if recent[i].get("activeWindow") != recent[i - 1].get("activeWindow"):
            if not is_productive(recent[i]):
                switches += 1
    return clamp(switches / 12)


def compute_stress_score(github: dict) -> float:
    """Score from commit frustration (0-1)."""
    entries = github.get("entries", [])
    if not entries:
        return 0.0
    return clamp(entries[0].get("frustrationScore", 0))


def compute_activity_modifier(bio: dict) -> tuple[float, float]:
    """Calculate exercise boost/drain from biometrics. Returns (boost, drain)."""
    activities = bio.get("activities") or []
    total_load = sum(a.get("icu_training_load", 0) or 0 for a in activities)
    boost = clamp(min(total_load, 30) * 0.015, 0, 0.5)
    drain = clamp(max(total_load - 50, 0) * 0.01, 0, 1.0)
    return boost, drain


# ── Mode Detection ─────────────────────────────────

def detect_mode(
    hours_awake: float,
    bio_score: float,
    focus_score: float,
    distraction_score: float,
    stress_score: float,
) -> tuple[str, float]:
    """Deterministic mode detection. Returns (mode, confidence)."""
    fatigue = clamp(hours_awake / 16)
    if fatigue > 0.8 or bio_score < 0.25:
        return "critical_fatigue", clamp(0.6 + fatigue * 0.3)
    if focus_score > 0.5 and distraction_score < 0.35 and bio_score > 0.4:
        return "flow_state", clamp(0.5 + focus_score * 0.4)
    if stress_score > 0.4 and focus_score > 0.3:
        return "high_stress_grind", clamp(0.5 + stress_score * 0.3)
    return "distracted_procrastination", clamp(0.4 + distraction_score * 0.4)


# ── Focus Battery ──────────────────────────────────

def compute_focus_units(
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


# ── Energy Curve ───────────────────────────────────

def generate_energy_curve(
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
        decay = math.exp(-0.08 * h_offset)
        circ = circadian_factor(hour)
        energy = max(0, min(100, base_energy * decay * circ))
        points.append({"hour": int(hour), "energy": round(energy, 1)})
        if crash_hour is None and energy < 20:
            crash_hour = int(hour)
    return {
        "estimated_crash_hour": crash_hour or 23,
        "energy_curve": points,
        "confidence": round(bio_score, 2),
    }


# ── Hours Awake ────────────────────────────────────

def compute_hours_awake(settings: dict) -> float:
    """Calculate hours since wake-up from settings."""
    from datetime import datetime
    wakeup = settings.get("wakeup_time", "07:00")
    try:
        h, m = map(int, wakeup.split(":"))
    except (ValueError, AttributeError):
        h, m = 7, 0
    now = datetime.now()
    diff = (now.hour * 60 + now.minute) - (h * 60 + m)
    return max(0, diff / 60)


# ── Sweet Spot Analysis ────────────────────────────

def compute_sweet_spot_stats(timeline: list) -> list[dict] | None:
    """Group productivity by hour, return stats. Returns None if insufficient data."""
    if not timeline or len(timeline) < 5:
        return None

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

    hour_stats = []
    for hour in sorted(hour_buckets.keys()):
        entries = hour_buckets[hour]
        total = len(entries)
        productive = sum(
            1 for e in entries
            if any(e["window"].startswith(kw) for kw in PRODUCTIVE_KEYWORDS)
        )
        apps = [e["window"] for e in entries if e["window"]]
        top_app = max(set(apps), key=apps.count) if apps else "unknown"
        hour_stats.append({
            "hour": hour,
            "productiveRatio": round(productive / max(total, 1), 2),
            "totalEntries": total,
            "topApp": top_app[:40],
        })
    return hour_stats


# ── Efficiency Factors ─────────────────────────────

def compute_efficiency_factors(bio: dict, timeline: list, github: dict) -> list[dict]:
    """Compute efficiency factors from raw data."""
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

    # Focus factor
    productive_entries = [
        e for e in timeline
        if any(e.get("activeWindow", "").startswith(kw) for kw in PRODUCTIVE_KEYWORDS)
    ]
    prod_mins = len(productive_entries)
    focus_score = clamp(prod_mins / 120)
    factors.append({
        "name": "Productive Focus",
        "score": round(focus_score, 2),
        "detail": f"{prod_mins} min deep work across {len(timeline)} tracked entries",
    })

    return factors
