"""
Google Sheets integration module.
Handles authentication and appending video data to a Google Sheet.
"""

import logging
from datetime import datetime
from typing import Optional
import gspread
from google.oauth2.service_account import Credentials

import config

logger = logging.getLogger(__name__)

# Scopes required for Google Sheets API
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]


def _get_sheets_client():
    """
    Authenticate and return a gspread client.

    Returns:
        Authenticated gspread.Client

    Raises:
        Exception: If authentication fails
    """
    try:
        creds = Credentials.from_service_account_file(
            config.GOOGLE_SERVICE_ACCOUNT_PATH,
            scopes=SCOPES,
        )
        client = gspread.authorize(creds)
        logger.info("Successfully authenticated with Google Sheets API")
        return client
    except Exception as e:
        logger.error(f"Failed to authenticate with Google Sheets: {e}")
        raise


def update_google_sheet(
    keyword: str,
    caption: str,
    video_url: str,
) -> bool:
    """
    Append a row to the Google Sheet with video metadata.

    Args:
        keyword: Search keyword used
        caption: Video caption/description
        video_url: Full TikTok video URL

    Returns:
        True if successful, False otherwise
    """
    logger.info(f"Updating Google Sheet with video: {video_url}")

    for attempt in range(config.MAX_RETRIES):
        try:
            client = _get_sheets_client()

            # Open sheet by URL
            sheet = client.open_by_url(config.GOOGLE_SHEET_URL)
            worksheet = sheet.sheet1  # Get the first sheet

            # Prepare row data
            timestamp = datetime.now().isoformat()
            row_data = [
                timestamp,
                keyword,
                caption[:200] if caption else "",  # Limit caption to 200 chars
                video_url,
            ]

            # Append row
            worksheet.append_row(row_data, value_input_option="USER_ENTERED")
            logger.info(f"Successfully appended row to Google Sheet: {video_url}")
            return True

        except gspread.exceptions.APIError as e:
            logger.warning(f"Google Sheets API error (attempt {attempt + 1}/{config.MAX_RETRIES}): {e}")
            if attempt < config.MAX_RETRIES - 1:
                import time
                time.sleep(2 ** attempt)
        except Exception as e:
            logger.error(f"Error updating Google Sheet (attempt {attempt + 1}/{config.MAX_RETRIES}): {e}")
            if attempt < config.MAX_RETRIES - 1:
                import time
                time.sleep(2 ** attempt)

    logger.error(f"Failed to update Google Sheet after {config.MAX_RETRIES} attempts")
    return False
