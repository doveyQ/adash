"""
Activity Tracker — Detects active window, browser tab, IDE usage,
and tracks cumulative time per application.

Uses platform-specific APIs to track what the user is currently doing.
Linux: xdotool / xprop
"""

import os
import re
import time
import logging
import subprocess
import requests
from collections import defaultdict
from constants import IDE_PATTERNS, BROWSER_PATTERNS

logger = logging.getLogger(__name__)

IDE_REGEX = re.compile("|".join(IDE_PATTERNS), re.IGNORECASE)
BROWSER_REGEX = re.compile("|".join(BROWSER_PATTERNS), re.IGNORECASE)


def _extract_app_name(title: str) -> str:
    """Extract a clean app name from window title."""
    if IDE_REGEX.search(title):
        match = IDE_REGEX.search(title)
        return match.group(0) if match else "IDE"
    if BROWSER_REGEX.search(title):
        match = BROWSER_REGEX.search(title)
        return match.group(0) if match else "Browser"
    # Try to get the app name from "Title - AppName" pattern
    parts = title.rsplit(" - ", 1)
    if len(parts) > 1 and len(parts[1]) < 30:
        return parts[1].strip()
    # Fall back to first 30 chars
    return title[:30].strip()


def get_active_window_title() -> str | None:
    """Get the active window title on Linux using xdotool."""
    try:
        wid = subprocess.check_output(
            ["xdotool", "getactivewindow"], stderr=subprocess.DEVNULL
        ).strip()
        title = subprocess.check_output(
            ["xdotool", "getactivewindow", "getwindowname"], stderr=subprocess.DEVNULL
        ).decode().strip()
        return title
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Fallback: try xprop
        try:
            output = subprocess.check_output(
                ["xprop", "-root", "_NET_ACTIVE_WINDOW"], stderr=subprocess.DEVNULL
            ).decode()
            wid = output.strip().split()[-1]
            name_output = subprocess.check_output(
                ["xprop", "-id", wid, "WM_NAME"], stderr=subprocess.DEVNULL
            ).decode()
            match = re.search(r'"(.+)"', name_output)
            return match.group(1) if match else None
        except Exception:
            pass
    return None


class ActivityTracker:
    def __init__(self, store=None):
        self.api_url = os.getenv("API_URL", "http://localhost:3000")
        self.api_key = os.getenv("API_KEY", "")
        self.track_interval = int(os.getenv("ACTIVITY_TRACK_INTERVAL", "60"))
        self.store = store
        self.ide_session_start = None
        self.last_window = None
        # Cumulative app time tracking (resets daily)
        self._app_durations: dict[str, int] = defaultdict(int)  # app -> seconds
        self._last_app: str | None = None
        self._last_app_time: float = 0
        self._tracking_date: str = ""

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def _update_app_time(self, app_name: str):
        """Update cumulative time for the previous app."""
        now = time.time()
        today = time.strftime("%Y-%m-%d")

        # Reset on new day
        if today != self._tracking_date:
            self._app_durations.clear()
            self._tracking_date = today

        # Add elapsed time to previous app
        if self._last_app and self._last_app_time > 0:
            elapsed = int(now - self._last_app_time)
            if 0 < elapsed < 300:  # cap at 5 min per interval to avoid idle inflation
                self._app_durations[self._last_app] += elapsed

        self._last_app = app_name
        self._last_app_time = now

    def get_app_durations(self) -> dict[str, int]:
        """Get cumulative app durations in minutes."""
        return {
            app: max(1, secs // 60)
            for app, secs in sorted(
                self._app_durations.items(),
                key=lambda x: x[1],
                reverse=True,
            )
            if secs >= 60  # Only show apps used for 1+ min
        }

    def _classify_window(self, title: str) -> dict:
        """Classify the window into categories."""
        result = {
            "active_window": title,
            "browser_tab": None,
            "ide_time_minutes": 0,
            "calendar_event": None,
            "app_durations": None,
        }

        if IDE_REGEX.search(title):
            result["active_window"] = f"IDE: {title}"
            now = time.time()
            if self.ide_session_start is None:
                self.ide_session_start = now
            ide_minutes = int((now - self.ide_session_start) / 60)
            result["ide_time_minutes"] = max(1, ide_minutes)
        else:
            self.ide_session_start = None

        if BROWSER_REGEX.search(title):
            parts = title.rsplit(" - ", 1)
            if len(parts) > 1:
                result["browser_tab"] = parts[0].strip()
            else:
                result["browser_tab"] = title

        if any(kw in title.lower() for kw in ["calendar", "outlook", "google calendar"]):
            result["calendar_event"] = title

        # Track app time
        app_name = _extract_app_name(title)
        self._update_app_time(app_name)

        # Include cumulative durations
        durations = self.get_app_durations()
        if durations:
            result["app_durations"] = durations

        return result

    def collect_and_send(self):
        """Collect current activity and send to dashboard."""
        title = get_active_window_title()
        if not title:
            return

        data = self._classify_window(title)
        payload = {"productivity": data}

        # Write to local store
        if self.store:
            self.store.set_productivity(data, data.get("app_durations"))

        try:
            r = requests.post(
                f"{self.api_url}/api/ingest",
                headers=self._headers(),
                json=payload,
                timeout=10,
            )
            if r.ok:
                logger.debug("📊 Activity tracked: %s", data["active_window"][:60])
            else:
                logger.warning("Activity track failed: %s", r.status_code)
        except requests.exceptions.ConnectionError:
            logger.debug("Dashboard offline, skipping activity track")
        except Exception as e:
            logger.error("Activity tracking error: %s", e)

    def run_loop(self):
        """Continuous tracking loop."""
        logger.info("👁 Activity Tracker started (interval: %ds)", self.track_interval)
        while True:
            try:
                self.collect_and_send()
            except Exception as e:
                logger.error("Tracking error: %s", e)
            time.sleep(self.track_interval)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    tracker = ActivityTracker()
    tracker.run_loop()
