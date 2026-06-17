"""
Video downloader module using yt-dlp with fallback to direct HTTP download.
Implements retry logic with exponential backoff.
"""

import logging
import os
import time
import subprocess
from typing import Optional
import requests

import config

logger = logging.getLogger(__name__)


def download_video(video_url: str, output_dir: str) -> str:
    """
    Download a TikTok video using yt-dlp with HTTP fallback.

    Args:
        video_url: Full TikTok video URL
        output_dir: Directory to save the video file

    Returns:
        Path to the downloaded video file

    Raises:
        Exception: If download fails after MAX_RETRIES attempts
    """
    logger.info(f"Downloading video from: {video_url}")

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Try yt-dlp first (most reliable for TikTok)
    file_path = _download_with_ytdlp(video_url, output_dir)
    if file_path:
        return file_path

    # Fallback to direct HTTP download
    logger.warning("yt-dlp failed; attempting direct HTTP download")
    file_path = _download_with_http(video_url, output_dir)
    if file_path:
        return file_path

    raise Exception(f"Failed to download video after {config.MAX_RETRIES} retries: {video_url}")


def _download_with_ytdlp(video_url: str, output_dir: str) -> Optional[str]:
    """
    Download video using yt-dlp.

    Args:
        video_url: Full video URL
        output_dir: Output directory

    Returns:
        File path if successful, None otherwise
    """
    logger.debug("Attempting download with yt-dlp")

    for attempt in range(config.MAX_RETRIES):
        try:
            # Build yt-dlp command
            output_template = os.path.join(output_dir, "%(id)s.%(ext)s")
            cmd = [
                "yt-dlp",
                "-f", "best",
                "-o", output_template,
                "--quiet",
                video_url,
            ]

            result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)

            if result.returncode == 0:
                # Find the downloaded file
                file_name = _get_latest_file(output_dir)
                if file_name:
                    file_path = os.path.join(output_dir, file_name)
                    logger.info(f"Successfully downloaded with yt-dlp: {file_path}")
                    return file_path

            logger.debug(f"yt-dlp attempt {attempt + 1} failed: {result.stderr}")

        except subprocess.TimeoutExpired:
            logger.warning(f"yt-dlp timeout on attempt {attempt + 1}")
        except Exception as e:
            logger.error(f"yt-dlp error on attempt {attempt + 1}: {e}")

        if attempt < config.MAX_RETRIES - 1:
            backoff = 2 ** attempt
            logger.debug(f"Retrying yt-dlp in {backoff}s...")
            time.sleep(backoff)

    return None


def _download_with_http(video_url: str, output_dir: str) -> Optional[str]:
    """
    Download video using direct HTTP requests with spoofed headers.

    Args:
        video_url: Full video URL
        output_dir: Output directory

    Returns:
        File path if successful, None otherwise
    """
    logger.debug("Attempting download with HTTP")

    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.tiktok.com/",
    }

    for attempt in range(config.MAX_RETRIES):
        try:
            response = requests.get(video_url, headers=headers, timeout=30, allow_redirects=True)
            response.raise_for_status()

            # Try to get filename from headers or use video ID
            content_disposition = response.headers.get("content-disposition", "")
            if "filename=" in content_disposition:
                file_name = content_disposition.split("filename=")[1].strip('"')
            else:
                video_id = video_url.split("/video/")[-1].split("?")[0]
                file_name = f"{video_id}.mp4"

            file_path = os.path.join(output_dir, file_name)

            with open(file_path, "wb") as f:
                f.write(response.content)

            logger.info(f"Successfully downloaded with HTTP: {file_path}")
            return file_path

        except requests.exceptions.RequestException as e:
            logger.warning(f"HTTP download attempt {attempt + 1} failed: {e}")

        if attempt < config.MAX_RETRIES - 1:
            backoff = 2 ** attempt
            logger.debug(f"Retrying HTTP in {backoff}s...")
            time.sleep(backoff)

    return None


def _get_latest_file(directory: str) -> Optional[str]:
    """
    Get the most recently modified file in a directory.

    Args:
        directory: Directory to search

    Returns:
        File name if found, None otherwise
    """
    try:
        files = [f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f))]
        if not files:
            return None

        # Sort by modification time, most recent first
        files.sort(key=lambda f: os.path.getmtime(os.path.join(directory, f)), reverse=True)
        return files[0]

    except Exception as e:
        logger.error(f"Error getting latest file: {e}")
        return None
