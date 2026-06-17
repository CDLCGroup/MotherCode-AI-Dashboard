"""
TikTok scraper module using Playwright with stealth plugins.
Handles browser automation, navigation, filtering, and video data extraction.
"""

import logging
import time
import random
from typing import List, Dict, Optional
from playwright.sync_api import sync_playwright, Page, Browser, BrowserContext
from playwright_stealth import stealth_sync

import config

logger = logging.getLogger(__name__)

# User-Agent pool for rotation
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
]

VIEWPORT_SIZES = [
    {"width": 1366, "height": 768},
    {"width": 1920, "height": 1080},
    {"width": 1440, "height": 900},
]


def get_random_user_agent() -> str:
    """Return a random user agent from the pool."""
    return random.choice(USER_AGENTS)


def get_random_viewport() -> Dict[str, int]:
    """Return a random viewport size."""
    return random.choice(VIEWPORT_SIZES)


def random_delay(min_secs: float = 1.0, max_secs: float = 3.0) -> None:
    """Sleep for a random duration between min and max seconds."""
    delay = random.uniform(min_secs, max_secs)
    time.sleep(delay)


def search_tiktok(keyword: str, num_videos: int) -> List[Dict[str, str]]:
    """
    Search TikTok for videos matching the given keyword.

    Args:
        keyword: Search query (e.g., "hatfield nightlife")
        num_videos: Number of videos to collect

    Returns:
        List of dicts with keys: url, caption

    Raises:
        Exception: If scraping fails after MAX_RETRIES attempts
    """
    logger.info(f"Starting TikTok search for keyword: {keyword}")

    videos = []
    attempt = 0

    while attempt < config.MAX_RETRIES:
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch(
                    headless=config.BROWSER_HEADLESS,
                    proxy={"server": config.PROXY_SERVER} if config.PROXY_SERVER else None,
                )

                context = browser.new_context(
                    user_agent=get_random_user_agent(),
                    viewport=get_random_viewport(),
                    locale="en-US",
                    timezone_id="Africa/Johannesburg",
                )

                # Apply stealth plugin to mask automation
                stealth_sync(context)

                page = context.new_page()

                # Navigate to TikTok search
                search_url = f"https://www.tiktok.com/search?q={keyword.replace(' ', '+')}"
                logger.info(f"Navigating to: {search_url}")
                page.goto(search_url, wait_until="networkidle", timeout=30000)

                # Random delay before interacting
                random_delay(2, 4)

                # Apply filters
                _apply_filters(page, keyword)

                # Scroll and collect videos
                videos = _scroll_and_collect_videos(page, num_videos)

                page.close()
                context.close()
                browser.close()

                if videos:
                    logger.info(f"Successfully collected {len(videos)} videos for keyword: {keyword}")
                    return videos
                else:
                    logger.warning(f"No videos found on attempt {attempt + 1}/{config.MAX_RETRIES}")
                    attempt += 1
                    if attempt < config.MAX_RETRIES:
                        random_delay(5, 8)

        except Exception as e:
            logger.error(f"Error during search (attempt {attempt + 1}/{config.MAX_RETRIES}): {e}")
            attempt += 1
            if attempt < config.MAX_RETRIES:
                random_delay(5, 8)

    raise Exception(f"Failed to scrape TikTok after {config.MAX_RETRIES} attempts for keyword: {keyword}")


def _apply_filters(page: Page, keyword: str) -> None:
    """
    Apply TikTok search filters: Tab, Sort, Date.

    Args:
        page: Playwright page object
        keyword: Search keyword (for logging)
    """
    logger.debug(f"Applying filters for {keyword}")

    try:
        # Wait for page to load and check for CAPTCHA
        page.wait_for_load_state("domcontentloaded", timeout=10000)

        # Check for CAPTCHA/block indicators
        if _check_for_captcha(page):
            logger.warning("CAPTCHA detected! Waiting for manual resolution...")
            if not config.BROWSER_HEADLESS:
                logger.info("Headful mode: waiting 60 seconds for manual CAPTCHA solving...")
                time.sleep(60)
            else:
                raise Exception("CAPTCHA detected in headless mode - cannot proceed")

        # Try to click the "Videos" tab if it exists
        try:
            videos_tab = page.locator("a:has-text('Videos')")
            if videos_tab.is_visible():
                videos_tab.click()
                random_delay(1, 2)
                logger.debug("Clicked Videos tab")
        except Exception as e:
            logger.debug(f"Could not click Videos tab: {e}")

        # TikTok's filter UI varies; this is a best-effort approach
        # The main sort/date filters may be in a dropdown or sidebar

    except Exception as e:
        logger.warning(f"Error applying filters: {e}. Continuing without filters...")


def _check_for_captcha(page: Page) -> bool:
    """
    Check if TikTok is showing a CAPTCHA or bot-detection block.

    Args:
        page: Playwright page object

    Returns:
        True if CAPTCHA/block detected, False otherwise
    """
    captcha_selectors = [
        "iframe[src*='captcha']",
        "iframe[src*='challenge']",
        "[data-testid='challenge']",
        ".tiktok-challenge",
        ".tiktok-captcha",
    ]

    for selector in captcha_selectors:
        try:
            if page.locator(selector).first.is_visible():
                return True
        except Exception:
            pass

    return False


def _scroll_and_collect_videos(page: Page, num_videos: int) -> List[Dict[str, str]]:
    """
    Scroll the TikTok search feed and collect video data.

    Args:
        page: Playwright page object
        num_videos: Target number of videos to collect

    Returns:
        List of dicts with 'url' and 'caption' keys
    """
    logger.debug(f"Starting scroll to collect {num_videos} videos")

    videos = []
    seen_urls = set()
    scroll_count = 0
    max_scrolls = 50  # Prevent infinite scrolling

    while len(videos) < num_videos and scroll_count < max_scrolls:
        try:
            # Extract visible video links
            video_links = page.locator("a[href*='/video/']").all()
            logger.debug(f"Found {len(video_links)} video links on page")

            for link in video_links:
                if len(videos) >= num_videos:
                    break

                try:
                    url = link.get_attribute("href")
                    if url and url not in seen_urls:
                        # Ensure absolute URL
                        if not url.startswith("http"):
                            url = f"https://www.tiktok.com{url}"

                        seen_urls.add(url)

                        # Try to extract caption from link or nearby text
                        caption = _extract_caption(link)

                        videos.append({
                            "url": url,
                            "caption": caption,
                        })
                        logger.debug(f"Collected video {len(videos)}: {url}")

                except Exception as e:
                    logger.debug(f"Error extracting video info: {e}")
                    continue

            if len(videos) < num_videos:
                # Scroll down
                page.evaluate("window.scrollBy(0, 500)")
                random_delay(config.SLEEP_BETWEEN_VIDEOS - 1, config.SLEEP_BETWEEN_VIDEOS + 1)
                scroll_count += 1

        except Exception as e:
            logger.error(f"Error during scroll: {e}")
            break

    logger.info(f"Collected {len(videos)} videos after {scroll_count} scrolls")
    return videos[:num_videos]


def _extract_caption(link) -> str:
    """
    Extract caption/title from a video link element.

    Args:
        link: Playwright locator for the video link

    Returns:
        Caption string, or empty string if extraction fails
    """
    try:
        # Try multiple strategies to extract text
        parent = link.evaluate("el => el.closest('div[data-testid]')")
        if parent:
            # Look for text content in common caption locations
            text_content = link.evaluate("el => el.textContent || ''")
            return text_content.strip()[:200] if text_content else ""
    except Exception:
        pass

    return ""
