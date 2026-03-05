"""
Shared constants for FlowState Agent.

Loads app categories from categories.yaml and provides
canonical keyword lists used across all agent modules.
"""

import os
import yaml

# ── Load categories from YAML ──────────────────────────

_CATEGORIES_PATH = os.path.join(os.path.dirname(__file__), "categories.yaml")

def _load_categories() -> dict:
    """Load categories.yaml and return the categories dict."""
    try:
        with open(_CATEGORIES_PATH, "r") as f:
            data = yaml.safe_load(f)
            return data.get("categories", {})
    except FileNotFoundError:
        return {}

_CATEGORIES = _load_categories()

# ── Productive App Keywords ────────────────────────────
# Used for classifying window titles as "productive" (deep work).
# Both startsWith matching (for window titles) and contains matching.

PRODUCTIVE_KEYWORDS = (
    "IDE:", "Terminal:", "Code", "vim", "nvim", "emacs",
    "Figma", "Blender", "Godot", "Unity",
)

# ── Research / Dev Keywords ────────────────────────────
# Used for classifying browser tabs as productive research.

RESEARCH_KEYWORDS = (
    "roadmap.sh", "github.com", "stackoverflow.com", "docs.",
    "mdn", "typescriptlang.org", "react.dev", "nextjs.org",
    "chatgpt.com", "claude.ai", "gemini.google.com",
    "localhost:", "127.0.0.1:", "adash", "google search",
)

# ── IDE Patterns ───────────────────────────────────────
# Regex-ready patterns for identifying IDE windows.

IDE_PATTERNS = [
    r"Visual Studio Code",
    r"VSCodium",
    r"Code - OSS",
    r"IntelliJ IDEA",
    r"PyCharm",
    r"WebStorm",
    r"CLion",
    r"Cursor",
    r"Antigravity",
    r"GoLand",
    r"Neovim",
    r"Vim",
    r"Emacs",
    r"Sublime Text",
    r"Atom",
    r"Android Studio",
    r"Zed",
]

# ── Browser Patterns ───────────────────────────────────

BROWSER_PATTERNS = [
    r"Firefox",
    r"Chromium",
    r"Google Chrome",
    r"Brave",
    r"Microsoft Edge",
    r"Opera",
    r"Vivaldi",
    r"Safari",
]

# ── Deep Work Process Names ────────────────────────────
# From categories.yaml — process names for classification.

DEEP_WORK_APPS = _CATEGORIES.get("deep_work", [])
COMMUNICATION_APPS = _CATEGORIES.get("communication", [])
BROWSING_APPS = _CATEGORIES.get("browsing", [])
MEDIA_APPS = _CATEGORIES.get("media", [])

# ── Frustration Keywords ──────────────────────────────

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
