// backend/src/agents/SocialAgent.js
//
// Real social-media agent (Buffer-backed). Replaces the social_media StubAgent.
// Registered under the 'social_media' domain key (see voiceRoutes.js) — that key
// is what MotherCode.routeIntent emits and what aggregateResults reads back, so
// it MUST be 'social_media' (not 'social') to override the stub.
//
// Contract is identical to the stub and to CalendarAgent/EmailAgent: execute()
// returns an object whose `.message` MotherCode.aggregateResults reads back as
// the spoken reply. Keyless-first: until Buffer is connected it returns a
// needsAuth message instead of throwing.

import BaseAgent from './BaseAgent.js';
import { realKey } from '../voice/keys.js';
import {
  bufferConfigured,
  listScheduled,
  createPost,
} from '../integrations/bufferClient.js';

const NEEDS_AUTH =
  'I can schedule and publish social posts once Buffer is connected — set BUFFER_API_KEY in .env to enable it.';

const PLATFORMS = ['tiktok', 'instagram', 'twitter', 'facebook', 'linkedin', 'youtube'];

export class SocialAgent extends BaseAgent {
  constructor(redis) {
    super('SocialAgent', 'social_media', redis);
    this.isReady = true; // no async setup; Buffer auth is checked per-command
  }

  async execute(command) {
    if (!bufferConfigured()) {
      return { message: NEEDS_AUTH, needsAuth: true, domain: 'social_media' };
    }

    const text = command.transcript || command.intent || '';
    const action = this.routeAction(text);

    if (action === 'list') {
      return this.listQueue();
    }
    return this.createOrSchedule(text, action);
  }

  /** list (view queue) vs now (publish immediately) vs schedule (default). */
  routeAction(text) {
    const t = (text || '').toLowerCase();
    if (
      /\b(list|show|what'?s|whats|view|see|queue|scheduled|pending|upcoming)\b/.test(t) &&
      !/\b(schedule|post|share|tweet|publish)\b/.test(t)
    ) {
      return 'list';
    }
    if (/\b(right\s+now|now|immediately|asap|publish now|post now)\b/.test(t)) {
      return 'now';
    }
    return 'schedule';
  }

  async listQueue() {
    const posts = await listScheduled();
    if (!posts.length) {
      return { message: 'You have no scheduled social posts.', domain: 'social_media', count: 0 };
    }
    const next = posts[0];
    const preview = (next.text || '').slice(0, 60);
    const plural = posts.length === 1 ? 'post' : 'posts';
    return {
      message: `You have ${posts.length} scheduled ${plural}. Next: "${preview}".`,
      domain: 'social_media',
      count: posts.length,
    };
  }

  async createOrSchedule(text, action) {
    const { caption, platforms, scheduledAt, parsedTime } = this.parsePost(text);
    const targets = platforms.length ? platforms : this.defaultPlatforms();

    if (!caption) {
      return {
        message: "I didn't catch what to post. Try \"schedule a TikTok about our launch tomorrow at 5pm\".",
        domain: 'social_media',
        needsClarification: true,
      };
    }
    if (action === 'schedule' && !parsedTime) {
      return {
        message: `I can post "${caption}", but I didn't catch when. Try "...tomorrow at 5pm" or say "post now".`,
        domain: 'social_media',
        needsClarification: true,
      };
    }

    const now = action === 'now';
    const { id } = await createPost({
      text: caption,
      platforms: targets,
      scheduledAt: now ? undefined : scheduledAt.toISOString(),
      now,
    });

    const when = now
      ? 'now'
      : scheduledAt.toLocaleString('en-US', { weekday: 'long', hour: 'numeric', minute: '2-digit' });
    return {
      message: `${now ? 'Posted' : 'Scheduled'} "${caption}" to ${targets.join(', ')} ${now ? '' : `for ${when}`}.`.replace(/\s+\./, '.'),
      domain: 'social_media',
      postId: id,
      platforms: targets,
      scheduledAt: now ? null : scheduledAt.toISOString(),
    };
  }

  /**
   * Best-effort extraction of { caption, platforms, scheduledAt, parsedTime }
   * from a transcript. Deliberately simple heuristics (the richer LLM intent
   * layer is a separate plan): platform names anywhere in the text; a caption
   * from the "about …" clause (or the verb-stripped remainder); and a day/time
   * via parseWhen(). parsedTime is false when no time/day reference was found.
   */
  parsePost(text) {
    const lower = (text || '').toLowerCase();
    const platforms = PLATFORMS.filter((p) => new RegExp(`\\b${p}\\b`).test(lower));
    const { scheduledAt, parsedTime } = this.parseWhen(lower);
    const caption = this.extractCaption(text);
    return { caption, platforms, scheduledAt, parsedTime };
  }

  extractCaption(text) {
    let t = (text || '').trim();
    const aboutIdx = t.toLowerCase().indexOf(' about ');
    if (aboutIdx >= 0) {
      t = t.slice(aboutIdx + ' about '.length);
    } else {
      t = t
        .replace(/^\s*(please\s+)?(schedule|post|share|tweet|publish|create)\s+/i, '')
        .replace(/^\s*(a|an|the)\s+/i, '');
    }
    return t
      // drop platform mentions
      .replace(/\b(tiktok|instagram|insta|twitter|tweet|facebook|linkedin|youtube)\b/gi, ' ')
      // drop leftover leading filler ("and a post", "the update", …)
      .replace(/^\s*(and\s+)?(a|an|the)?\s*(post|update|video|reel|story)?\s*/i, '')
      // strip trailing day/time clause
      .replace(/\b(today|tonight|tomorrow|on\s+\w+day|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b.*$/i, '')
      .replace(/\bat\s+\d.*$/i, '')
      .replace(/\b(at\s+)?(noon|midnight)\b.*$/i, '')
      .replace(/\b(right\s+)?(now|immediately|asap)\b.*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Resolve a start time from a transcript. Mirrors CalendarAgent's heuristics:
   *   - day: "tomorrow", a weekday name (→ next occurrence), or "today"/"tonight"
   *   - time: "at 5pm", "at 17:00", "at noon", "at midnight"
   * Returns { scheduledAt: Date|null, parsedTime } — null when no time was found.
   */
  parseWhen(lower) {
    const start = new Date();
    start.setSeconds(0, 0);
    let parsedTime = false;

    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    if (/\btomorrow\b/.test(lower)) {
      start.setDate(start.getDate() + 1);
      parsedTime = true;
    } else {
      const wd = weekdays.findIndex((d) => new RegExp(`\\b${d}\\b`).test(lower));
      if (wd >= 0) {
        const diff = (wd - start.getDay() + 7) % 7 || 7; // next occurrence (not today)
        start.setDate(start.getDate() + diff);
        parsedTime = true;
      } else if (/\btoday\b|\btonight\b/.test(lower)) {
        parsedTime = true;
      }
    }

    let hour = 9, minute = 0;
    const noon = /\bnoon\b/.test(lower);
    const midnight = /\bmidnight\b/.test(lower);
    const clock = lower.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/);
    if (noon) {
      hour = 12; minute = 0; parsedTime = true;
    } else if (midnight) {
      hour = 0; minute = 0; parsedTime = true;
    } else if (clock) {
      hour = parseInt(clock[1], 10);
      minute = clock[2] ? parseInt(clock[2], 10) : 0;
      const mer = clock[3];
      if (mer === 'pm' && hour < 12) hour += 12;
      if (mer === 'am' && hour === 12) hour = 0;
      if (mer || parsedTime) parsedTime = true; // bare hour w/ no am/pm and no day is too vague
    }
    start.setHours(hour, minute, 0, 0);

    return { scheduledAt: parsedTime ? start : null, parsedTime };
  }

  /** Platforms to post to when the transcript named none — from configured channels. */
  defaultPlatforms() {
    const p = [];
    if (realKey(process.env.BUFFER_CHANNEL_TIKTOK)) p.push('tiktok');
    if (realKey(process.env.BUFFER_CHANNEL_INSTAGRAM)) p.push('instagram');
    return p.length ? p : ['tiktok'];
  }
}

export default SocialAgent;
