"""
Google Drive integration module.
Handles authentication and uploading video files to a Drive folder.
"""

import logging
import os
from typing import Optional
from google.oauth2.service_account import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload

import config

logger = logging.getLogger(__name__)

# Scopes required for Google Drive API
SCOPES = [
    "https://www.googleapis.com/auth/drive",
]

# MIME type for video files
VIDEO_MIME_TYPE = "video/mp4"


def _get_drive_service():
    """
    Authenticate and return a Google Drive service object.

    Returns:
        Authenticated googleapiclient.discovery.Resource

    Raises:
        Exception: If authentication fails
    """
    try:
        creds = Credentials.from_service_account_file(
            config.GOOGLE_SERVICE_ACCOUNT_PATH,
            scopes=SCOPES,
        )
        service = build("drive", "v3", credentials=creds)
        logger.info("Successfully authenticated with Google Drive API")
        return service
    except Exception as e:
        logger.error(f"Failed to authenticate with Google Drive: {e}")
        raise


def upload_to_drive(file_path: str, folder_id: str) -> Optional[str]:
    """
    Upload a video file to a Google Drive folder.

    Args:
        file_path: Local path to the video file
        folder_id: Google Drive folder ID

    Returns:
        Google Drive file ID if successful, None otherwise
    """
    logger.info(f"Uploading file to Drive: {file_path}")

    if not os.path.exists(file_path):
        logger.error(f"File not found: {file_path}")
        return None

    for attempt in range(config.MAX_RETRIES):
        try:
            service = _get_drive_service()

            # Get file name
            file_name = os.path.basename(file_path)

            # Create file metadata
            file_metadata = {
                "name": file_name,
                "parents": [folder_id],
            }

            # Upload file
            media = MediaFileUpload(file_path, mimetype=VIDEO_MIME_TYPE, resumable=True)
            request = service.files().create(
                body=file_metadata,
                media_body=media,
                fields="id",
            )

            response = request.execute()
            file_id = response.get("id")

            logger.info(f"Successfully uploaded to Drive with ID: {file_id}")
            return file_id

        except HttpError as e:
            logger.warning(f"Google Drive API error (attempt {attempt + 1}/{config.MAX_RETRIES}): {e}")
            if attempt < config.MAX_RETRIES - 1:
                import time
                time.sleep(2 ** attempt)
        except Exception as e:
            logger.error(f"Error uploading to Drive (attempt {attempt + 1}/{config.MAX_RETRIES}): {e}")
            if attempt < config.MAX_RETRIES - 1:
                import time
                time.sleep(2 ** attempt)

    logger.error(f"Failed to upload to Drive after {config.MAX_RETRIES} attempts")
    return None
