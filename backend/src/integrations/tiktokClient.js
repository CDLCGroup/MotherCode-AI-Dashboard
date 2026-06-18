// backend/src/integrations/tiktokClient.js
//
// Bridge from the Node voice backend to the EXISTING `tt_scraper` pipeline — the
// user's deployed TikTok scraper at F:\tiktok_archiver, driven by the runner
// script tt_scraper_runner.ps1 (Playwright + yt-dlp + Google Sheets/Drive).
// We deliberately reuse that runner instead of re-invoking the repo's stale
// tiktok_archiver/ copy: the runner sets PLAYWRIGHT_BROWSERS_PATH, the F:\ paths,
// and the OAuth-Drive workaround the standalone copy lacks.
//
// Keyless-first, same shape as bufferClient/googleAuth: tiktokConfigured() gates
// on the runner + pipeline existing; archiveKeyword() throws { status, message }
// when not reachable so TikTokAgent falls back to a "pipeline not found" message.

import { spawn } from 'child_process';
import fs from 'fs';

const runnerPath = () => process.env.TT_SCRAPER_RUNNER || 'C:\\Users\\o3sha\\tt_scraper_runner.ps1';
const scraperDir = () => process.env.TT_SCRAPER_DIR || 'F:\\tiktok_archiver';

/** True when the runner script and the F:\ pipeline dir both exist on this host. */
export function tiktokConfigured() {
  try {
    return fs.existsSync(runnerPath()) && fs.existsSync(scraperDir());
  } catch {
    return false;
  }
}

/**
 * Launch the tt_scraper runner for one keyword. Resolves with
 * { success, keyword, limit, locationsSucceeded?, locationsFailed?, exitCode }.
 * Heavyweight (Playwright browser run, minutes) — TikTokAgent kicks this off and
 * ACKs immediately rather than awaiting it in the request path.
 *
 * Passes -SkipDriveUpload by default so a voice-triggered run never blocks on the
 * one-time Drive OAuth browser prompt; set TT_SCRAPER_DRIVE=1 to enable uploads.
 * Throws { status, message } when the pipeline isn't reachable.
 */
export function archiveKeyword(keyword, limit = 10) {
  if (!tiktokConfigured()) {
    throw {
      status: 501,
      message: 'tt_scraper pipeline not found (needs tt_scraper_runner.ps1 + F:\\tiktok_archiver)',
    };
  }
  const args = [
    '-ExecutionPolicy', 'Bypass', '-NoProfile',
    '-File', runnerPath(),
    '-Keyword', String(keyword),
    '-Limit', String(limit),
  ];
  if (process.env.TT_SCRAPER_DRIVE !== '1') args.push('-SkipDriveUpload');

  return new Promise((resolve, reject) => {
    const child = spawn('powershell.exe', args, { windowsHide: true });
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    child.on('error', (e) => reject({ status: 500, message: e.message }));
    child.on('close', (code) => {
      resolve({
        success: code === 0,
        keyword,
        limit,
        ...parseRunnerSummary(out),
        exitCode: code,
        error: code !== 0 ? (err || out).slice(-200) || `runner exited ${code}` : undefined,
      });
    });
  });
}

/** Pull the "Successful: N / Failed: N" location counts the runner prints at the end. */
function parseRunnerSummary(out) {
  const ok = out.match(/Successful:\s*(\d+)/i);
  const fail = out.match(/Failed:\s*(\d+)/i);
  return {
    locationsSucceeded: ok ? parseInt(ok[1], 10) : undefined,
    locationsFailed: fail ? parseInt(fail[1], 10) : undefined,
  };
}

export default { tiktokConfigured, archiveKeyword };
