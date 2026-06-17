# TikTok Archiver - Quick Start Checklist

Follow these exact commands to get up and running in ~15 minutes.

## Step 1: Install Dependencies (2 minutes)

```bash
cd C:/Users/o3sha/tiktok_archiver

pip install -r requirements.txt

playwright install chromium
```

## Step 2: Set Up Google Cloud (5 minutes)

### 2a. Create Service Account JSON

1. Go to https://console.cloud.google.com
2. Create a new project (top left dropdown)
3. Go to APIs & Services → Library
   - Enable "Google Sheets API"
   - Enable "Google Drive API"
4. Go to Credentials → Create Service Account
   - Name: `tiktok-archiver`
   - Grant role: **Editor**
   - Create JSON key when prompted
5. Save the JSON file as `C:/Users/o3sha/tiktok_archiver/service_account.json`

### 2b. Share Google Sheet and Drive Folder

1. Open your Google Sheet (create one if needed)
   - Copy the full URL for later
2. Click Share → Add the service account email (from service_account.json, field `client_email`)
3. Grant **Editor** access
4. Do the same for your Google Drive folder
   - Get folder ID from URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

### 2c. Update Config with Your IDs

Edit `C:/Users/o3sha/tiktok_archiver/config.py`:

```python
GOOGLE_SHEET_URL = "YOUR_SHEET_URL_HERE"
GOOGLE_DRIVE_FOLDER_ID = "YOUR_FOLDER_ID_HERE"
```

## Step 3: Create .env File (1 minute)

```bash
cd C:/Users/o3sha/tiktok_archiver

# Copy template
cp .env.example .env

# Edit .env (use any text editor):
GOOGLE_SERVICE_ACCOUNT_PATH=./service_account.json
BROWSER_HEADLESS=true
PROXY_SERVER=
```

## Step 4: Validate Setup (2 minutes)

```bash
# Test mode: runs 2 videos, validates Google APIs
python main.py --test
```

Expected output:
```
Successfully authenticated with Google Sheets API
Successfully authenticated with Google Drive API
Starting TikTok search for keyword: hatfield nightlife
...
TIKTOK ARCHIVER SUMMARY REPORT
Videos found:             2
Videos downloaded:        2
Videos uploaded to Drive: 2
Sheet rows added:         2
Failures:                 0
```

## Step 5: Run Full Scrape (varies)

### Option A: Single Keyword (Recommended for First Run)

```bash
python main.py --keyword "hatfield nightlife" --limit 5
```

Expected: Collects 5 videos from Hatfield nightlife, downloads, uploads, logs.

### Option B: All Keywords (5 keywords × 10 videos = 50 videos)

```bash
python main.py
```

Runs all keywords in config (~30-45 minutes).

### Option C: If CAPTCHA Blocks You

```bash
# Edit .env:
BROWSER_HEADLESS=false

# Run again:
python main.py --keyword "hatfield nightlife" --limit 2
```

Browser will open visibly. Solve CAPTCHA, then script continues automatically.

## Step 6: Check Results

1. **Google Sheet**: Open your sheet, scroll down → new rows with timestamp/keyword/caption/URL
2. **Google Drive**: Folder contains video files (e.g., `12345678.mp4`)
3. **Logs**: View `C:/Users/o3sha/tiktok_archiver/scraper.log` for detailed run output

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| `FileNotFoundError: service_account.json` | Ensure JSON exists at `C:/Users/o3sha/tiktok_archiver/service_account.json` |
| `401 Unauthorized` (Google API) | Verify service account email is shared in Sheet & Drive folder with Editor access |
| `CAPTCHA detected in headless mode` | Set `BROWSER_HEADLESS=false` in .env, solve CAPTCHA manually |
| `No videos found` | Try different keyword, run in headful mode to inspect page |
| `yt-dlp failed` | Upgrade: `pip install --upgrade yt-dlp` |
| Slow downloads | Normal (5-30s per video); check network, or enable PROXY_SERVER if behind firewall |

## Common Commands

```bash
# Single keyword, 3 videos, keep temp files for inspection
python main.py --keyword "hatfield nightlife" --limit 3 --no-cleanup

# Run in verbose mode (edit scraper.py logging level to DEBUG)
python main.py --test

# Check logs
tail -f scraper.log

# Clean up temp videos manually
rm -r tmp_videos
```

## Next Steps

- Monitor `scraper.log` for any errors or warnings
- For production runs, set up a cron job or Windows Task Scheduler
- Consider fallback services (Apify, ScrapingBee) if TikTok consistently blocks
- Customize SLEEP_BETWEEN_VIDEOS in config.py if rate-limited

## File Locations

- **Project**: `C:/Users/o3sha/tiktok_archiver/`
- **Config**: `C:/Users/o3sha/tiktok_archiver/config.py`
- **Service Account**: `C:/Users/o3sha/tiktok_archiver/service_account.json`
- **Logs**: `C:/Users/o3sha/tiktok_archiver/scraper.log`
- **Temp Videos**: `C:/Users/o3sha/tiktok_archiver/tmp_videos/`

---

**You're ready!** Start with `python main.py --test` to validate, then run your first keyword. Good luck!
