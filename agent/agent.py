import os
import time
import json
import random
import psutil
import socket
import requests
from dotenv import load_dotenv

load_dotenv()


class AgentEnv:
    def __init__(self):
        self.api_key = os.getenv("API_KEY")
        self.api_url = os.getenv("API_URL")
        self.last_check_time = 0
        self.check_interval = 60

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

    # ── Dummy Biometrics ───────────────────────────

    def get_dummy_biometrics(self):
        activities = [
            "Morning run — 5.2 km",
            "Cycling — 12 km",
            "Weight training — 45 min",
            "Yoga session — 30 min",
            "Rest day",
            "Swimming — 1.5 km",
            "HIIT workout — 25 min",
        ]
        return {
            "sleep_hours": round(random.uniform(5.5, 9.0), 1),
            "hrv_ms": random.randint(30, 85),
            "calories": random.randint(1800, 2800),
            "heart_rate_bpm": random.randint(56, 88),
            "activity_summary": random.choice(activities),
        }

    # ── Dummy Workflow ─────────────────────────────

    def get_dummy_workflow(self):
        repos = ["adash", "sentinel", "dotfiles", "api-gateway"]
        labels = ["bug", "feature", "docs", "refactor", "chore"]

        commits = [
            {
                "repo": random.choice(repos),
                "message": random.choice(
                    [
                        "fix: resolve null pointer in stats collector",
                        "feat: add biometrics dummy data",
                        "chore: update dependencies",
                        "docs: update README with setup guide",
                        "refactor: extract db helpers",
                    ]
                ),
                "sha": f"{random.randint(0, 0xFFFFFF):06x}",
            }
            for _ in range(random.randint(1, 5))
        ]

        issues = [
            {
                "repo": random.choice(repos),
                "title": random.choice(
                    [
                        "Dashboard crashes on empty state",
                        "Add dark mode toggle",
                        "Migrate to PostgreSQL",
                        "Improve agent retry logic",
                        "Setup CI/CD pipeline",
                    ]
                ),
                "state": random.choice(["open", "closed"]),
                "label": random.choice(labels),
            }
            for _ in range(random.randint(1, 4))
        ]

        project_stats = {
            "title": random.choice(repos),
            "total_repos": random.randint(8, 20),
            "open_prs": random.randint(0, 6),
            "stars": random.randint(0, 50),
        }

        calendar = [
            {
                "title": random.choice(
                    [
                        "Team standup",
                        "Sprint planning",
                        "Code review session",
                        "1:1 with manager",
                        "Deploy to staging",
                        "Lunch break",
                    ]
                ),
                "time": f"{random.randint(8, 18):02d}:{random.choice(['00', '15', '30', '45'])}",
                "duration_min": random.choice([15, 30, 45, 60]),
            }
            for _ in range(random.randint(2, 5))
        ]

        return {
            "github_commits": commits,
            "github_issues": issues,
            "project_stats": project_stats,
            "calendar_entries": calendar,
        }

    # ── Pulse ──────────────────────────────────────

    def build_payload(self):
        return {
            "system": self.get_system_data(),
            "biometrics": self.get_dummy_biometrics(),
            "workflow": self.get_dummy_workflow(),
        }

    def send_pulse(self, payload):
        if not self.api_key or not self.api_url:
            print("⚠️ API key or URL not found")
            return

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        try:
            response = requests.post(
                self.api_url, headers=headers, json=payload, timeout=10
            )
            response.raise_for_status()
            print(f"✅ Pulse sent — {len(json.dumps(payload))} bytes")
        except requests.exceptions.ConnectionError:
            print("📡 Dashboard offline. Retrying in 60s...")
        except Exception as e:
            print(f"❌ Error: {e}")

    def run(self):
        print("🚀 Starting Agent ...")
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
