import os
import logging
from datetime import date, timedelta
from typing import Optional
import requests

logger = logging.getLogger(__name__)

BASE_URL = "https://intervals.icu"

class IntervalsClient:
    def __init__(self):
        self.api_key = os.getenv("INTERVALS_API_KEY", "")
        self.athlete_id = os.getenv("INTERVALS_ATHLETE_ID", "0")
        self.session = requests.Session()
        self.session.auth = ("API_KEY", self.api_key)
        self.session.headers.update({"Accept": "application/json"})

    def _url(self, path: str) -> str:
        return f"{BASE_URL}/api/v1/athlete/{self.athlete_id}/{path}"

    def _get(self, url: str, params: dict | None = None) -> Optional[dict | list]:
        try:
            resp = self.session.get(url, params=params, timeout=15)
            resp.raise_for_status()
            return resp.json()
        except requests.exceptions.ConnectionError:
            logger.error("Cannot reach intervals.icu")
        except requests.exceptions.HTTPError as e:
            logger.error("intervals.icu API error: %s", e)
        except Exception as e:
            logger.error("Unexpected error fetching %s: %s", url, e)
        return None

    def get_activities(
        self,
        oldest: str | None = None,
        newest: str | None = None,
        limit: int = 10,
    ) -> list[dict] | None:
        if oldest is None:
            oldest = (date.today() - timedelta(days=30)).isoformat()
        if newest is None:
            newest = date.today().isoformat()

        return self._get(
            self._url("activities"),
            params={"oldest": oldest, "newest": newest, "limit": limit},
        )

    def get_wellness(self, day: str | None = None) -> dict | None:
        if day is None:
            day = date.today().isoformat()
        return self._get(self._url(f"wellness/{day}"))

    def get_wellness_range(
        self,
        oldest: str | None = None,
        newest: str | None = None,
    ) -> list[dict] | None:
        if oldest is None:
            oldest = (date.today() - timedelta(days=7)).isoformat()
        if newest is None:
            newest = date.today().isoformat()

        return self._get(
            self._url("wellness"),
            params={"oldest": oldest, "newest": newest},
        )

    def get_profile(self) -> dict | None:
        return self._get(self._url(""))


def extract_activity_summary(activities: list[dict]) -> list[dict]:
    important_fields = [
        "id",
        "name",
        "type",
        "start_date_local",
        "moving_time",
        "distance",
        "total_elevation_gain",
        "calories",
        "average_heartrate",
        "max_heartrate",
        "average_speed",
        "max_speed",
        "average_cadence",
        "average_watts",
        "weighted_average_watts",
        "icu_training_load",
        "icu_intensity",
        "icu_ftp",
        "icu_w_prime",
        "suffer_score",
        "average_temp",
    ]
    summaries = []
    for act in activities:
        summary = {}
        for field in important_fields:
            val = act.get(field)
            if val is not None:
                summary[field] = val
        summaries.append(summary)
    return summaries


def extract_sleep_data(wellness: dict) -> dict:
    sleep_secs = wellness.get("sleepSecs")
    return {
        "sleep_hours": round(sleep_secs / 3600, 1) if sleep_secs else None,
        "sleep_hr": wellness.get("avgSleepingHR"),
    }
