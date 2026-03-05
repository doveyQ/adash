"""
Local State Store — lightweight SQLite-backed state for the FlowState Agent.

The agent writes collected data here AND pushes to the dashboard (dual-write).
The AI Coach and Daily Report read from here instead of making HTTP round-trips
back to the dashboard — eliminating the self-referential loop.

Uses stdlib sqlite3 — zero extra dependencies.
"""

import os
import json
import sqlite3
import logging
import threading
from datetime import datetime

logger = logging.getLogger(__name__)

_DB_PATH = os.path.join(os.path.dirname(__file__), "agent_state.db")


class LocalStore:
    """Thread-safe SQLite key-value store for agent state."""

    def __init__(self, db_path: str = _DB_PATH):
        self._db_path = db_path
        self._local = threading.local()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        """Get a thread-local connection."""
        if not hasattr(self._local, "conn") or self._local.conn is None:
            self._local.conn = sqlite3.connect(self._db_path)
            self._local.conn.execute("PRAGMA journal_mode=WAL")
            self._local.conn.execute("PRAGMA synchronous=NORMAL")
        return self._local.conn

    def _init_db(self):
        """Create tables if they don't exist."""
        conn = self._get_conn()
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS state (
                key         TEXT PRIMARY KEY,
                value       TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS coach_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                nudges      TEXT,
                mode        TEXT,
                created_at  TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS outbox (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                payload     TEXT NOT NULL,
                category    TEXT NOT NULL,
                status      TEXT NOT NULL DEFAULT 'pending'
            );
        """)
        conn.commit()
        logger.debug("Local store initialized at %s", self._db_path)

    # ── Write ──────────────────────────────────────────

    def set(self, key: str, value: dict | list | str | None):
        """Store a key-value pair (upsert). Value is JSON-serialized."""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        serialized = json.dumps(value) if value is not None else "null"
        conn.execute(
            """INSERT INTO state (key, value, updated_at)
               VALUES (?, ?, ?)
               ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at""",
            (key, serialized, now),
        )
        conn.commit()

    def add_coach_insight(self, nudges: list | str | None, mode: str | None):
        """Append a coach insight to history (keeps last 20)."""
        conn = self._get_conn()
        now = datetime.now().isoformat()
        nudges_json = json.dumps(nudges) if nudges is not None else None
        conn.execute(
            "INSERT INTO coach_history (nudges, mode, created_at) VALUES (?, ?, ?)",
            (nudges_json, mode, now),
        )
        # Prune old entries
        conn.execute(
            """DELETE FROM coach_history WHERE id NOT IN (
                SELECT id FROM coach_history ORDER BY id DESC LIMIT 20
            )"""
        )
        conn.commit()

    # ── Read ───────────────────────────────────────────

    def get(self, key: str) -> dict | list | str | None:
        """Retrieve a value by key. Returns parsed JSON or None."""
        conn = self._get_conn()
        row = conn.execute(
            "SELECT value FROM state WHERE key = ?", (key,)
        ).fetchone()
        if row is None:
            return None
        try:
            return json.loads(row[0])
        except (json.JSONDecodeError, TypeError):
            return row[0]

    def get_all_state(self) -> dict:
        """
        Retrieve all state as a dict matching the shape ai_coach expects.

        Returns: {
            "status": {...},
            "productivity": {...},
            "github": {...},
            "coach_history": {...},
            "settings": {...},
            "tasks": {...},
        }
        """
        return {
            "status": self.get("status") or {},
            "productivity": self.get("productivity") or {},
            "github": self.get("github") or {},
            "coach_history": self.get("coach_history") or {},
            "settings": self.get("settings") or {},
            "tasks": self.get("tasks") or {},
        }

    def get_coach_history(self, limit: int = 5) -> list[str]:
        """Get recent coach insights as a list of text strings."""
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT nudges FROM coach_history ORDER BY id DESC LIMIT ?",
            (limit,),
        ).fetchall()
        results = []
        for (nudges_json,) in rows:
            if nudges_json:
                try:
                    nudges = json.loads(nudges_json)
                    if isinstance(nudges, list) and nudges:
                        results.append(str(nudges[0]))
                    elif isinstance(nudges, str):
                        results.append(nudges)
                except (json.JSONDecodeError, TypeError):
                    pass
        return results

    # ── Convenience writers for each data domain ──────

    def set_system(self, data: dict):
        """Store latest system stats."""
        self.set("status", {
            "systemStats": {
                "cpu_usage": data.get("cpu_usage"),
                "memory_usage": data.get("memory_usage"),
                "disk_usage": data.get("disk_usage"),
                "network_usage": data.get("network_usage"),
                "battery_info": data.get("battery_info"),
                "ports_services": data.get("ports_services"),
            },
            "lastUpdate": datetime.now().isoformat(),
        })

    def set_biometrics(self, data: dict):
        """Store latest biometrics. Merges into existing status."""
        current = self.get("status") or {}
        current["biometrics"] = {
            "sleep_hours": data.get("sleep_hours"),
            "hrv_ms": data.get("hrv_ms"),
            "resting_hr": data.get("resting_hr"),
            "sleep_hr": data.get("sleep_hr"),
            "steps": data.get("steps"),
            "activities": data.get("activities"),
        }
        self.set("status", current)

    def set_productivity(self, timeline_entry: dict, app_durations: dict | None = None):
        """Append a productivity timeline entry to the local store."""
        current = self.get("productivity") or {"timeline": []}
        timeline = current.get("timeline", [])
        timeline.insert(0, {
            **timeline_entry,
            "recordedAt": datetime.now().isoformat(),
        })
        # Keep last 200 entries
        current["timeline"] = timeline[:200]
        if app_durations is not None:
            current["appDurations"] = app_durations
        self.set("productivity", current)

    def set_github(self, data: dict):
        """Store latest GitHub data."""
        self.set("github", data)

    def set_settings(self, settings: dict):
        """Store user settings."""
        self.set("settings", settings)

    def set_tasks(self, tasks: dict):
        """Store user tasks."""
        self.set("tasks", tasks)
