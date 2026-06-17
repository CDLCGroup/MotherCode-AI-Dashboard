# TikTok Archiver

A production-grade Python pipeline for scraping TikTok videos, downloading them, and archiving metadata to Google Sheets and Google Drive. Built with anti-bot evasion and modular design.

## Features

- **Stealth Browser Automation**: Uses Playwright with playwright-stealth to bypass TikTok bot detection
- **Multiple Download Engines**: yt-dlp primary, HTTP fallback with retry logic
- **Google Integration**: Logs to Sheets, uploads videos to Drive
- **Robust Error Handling**: Retry logic, fallback strategies, comprehensive logging
- **Flexible Configuration**: Keyword-based searches, configurable video limits, test mode
- **CAPTCHA Support**: Headful mode for manual CAPTCHA solving

## Prerequisites

- Python 3.10 or higher
- pip package manager
- Google Cloud Project with APIs enabled
- Playwright browser binaries

## Installation

### 1. Clone/Create Project

```bash
cd C:/Users/o3sha/tiktok_archiver
```

### 2. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 3. Install Playwright Browsers

```bash
playwright install chromium
```

### 4. Google Cloud Setup (Step-by-Step)

#### 4.1 Create a GCP Project
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown and select "NEW PROJECT"
3. Name it "TikTok Archiver" and click CREATE
4. Wait for the project to initialize

#### 4.2 Enable Google Sheets API
1. In Cloud Console, go to **APIs & Services** → **Library**
2. Search for "Google Sheets API"
3. Click it and press **ENABLE**
4. Wait for confirmation

#### 4.3 Enable Google Drive API
1. In **APIs & Services** → **Library**
2. Search for "Google Drive API"
3. Click it and press **ENABLE**

#### 4.4 Create a Service Account
1. Go to **APIs & Services** → **Credentials**
2. Click **CREATE CREDENTIALS** → **Service Account**
3. Fill in details:
   - Service account name: `tiktok-archiver`
   - Click CREATE AND CONTINUE
   - Grant role: **Editor** (for simplicity; production should use minimal scopes)
   - Click CONTINUE, then CREATE KEY
4. In the key type popup, select **JSON** and click CREATE
5. A JSON file downloads automatically
6. Rename it to `service_account.json` and place it in the project root

#### 4.5 Share Google Sheet and Drive Folder
1. Open your target Google Sheet (or create one)
2. Note the sheet URL for `GOOGLE_SHEET_URL` in config
3. Click Share → Add the service account email (found in service_account.json as `client_email`)
4. Grant **Editor** access and click Share
5. Do the same for your target Google Drive folder (get the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`)

### 5. Configure Environment

```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your values:
# - GOOGLE_SERVICE_ACCOUNT_PATH=./service_account.json
# - BROWSER_HEADLESS=true (set to false for CAPTCHA solving)
# - PROXY_SERVER= (optional)
```

## Running the Archiver

### Basic Run (All Keywords)

```bash
python main.py
```

Processes all keywords in config, collects 10 videos per keyword (configurable).

### Single Keyword

```bash
python main.py --keyword "hatfield nightlife" --limit 5
```

Searches for "hatfield nightlife", collects 5 videos.

### Test Mode

```bash
python main.py --test
```

Quick validation run:
- Uses "hatfield nightlife" keyword
- Collects only 2 videos
- Enables verbose logging
- Tests Google API connectivity before scraping

### Headful Mode (Manual CAPTCHA)

If TikTok shows a CAPTCHA:

```bash
# Edit .env
BROWSER_HEADLESS=false

# Run archiver
python main.py --keyword "hatfield nightlife"
```

The browser will open visibly. Solve the CAPTCHA manually, then the script will continue.

### No Cleanup

```bash
python main.py --no-cleanup
```

Keeps downloaded videos in `./tmp_videos` for inspection.

## Output

### Google Sheet Format

Each row appended contains:
- **Timestamp**: ISO 8601 datetime
- **Keyword**: Search query used
- **Caption**: Video description/title (first 200 chars)
- **URL**: Full TikTok video URL

### Google Drive

Videos uploaded to the specified folder with original filenames from yt-dlp or HTTP download.

### Console Output

Summary report printed at end:
```
================================================================================
TIKTOK ARCHIVER SUMMARY REPORT
================================================================================
Keywords processed:       1
Videos found:             5
Videos downloaded:        5
Videos uploaded to Drive: 5
Sheet rows added:         5
Failures:                 0
================================================================================
```

## Logging

Logs are written to both console and `scraper.log`:

- **INFO**: Main workflow steps
- **WARNING**: Retries, filter issues, CAPTCHA detection
- **ERROR**: Failures, API errors, download failures
- **DEBUG**: Detailed browser actions (increase verbosity if needed)

## Troubleshooting

### CAPTCHA Detected

**Symptom**: `CAPTCHA detected in headless mode` error

**Solution**:
1. Set `BROWSER_HEADLESS=false` in `.env`
2. Run with `python main.py --keyword "hatfield nightlife"`
3. When browser opens, solve the CAPTCHA manually
4. Script resumes automatically after 60 seconds

### Google API Errors

**Symptom**: `401 Unauthorized` or `404 Not found`

**Checklist**:
- Service account JSON exists at path specified in .env
- Google Sheet and Drive folder are shared with service account email
- APIs are enabled in GCP Console

### Video Download Fails

**Symptom**: `Failed to download video after 3 retries`

**Solutions**:
- Ensure yt-dlp is installed: `pip install --upgrade yt-dlp`
- Check network connectivity
- Enable proxy if behind corporate firewall (set `PROXY_SERVER` in .env)
- Try running with a single keyword and `--no-cleanup` to debug

### No Videos Found

**Symptom**: `No videos found on attempt 1/3`

**Possible causes**:
- TikTok blocked automation (CAPTCHA or rate limiting)
- Keyword returns no results
- Page structure changed (TikTok DOM may update)

**Solution**:
- Run in headful mode and inspect page manually
- Try a different keyword
- Check TikTok website directly to verify keyword returns results

## Advanced Configuration

### Fallback Services (For Consistent Blocking)

If TikTok consistently blocks automation, consider:

#### Option 1: Apify TikTok Scraper

```python
# apify_fallback.py (example)
import requests

def scrape_with_apify(keyword: str, num_videos: int):
    """Fallback using Apify's TikTok Scraper actor."""
    url = "https://api.apify.com/v2/acts/ilterin~tiktok-scraper/runs"
    payload = {
        "input": {
            "hashtags": [keyword],
            "resultsLimit": num_videos,
        }
    }
    headers = {"Authorization": f"Bearer {APIFY_TOKEN}"}
    response = requests.post(url, json=payload, headers=headers)
    # Parse and return results
```

**Pros**: Hosted service, bypasses most blocks
**Cons**: Paid service (~$3-5 per run), adds external dependency
**ToS Risk**: Medium (Apify acts as proxy, some risk remains)

#### Option 2: ScrapingBee

```python
# scrapingbee_fallback.py (example)
import requests

def scrape_with_scrapingbee(keyword: str):
    """Fallback using ScrapingBee's TikTok endpoint."""
    url = "https://app.scrapingbee.com/api/v1"
    params = {
        "api_key": SCRAPINGBEE_KEY,
        "url": f"https://www.tiktok.com/search?q={keyword}",
        "render_js": "true",
    }
    response = requests.get(url, params=params)
    # Parse HTML and extract videos
```

**Pros**: Render-friendly, handles JavaScript
**Cons**: Paid (~$50/month), slower
**ToS Risk**: Medium (renders TikTok server-side)

#### Option 3: Unofficial TikTok API

```python
# tiktok_api_fallback.py (example)
import requests

def scrape_with_unofficial_api(keyword: str):
    """Fallback using TikTok's internal API (use with caution)."""
    # Many communities maintain unofficial API wrappers
    # Example: TikTokApi (github.com/davidteather/TikTok-Api-Scraper)
    # Risks: Can break anytime, ToS violation
```

**Pros**: Free, fast, no rendering
**Cons**: Breaks frequently, direct ToS violation risk, IP bans possible
**ToS Risk**: High (violates TikTok ToS)

### Retry Strategy

Modify `config.MAX_RETRIES` and backoff logic in `downloader.py` and `scraper.py`:

```python
MAX_RETRIES = 5  # Increase attempts
# Edit _download_with_ytdlp to add custom timeout/flags
```

## File Structure

```
tiktok_archiver/
├── main.py                  # Entry point, orchestration
├── config.py                # Configuration and env loading
├── scraper.py               # Playwright browser automation
├── downloader.py            # Video download (yt-dlp + HTTP)
├── google_sheets.py         # Google Sheets logging
├── google_drive.py          # Google Drive upload
├── requirements.txt         # Python dependencies
├── .env.example             # Env template
├── .env                     # (Git-ignored, user-filled)
├── service_account.json     # (Git-ignored, GCP secret)
├── scraper.log              # (Git-ignored, generated)
├── tmp_videos/              # (Git-ignored, temp download dir)
├── .gitignore
├── README.md
└── __pycache__/             # (Git-ignored)
```

## Development Notes

### Type Hints

All functions use type hints for clarity:
```python
def search_tiktok(keyword: str, num_videos: int) -> List[Dict[str, str]]:
```

### Logging

Use the `logging` module, not `print()`:
```python
import logging
logger = logging.getLogger(__name__)
logger.info("Message")
logger.error("Error")
```

### Stealth Techniques

- **playwright-stealth**: Masks automation fingerprints
- **User-Agent rotation**: Random UA each browser session
- **Viewport randomization**: Different screen sizes
- **Random delays**: Mimics human scroll/interaction timing

## Performance Notes

- Each keyword scrape: ~30-60 seconds (depends on scroll depth)
- Download per video: ~2-10 seconds (network dependent)
- Sheet append: ~1-2 seconds per row (API latency)
- Drive upload: ~5-30 seconds per video (file size dependent)

Typical full run (5 keywords, 10 videos each = 50 videos): ~30-45 minutes

## License

Internal use only. Respect TikTok's ToS and local laws.

## Support

For issues:
1. Check `scraper.log` for detailed error messages
2. Run `python main.py --test` to validate setup
3. Try single keyword: `python main.py --keyword "hatfield nightlife" --limit 2`
4. Enable headful mode to inspect page: `BROWSER_HEADLESS=false`
