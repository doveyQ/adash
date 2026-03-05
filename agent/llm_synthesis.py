"""
LLM Synthesis — Daily insight generation via Ollama.

Pulls today's biometrics + activity data and asks a local LLM
to generate a short, actionable narrative ("The Daily Brief").
"""

import os
import json
import logging
import requests
from datetime import date

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3")

SYSTEM_PROMPT = """\
You are a personal performance analyst. You help knowledge workers understand
the connection between their physical health and their laptop-based productivity.

You will receive two data blocks:
- BIOMETRICS: sleep, HRV, resting HR, steps, and training activities from a wearable.
- ACTIVITY: how many minutes were spent in deep work, communication, browsing, and idle.

Write exactly 3 short paragraphs:
1. **Yesterday** — Summarise what happened (both body and laptop).
2. **Today** — Based on recovery metrics, advise on cognitive readiness.
3. **Insight** — One actionable correlation you spotted.

Be concise, warm, and direct. Use plain language. Never invent data that was not given.
If any data is null or missing, say so honestly."""


def build_prompt(biometrics: dict, activity: dict) -> str:
    """Build the user prompt from raw data."""
    return f"""\
BIOMETRICS:
- Sleep: {biometrics.get('sleep_hours', 'N/A')} hours
- HRV: {biometrics.get('hrv_ms', 'N/A')} ms
- Resting HR: {biometrics.get('resting_hr', 'N/A')} bpm
- Steps: {biometrics.get('steps', 'N/A')}
- Activities: {json.dumps(biometrics.get('activities') or [], indent=2)}

ACTIVITY:
- Deep Work: {activity.get('focus_minutes', 'N/A')} min
- Communication: {activity.get('communication_minutes', 'N/A')} min
- Browsing: {activity.get('browsing_minutes', 'N/A')} min
- Idle: {activity.get('idle_minutes', 'N/A')} min
- Top App: {activity.get('top_app', 'N/A')}
- Sessions (context switches): {activity.get('session_count', 'N/A')}"""


def generate_insight(biometrics: dict, activity: dict) -> dict | None:
    """
    Call Ollama to generate the daily insight.

    Returns a dict with 'narrative', 'correlations', and 'recommendations'
    or None on failure.
    """
    prompt = build_prompt(biometrics, activity)

    try:
        resp = requests.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": OLLAMA_MODEL,
                "system": SYSTEM_PROMPT,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.4,
                    "num_predict": 512,
                },
            },
            timeout=120,
        )
        resp.raise_for_status()
        data = resp.json()
        narrative = data.get("response", "").strip()

        if not narrative:
            logger.warning("Ollama returned empty response")
            return None

        return {
            "narrative": narrative,
            "correlations": None,
            "recommendations": None,
        }

    except requests.exceptions.ConnectionError:
        logger.error("Cannot reach Ollama at %s — is it running?", OLLAMA_URL)
    except Exception as e:
        logger.error("LLM synthesis error: %s", e)
    return None


def post_insight_to_dashboard(insight: dict, api_url: str, api_key: str, day: str | None = None) -> bool:
    """Save the generated insight to the dashboard API."""
    payload = {
        "narrative": insight["narrative"],
        "correlations": insight.get("correlations"),
        "recommendations": insight.get("recommendations"),
        "date": day or date.today().isoformat(),
    }
    try:
        resp = requests.post(
            f"{api_url}/api/insights",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=10,
        )
        resp.raise_for_status()
        logger.info("✅ Insight posted for %s", payload["date"])
        return True
    except Exception as e:
        logger.error("Failed to post insight: %s", e)
        return False
