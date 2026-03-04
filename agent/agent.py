import os
import time
import json
import logging
import threading
import psutil
import socket
import requests
from datetime import date, timedelta
from dotenv import load_dotenv
from intervals_client import IntervalsClient, extract_activity_summary, extract_sleep_data
from ai_coach import AICoach
from activity_tracker import ActivityTracker
from github_client import GitHubClient
from daily_report import DailyReport

load_dotenv()

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")


class AgentEnv:
    def __init__(self):
        self.api_key = os.getenv("API_KEY")
        self.api_url = os.getenv("API_URL")
        self.last_check_time = 0.00
        self.check_interval = 60
        self.intervals = IntervalsClient()

        # FlowState services
        self.ai_coach = AICoach()
        self.activity_tracker = ActivityTracker()
        self.github_client = GitHubClient()
        self.daily_report = DailyReport()

    def get_cpu_usage(self):
        return psutil.cpu_percent(interval=None)

    def get_memory_usage(self):
        return psutil.virtual_memory().percent

    def get_disk_usage(self):
        return psutil.disk_usage("/").percent

    def get_network_usage(self):
        net_io = psutil.net_io_counters()
        return net_io.bytes_sent, net_io.bytes_recv

    def get_battery_info(self):
        battery = psutil.sensors_battery()
        if battery:
            return {"percent": int(battery.percent), "is_charging": battery.power_plugged}
        return {"percent": None, "is_charging": None}

    def get_port_service(self):
        port_data = []
        connections = psutil.net_connections(kind="inet")
        for conn in connections:
            if conn.status == "LISTEN":
                port = conn.laddr.port
                try:
                    service = socket.getservbyport(port, "tcp")
                except (socket.error, OverflowError):
                    service = "unknown-service"

                try:
                    process = psutil.Process(conn.pid)
                    process_name = process.name()
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    process_name = "system/restricted"

                port_data.append(
                    {"port": port, "service": service, "process": process_name}
                )

        unique_ports = {p["port"]: p for p in port_data}.values()
        return list(unique_ports)

    def get_system_data(self):
        return {
            "cpu_usage": self.get_cpu_usage(),
            "memory_usage": self.get_memory_usage(),
            "disk_usage": self.get_disk_usage(),
            "network_usage": self.get_network_usage(),
            "battery_info": self.get_battery_info(),
            "ports_services": self.get_port_service(),
        }

    def get_biometrics(self, day=None):
        """Fetch biometrics for a given day (default: today)."""
        day_str = day or date.today().isoformat()
        wellness = self.intervals.get_wellness(day=day_str)
        activities_raw = self.intervals.get_activities(
            oldest=day_str, newest=day_str, limit=50
        )

        bio = {
            "sleep_hours": None,
            "hrv_ms": None,
            "resting_hr": None,
            "steps": None,
            "sleep_hr": None,
            "activities": None,
        }

        if wellness is not None:
            sleep = extract_sleep_data(wellness)
            bio.update({
                "sleep_hours": sleep["sleep_hours"],
                "sleep_hr": sleep["sleep_hr"],
                "hrv_ms": wellness.get("hrv"),
                "resting_hr": wellness.get("restingHR"),
                "steps": wellness.get("steps"),
            })

        if activities_raw is not None:
            bio["activities"] = extract_activity_summary(activities_raw)

        return bio

    def backfill_history(self, days=14):
        """Backfill historical biometrics on startup."""
        print(f"📥 Backfilling {days} days of biometrics history...")
        today = date.today()
        success = 0
        for i in range(days, 0, -1):
            day = (today - timedelta(days=i)).isoformat()
            try:
                bio = self.get_biometrics(day=day)
                payload = {"biometrics": bio, "date": day}
                self.send_pulse(payload)
                success += 1
            except Exception as e:
                print(f"  ⚠ Backfill {day}: {e}")
        print(f"✅ Backfilled {success}/{days} days")

    def build_payload(self):
        return {
            "system": self.get_system_data(),
            "biometrics": self.get_biometrics(),
        }

    def send_pulse(self, payload):
        if not self.api_key or not self.api_url:
            print("API key or URL not found")
            return

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            response = requests.post(
                f"{self.api_url}", headers=headers, json=payload, timeout=10
            )
            response.raise_for_status()
            print(f"✅ Pulse sent — {len(json.dumps(payload))} bytes")
        except requests.exceptions.ConnectionError:
            print("❌ Dashboard offline. Retrying in 60s...")
        except Exception as e:
            print(f"❌ Error: {e}")

    def _start_background_services(self):
        """Start AI coach, activity tracker, and GitHub poller in background threads."""
        # Activity Tracker (every 60s)
        tracker_thread = threading.Thread(
            target=self.activity_tracker.run_loop,
            daemon=True,
            name="activity-tracker",
        )
        tracker_thread.start()
        print("👁 Activity Tracker thread started")

        # AI Coach (every 5 min)
        coach_thread = threading.Thread(
            target=self.ai_coach.run_loop,
            daemon=True,
            name="ai-coach",
        )
        coach_thread.start()
        print("🧠 AI Coach thread started")

        # GitHub poller (every 15 min)
        def github_loop():
            interval = int(os.getenv("GITHUB_POLL_INTERVAL", "900"))
            while True:
                try:
                    self.github_client.collect_and_post()
                except Exception as e:
                    logger.error("GitHub poll error: %s", e)
                time.sleep(interval)

        github_thread = threading.Thread(
            target=github_loop,
            daemon=True,
            name="github-poller",
        )
        github_thread.start()
        print("🐙 GitHub Poller thread started")

        # Daily report (runs at ~11:55 PM or on first start)
        def report_loop():
            import schedule
            schedule.every().day.at("23:55").do(self._run_daily_report)
            while True:
                schedule.run_pending()
                time.sleep(60)

        report_thread = threading.Thread(
            target=report_loop,
            daemon=True,
            name="daily-report",
        )
        report_thread.start()
        print("📝 Daily Report scheduler started")

    def _run_daily_report(self):
        """Generate and post daily report."""
        result = self.daily_report.generate()
        if result:
            try:
                payload = {
                    "mode": "critical_fatigue",
                    "daily_postmortem": result,
                    "nudges": ["Daily report generated. Review your performance summary."],
                }
                headers = {
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                }
                r = requests.post(
                    f"{self.api_url}/api/ai/analyze",
                    headers=headers,
                    json=payload,
                    timeout=10,
                )
                if r.ok:
                    print("✅ Daily report posted")
            except Exception as e:
                print(f"❌ Daily report error: {e}")

    def run(self):
        print("🚀​ Starting FlowState Agent ...")
        self.backfill_history()
        self._start_background_services()

        while True:
            current_time = time.time()
            if current_time - self.last_check_time > self.check_interval:
                payload = self.build_payload()
                self.send_pulse(payload)
                self.last_check_time = current_time
            time.sleep(1)


if __name__ == "__main__":
    agent = AgentEnv()
    agent.run()
