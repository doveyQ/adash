"""
GitHub Client — Fetches commits and issues, tracks seen SHAs to avoid duplicates.

Uses instant keyword-based scoring for commit frustration.
"""

import os
import re
import logging
import requests
from datetime import datetime, timedelta, timezone

logger = logging.getLogger(__name__)

# ── Keyword-based frustration scoring ──
FRUSTRATION_KEYWORDS = {
    r"\b(ugh|argh|damn|wtf|hack|stupid|crap)\b": 0.15,
    r"!{2,}": 0.10,
    r"\b(broken|breaking|broke)\b": 0.10,
    r"\b(fix|hotfix|bugfix|patch)\b": 0.06,
    r"\b(bug|issue|error|crash|fail)\b": 0.06,
    r"\b(revert|rollback)\b": 0.08,
    r"\b(temp|temporary|workaround)\b": 0.05,
    r"\b(again|retry|attempt)\b": 0.04,
    r"\b(todo|fixme|xxx)\b": 0.04,
    r"\b(urgent|emergency|critical)\b": 0.08,
    r"\b(feat|feature|add|implement|create)\b": -0.03,
    r"\b(refactor|clean|improve|optimize)\b": -0.02,
    r"\b(docs|readme|changelog|test)\b": -0.02,
}


def score_commit_message(message: str) -> float:
    """Score a single commit message for frustration (0.0–1.0)."""
    score = 0.2
    msg_lower = message.lower()
    for pattern, weight in FRUSTRATION_KEYWORDS.items():
        if re.search(pattern, msg_lower):
            score += weight
    return max(0.0, min(1.0, score))


def score_commits(commits: list[dict]) -> float:
    if not commits:
        return 0.0
    scores = [score_commit_message(c.get("message", "")) for c in commits]
    return round(sum(scores) / len(scores), 3)


class GitHubClient:
    def __init__(self):
        self.token = os.getenv("GITHUB_TOKEN", "")
        self.repos = [r.strip() for r in os.getenv("GITHUB_REPOS", "").split(",") if r.strip()]
        self.username = os.getenv("GITHUB_USERNAME", "")
        self.api_url = os.getenv("API_URL", "http://localhost:3000")
        self.api_key = os.getenv("API_KEY", "")
        self.session = requests.Session()
        if self.token:
            self.session.headers.update({
                "Authorization": f"token {self.token}",
                "Accept": "application/vnd.github.v3+json",
            })
        # Track seen commit SHAs to avoid re-posting duplicates
        self._seen_shas: set[str] = set()

    def _headers(self):
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    def fetch_recent_commits(self, hours: int = 24) -> list[dict]:
        """Fetch commits from the last N hours, deduplicated by SHA."""
        if not self.token or not self.repos:
            logger.info("GitHub not configured (no token or repos), skipping")
            return []

        since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
        new_commits = []

        for repo in self.repos:
            try:
                url = f"https://api.github.com/repos/{repo}/commits"
                r = self.session.get(url, params={"since": since, "per_page": 30}, timeout=15)
                r.raise_for_status()

                for commit in r.json():
                    sha = commit["sha"][:8]
                    if sha not in self._seen_shas:
                        self._seen_shas.add(sha)
                        new_commits.append({
                            "sha": sha,
                            "message": commit["commit"]["message"].split("\n")[0],
                            "repo": repo,
                            "timestamp": commit["commit"]["author"]["date"],
                            "author": commit["commit"]["author"]["name"],
                        })
            except Exception as e:
                logger.error("Failed to fetch commits from %s: %s", repo, e)

        if new_commits:
            logger.info("📦 Found %d new commits (total tracked: %d)", len(new_commits), len(self._seen_shas))
        return new_commits

    def fetch_issues(self) -> list[dict]:
        """Fetch open issues assigned to the user across configured repos."""
        if not self.token or not self.repos:
            return []

        all_issues = []
        for repo in self.repos:
            try:
                url = f"https://api.github.com/repos/{repo}/issues"
                params = {
                    "state": "open",
                    "per_page": 15,
                    "sort": "updated",
                    "direction": "desc",
                }
                # Filter by assignee if username is set
                if self.username:
                    params["assignee"] = self.username

                r = self.session.get(url, params=params, timeout=15)
                r.raise_for_status()

                for issue in r.json():
                    # Skip pull requests (they show up in issues API)
                    if "pull_request" in issue:
                        continue
                    all_issues.append({
                        "number": issue["number"],
                        "title": issue["title"],
                        "state": issue["state"],
                        "repo": repo,
                        "labels": [label["name"] for label in issue.get("labels", [])],
                        "created_at": issue["created_at"],
                        "updated_at": issue["updated_at"],
                        "url": issue["html_url"],
                    })
            except Exception as e:
                logger.error("Failed to fetch issues from %s: %s", repo, e)

        return all_issues

    def fetch_push_events(self, hours: int = 24) -> list[dict]:
        """Fetch push events from GitHub."""
        if not self.token or not self.username:
            return []

        events = []
        try:
            r = self.session.get(
                f"https://api.github.com/users/{self.username}/events",
                params={"per_page": 50},
                timeout=15,
            )
            if r.ok:
                since = datetime.now(timezone.utc) - timedelta(hours=hours)
                for event in r.json():
                    if event["type"] == "PushEvent":
                        created = datetime.fromisoformat(event["created_at"].rstrip("Z")).replace(tzinfo=timezone.utc)
                        if created >= since:
                            events.append({
                                "repo": event["repo"]["name"],
                                "commits": event["payload"].get("size", 0),
                                "timestamp": event["created_at"],
                            })
        except Exception as e:
            logger.error("Failed to fetch push events: %s", e)

        return events

    def collect_and_post(self):
        """Full cycle: fetch NEW commits + issues, score frustration, post to dashboard."""
        new_commits = self.fetch_recent_commits()
        issues = self.fetch_issues()
        push_events = self.fetch_push_events()

        if not new_commits and not issues:
            logger.debug("No new commits or issues to post")
            return

        frustration = score_commits(new_commits) if new_commits else 0.0

        per_commit = [
            {
                "message": c["message"],
                "score": score_commit_message(c["message"]),
                "signal": "keyword",
            }
            for c in new_commits[:20]
        ]

        payload = {
            "commit_messages": new_commits if new_commits else None,
            "push_events": push_events if push_events else None,
            "frustration_score": frustration,
            "sentiment_detail": per_commit if per_commit else None,
            "issues": issues if issues else None,
        }

        try:
            r = requests.post(
                f"{self.api_url}/api/github",
                headers=self._headers(),
                json=payload,
                timeout=10,
            )
            if r.ok:
                logger.info(
                    "✅ GitHub data posted — %d new commits, %d issues, frustration: %.2f",
                    len(new_commits), len(issues), frustration
                )
        except Exception as e:
            logger.error("Failed to post GitHub data: %s", e)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
    client = GitHubClient()
    client.collect_and_post()
