// backend/src/agents/TikTokAgent.js
//
// Voice-loop front door for the existing `tt_scraper` subagent/pipeline (see
// .claude/agents/tt_scraper.md + tiktokClient.js). Registered under the 'tiktok'
// domain key. Mirrors the CalendarAgent/SocialAgent contract: execute() returns
// an object whose `.message` MotherCode.aggregateResults reads back.
//
// This does NOT re-implement scraping — it kicks off the user's deployed
// tt_scraper_runner.ps1 (F:\tiktok_archiver) and acknowledges immediately, since
// a real scrape is a multi-minute Playwright job.

import BaseAgent from './BaseAgent.js';
import { tiktokConfigured, archiveKeyword } from '../integrations/tiktokClient.js';

const NEEDS_AUTH =
  "I can run the tt_scraper TikTok pipeline once it's reachable — it needs tt_scraper_runner.ps1 and the F:\\tiktok_archiver pipeline (set TT_SCRAPER_RUNNER / TT_SCRAPER_DIR).";

// Filler words stripped when no "about <topic>" clause is present.
const NOISE = /\b(tiktoks?|videos?|clips?|footage|content|about|for|of|on|the|some|me|please|go|and)\b/gi;

export class TikTokAgent extends BaseAgent {
  constructor(redis) {
    super('TikTokAgent', 'tiktok', redis);
    this.isReady = true; // no async setup; pipeline reachability checked per-command
  }

  async execute(command) {
    if (!tiktokConfigured()) {
      return { message: NEEDS_AUTH, needsAuth: true, domain: 'tiktok' };
    }

    const text = command.transcript || command.intent || '';
    const keyword = this.extractKeyword(text);
    const limit = this.extractLimit(text);

    if (!keyword) {
      return {
        message: 'What topic should I archive? Try "archive 5 TikTok videos about Cape Town nightlife".',
        domain: 'tiktok',
        needsClarification: true,
      };
    }

    // Heavyweight, multi-minute Playwright run — fire it off and ACK now; log on completion.
    archiveKeyword(keyword, limit)
      .then((r) =>
        console.log(
          `[TikTokAgent] tt_scraper "${keyword}" done: success=${r.success} ok=${r.locationsSucceeded ?? '?'} fail=${r.locationsFailed ?? '?'}`
        )
      )
      .catch((e) => console.warn(`[TikTokAgent] tt_scraper "${keyword}" failed:`, e.message));

    return {
      message: `Started the tt_scraper pipeline to archive up to ${limit} TikTok videos about "${keyword}". I'll log them to your Wayta sheet.`,
      domain: 'tiktok',
      keyword,
      limit,
    };
  }

  /** "archive 5 tiktok videos about Cape Town nightlife" -> "Cape Town nightlife". */
  extractKeyword(text) {
    const t = (text || '').trim();
    const about = t.toLowerCase().indexOf(' about ');
    let s = about >= 0 ? t.slice(about + ' about '.length) : t;
    if (about < 0) {
      s = s.replace(/^\s*(please\s+)?(archive|scrape|download|grab|save|fetch|collect|pull)\s+/i, '');
    }
    return s
      .replace(/\b\d+\b/g, ' ')
      .replace(NOISE, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** "5 videos" -> 5; default 10 (matches the pipeline's VIDEOS_PER_KEYWORD), clamped 1..50. */
  extractLimit(text) {
    const m = (text || '').match(/\b(\d+)\b/);
    const n = m ? parseInt(m[1], 10) : 10;
    return Math.min(Math.max(n, 1), 50);
  }
}

export default TikTokAgent;
