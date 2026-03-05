"""
Daily Report — LLM-generated daily performance summary.

Runs once per day (or on-demand) to produce a summary of the user's
productivity patterns, identifying best windows and actionable suggestions.
"""

import os
import json
import re
import logging
import requests
from datetime import datetime

logger = logging.getLogger(__name__)

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")

REPORT_PROMPT = """Based on today's data, write a concise daily summary with EXACTLY 3 bullet points.

Rules:
- Bullet 1: Best productivity window (when + what they were doing)
- Bullet 2: Total deep work time and main activities
- Bullet 3: Actionable suggestion for tomorrow

Respond with ONLY this JSON:
{
  "bullets": ["string", "string", "string"],
  "best_window": {"start": "HH:MM", "end": "HH:MM"},
  "overall_score": 0.0-1.0
}

Today's data:
"""


class DailyReport:
    def __init__(self, store=None):
        self.api_url = os.getenv("API_URL", "http://localhost:3000")
        self.api_key = os.getenv("API_KEY", "")
        self.store = store  # LocalStore instance

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _fetch_day_data(self) -> dict:
        """Get day data from local store or HTTP fallback."""
        if self.store:
            return self.store.get_all_state()

        # Legacy HTTP fallback
        data = {}
        try:
            for endpoint in ["status", "productivity", "github"]:
                r = requests.get(
                    f"{self.api_url}/api/{endpoint}",
                    timeout=10,
                )
                if r.ok:
                    data[endpoint] = r.json()
        except Exception as e:
            logger.error("Failed to fetch day data: %s", e)
        return data

    def _build_prompt(self, data: dict) -> str:
        parts = [f"Date: {datetime.now().strftime('%Y-%m-%d')}"]

        status = data.get("status", {})
        bio = status.get("biometrics", {})
        if bio:
            parts.append(f"Sleep: {bio.get('sleep_hours', '?')}h, HRV: {bio.get('hrv_ms', '?')}ms, "
                         f"Resting HR: {bio.get('resting_hr', '?')}bpm")

        prod = data.get("productivity", {})
        timeline = prod.get("timeline", [])
        if timeline:
            parts.append(f"\nProductivity timeline ({len(timeline)} entries):")
            for entry in timeline[:20]:
                parts.append(
                    f"  [{entry.get('recordedAt', '?')[11:16]}] "
                    f"{entry.get('activeWindow', '?')} "
                    f"(IDE: {entry.get('ideTimeMinutes', 0)}min)"
                )

        gh = data.get("github", {})
        entries = gh.get("entries", [])
        if entries:
            parts.append(f"\nGitHub ({len(entries)} entries):")
            for entry in entries[:5]:
                commits = entry.get("commitMessages", [])
                if isinstance(commits, list):
                    for c in commits[:5]:
                        msg = c.get("message", str(c)) if isinstance(c, dict) else str(c)
                        parts.append(f"  - {msg[:80]}")
                score = entry.get("frustrationScore")
                if score is not None:
                    parts.append(f"  Frustration: {score:.2f}")

        return "\n".join(parts)

    def generate(self) -> dict | None:
        """Generate today's daily report."""
        logger.info("📝 Generating daily report...")
        data = self._fetch_day_data()
        prompt = REPORT_PROMPT + self._build_prompt(data)

        try:
            r = requests.post(
                f"{OLLAMA_URL}/api/generate",
                json={
                    "model": OLLAMA_MODEL,
                    "prompt": prompt + "\n\nRespond ONLY with the JSON object.",
                    "stream": False,
                },
                timeout=180,
            )
            r.raise_for_status()
            text = r.json().get("response", "")

            # Extract JSON from response
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', text)
            if json_match:
                result = json.loads(json_match.group())
            else:
                result = json.loads(text)

            logger.info("✅ Daily report generated")
            return result
        except Exception as e:
            logger.error("Daily report generation error: %s", e)
            return None


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    report = DailyReport()
    result = report.generate()
    if result:
        print(json.dumps(result, indent=2))
