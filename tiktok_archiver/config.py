"""
Configuration module for TikTok Archiver.
Loads environment variables and maintains central config block.
"""

import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ── CONFIGURATION ──────────────────────────────────────────────────────────────
KEYWORDS = [
    "braamfontein nightlife",
    "hatfield nightlife",
    "vaal nightlife",
    "durban nightlife",
    "cape town nightlife",
]

VIDEOS_PER_KEYWORD = 10
TIKTOK_TAB = "Videos"
TIKTOK_SORT = "Most Liked"
TIKTOK_DATE_FILTER = "Past week"

GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/19MwW0LQ-Cc4gaTpwe1ANsc50Zt77D_Wo_pHn1_1zFYA/edit"
GOOGLE_DRIVE_FOLDER_ID = "1OY2AKqEWjNJadgTDQLh0hvletw3NQaBO"

TEMP_VIDEO_DIR = "./tmp_videos"
SLEEP_BETWEEN_VIDEOS = 3   # seconds
SLEEP_BETWEEN_KEYWORDS = 10  # seconds
MAX_RETRIES = 3

# ───────────────────────────────────────────────────────────────────────────────

# Environment variables
GOOGLE_SERVICE_ACCOUNT_PATH = os.getenv("GOOGLE_SERVICE_ACCOUNT_PATH", "./service_account.json")
BROWSER_HEADLESS = os.getenv("BROWSER_HEADLESS", "true").lower() == "true"
PROXY_SERVER = os.getenv("PROXY_SERVER")

# Validate required environment variables
if not os.path.exists(GOOGLE_SERVICE_ACCOUNT_PATH):
    raise EnvironmentError(
        f"Service account JSON not found at {GOOGLE_SERVICE_ACCOUNT_PATH}. "
        "Please set GOOGLE_SERVICE_ACCOUNT_PATH in .env and ensure the file exists."
    )
