"""
TikTok Archiver - Main orchestration module.
Coordinates scraping, downloading, and archiving workflow.
"""

import logging
import os
import sys
import argparse
import shutil
from pathlib import Path
from datetime import datetime

import config
from scraper import search_tiktok
from downloader import download_video
from google_sheets import update_google_sheet
from google_drive import upload_to_drive

# Configure logging
log_file = "scraper.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler(sys.stdout),
    ],
)
logger = logging.getLogger(__name__)


class ArchiveStats:
    """Tracks statistics for the archiving run."""

    def __init__(self):
        self.keywords_processed = 0
        self.videos_found = 0
        self.videos_downloaded = 0
        self.videos_uploaded = 0
        self.sheet_rows_added = 0
        self.failures = []

    def print_summary(self):
        """Print a summary report of the run."""
        print("\n" + "=" * 80)
        print("TIKTOK ARCHIVER SUMMARY REPORT")
        print("=" * 80)
        print(f"Keywords processed:       {self.keywords_processed}")
        print(f"Videos found:             {self.videos_found}")
        print(f"Videos downloaded:        {self.videos_downloaded}")
        print(f"Videos uploaded to Drive: {self.videos_uploaded}")
        print(f"Sheet rows added:         {self.sheet_rows_added}")
        print(f"Failures:                 {len(self.failures)}")

        if self.failures:
            print("\nFailed items:")
            for failure in self.failures:
                print(f"  - {failure}")

        print("=" * 80 + "\n")


def validate_google_api_connectivity() -> bool:
    """
    Validate connectivity to Google APIs before scraping.

    Returns:
        True if both Sheets and Drive APIs are reachable, False otherwise
    """
    logger.info("Validating Google API connectivity...")

    try:
        from google_sheets import _get_sheets_client
        from google_drive import _get_drive_service

        sheets_client = _get_sheets_client()
        drive_service = _get_drive_service()

        logger.info("Successfully connected to Google Sheets and Drive APIs")
        return True

    except Exception as e:
        logger.error(f"Google API connectivity check failed: {e}")
        return False


def cleanup_temp_dir():
    """Clean up temporary video directory."""
    try:
        if os.path.exists(config.TEMP_VIDEO_DIR):
            shutil.rmtree(config.TEMP_VIDEO_DIR)
            logger.info(f"Cleaned up temporary directory: {config.TEMP_VIDEO_DIR}")
    except Exception as e:
        logger.warning(f"Error cleaning up temp directory: {e}")


def process_keyword(keyword: str, num_videos: int, stats: ArchiveStats) -> None:
    """
    Process a single keyword: search, download, upload, log.

    Args:
        keyword: Search keyword
        num_videos: Number of videos to collect
        stats: Stats tracker object
    """
    logger.info(f"\n{'='*80}")
    logger.info(f"Processing keyword: {keyword}")
    logger.info(f"{'='*80}")

    try:
        # Search TikTok
        logger.info(f"Searching for {num_videos} videos...")
        videos = search_tiktok(keyword, num_videos)

        if not videos:
            logger.warning(f"No videos found for keyword: {keyword}")
            stats.failures.append(f"{keyword}: no videos found")
            return

        stats.videos_found += len(videos)

        # Process each video
        for i, video_data in enumerate(videos, 1):
            video_url = video_data.get("url")
            caption = video_data.get("caption", "")

            logger.info(f"Processing video {i}/{len(videos)}: {video_url}")

            try:
                # Download video
                logger.debug(f"Downloading video...")
                file_path = download_video(video_url, config.TEMP_VIDEO_DIR)
                stats.videos_downloaded += 1
                logger.info(f"Downloaded: {file_path}")

                # Upload to Drive
                logger.debug(f"Uploading to Google Drive...")
                drive_file_id = upload_to_drive(file_path, config.GOOGLE_DRIVE_FOLDER_ID)
                if drive_file_id:
                    stats.videos_uploaded += 1
                    logger.info(f"Uploaded to Drive: {drive_file_id}")

                # Log to Google Sheet
                logger.debug(f"Logging to Google Sheets...")
                sheet_success = update_google_sheet(keyword, caption, video_url)
                if sheet_success:
                    stats.sheet_rows_added += 1
                    logger.info(f"Logged to Google Sheets")

            except Exception as e:
                logger.error(f"Error processing video {video_url}: {e}")
                stats.failures.append(f"{video_url}: {str(e)}")

            # Sleep between videos
            import time
            time.sleep(config.SLEEP_BETWEEN_VIDEOS)

    except Exception as e:
        logger.error(f"Error processing keyword {keyword}: {e}")
        stats.failures.append(f"{keyword}: {str(e)}")

    stats.keywords_processed += 1

    # Sleep between keywords
    import time
    time.sleep(config.SLEEP_BETWEEN_KEYWORDS)


def main():
    """Main entry point for the archiver."""
    parser = argparse.ArgumentParser(description="TikTok Video Archiver")
    parser.add_argument(
        "--keyword",
        type=str,
        default=None,
        help="Single keyword to search (overrides config)",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of videos per keyword",
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Run test mode (first keyword, 2 videos, verbose)",
    )
    parser.add_argument(
        "--no-cleanup",
        action="store_true",
        help="Don't clean up temp video directory after run",
    )

    args = parser.parse_args()

    logger.info("=" * 80)
    logger.info("TikTok Archiver Started")
    logger.info("=" * 80)

    # Determine keywords and video limit
    if args.test:
        keywords = ["hatfield nightlife"]
        videos_per_keyword = 2
        logger.info("TEST MODE enabled: using 'hatfield nightlife' keyword, 2 videos limit")
    elif args.keyword:
        keywords = [args.keyword]
        videos_per_keyword = args.limit or config.VIDEOS_PER_KEYWORD
    else:
        keywords = config.KEYWORDS
        videos_per_keyword = args.limit or config.VIDEOS_PER_KEYWORD

    logger.info(f"Keywords to process: {keywords}")
    logger.info(f"Videos per keyword: {videos_per_keyword}")

    # Validate Google API connectivity
    if not validate_google_api_connectivity():
        logger.error("Cannot proceed without Google API access. Exiting.")
        sys.exit(1)

    # Create temp directory
    os.makedirs(config.TEMP_VIDEO_DIR, exist_ok=True)

    # Process keywords
    stats = ArchiveStats()

    try:
        for keyword in keywords:
            process_keyword(keyword, videos_per_keyword, stats)

    except KeyboardInterrupt:
        logger.warning("Interrupted by user")
    except Exception as e:
        logger.error(f"Fatal error: {e}")
        sys.exit(1)
    finally:
        # Print summary
        stats.print_summary()

        # Clean up temp directory
        if not args.no_cleanup:
            cleanup_temp_dir()

        logger.info("TikTok Archiver completed")


if __name__ == "__main__":
    main()
