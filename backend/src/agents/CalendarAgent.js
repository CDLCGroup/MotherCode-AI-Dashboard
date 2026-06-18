// backend/src/agents/CalendarAgent.js
//
// Real Google Calendar agent. Replaces the calendar StubAgent. Registered under
// the 'calendar' domain key (see voiceRoutes.js). Contract is identical to the
// stub: execute() returns an object whose `.message` MotherCode.aggregateResults
// reads back as the spoken reply.
//
// Keyless-first: when Google isn't connected yet it returns a needsAuth message
// guiding the user to /auth/google instead of throwing — the dashboard stays
// live and goes real the instant tokens exist.

import { google } from 'googleapis';
import BaseAgent from './BaseAgent.js';
import { isAuthorized, getAuthedClient } from '../integrations/googleAuth.js';

const NEEDS_AUTH =
  'I can manage your calendar once your Google account is connected — open http://localhost:3001/auth/google to enable it.';

export class CalendarAgent extends BaseAgent {
  constructor(redis) {
    super('CalendarAgent', 'calendar', redis);
    this.isReady = true; // no async setup; auth is checked per-command
  }

  async execute(command) {
    if (!isAuthorized()) {
      return { message: NEEDS_AUTH, needsAuth: true, domain: 'calendar' };
    }

    const text = (command.transcript || command.intent || '').toLowerCase();
    const action = this.routeAction(text);

    const calendar = google.calendar({ version: 'v3', auth: getAuthedClient() });

    if (action === 'list') {
      return this.listEvents(calendar);
    }
    return this.createEvent(calendar, command.transcript || '');
  }

  /** create vs list/fetch — list words win; otherwise default to create. */
  routeAction(text) {
    if (/\b(what'?s|whats|agenda|list|show|view|do i have|coming up|on my|today|tomorrow)\b/.test(text) &&
        !/\b(schedule|book|add|create|block|set up|put)\b/.test(text)) {
      return 'list';
    }
    return 'create';
  }

  async listEvents(calendar) {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() + 1);

    const { data } = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: end.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 10,
    });

    const items = data.items || [];
    if (items.length === 0) {
      return { message: 'You have nothing on your calendar for the next 24 hours.', domain: 'calendar', count: 0 };
    }
    const next = items[0];
    const when = next.start?.dateTime || next.start?.date;
    const timeStr = when ? new Date(when).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' }) : 'soon';
    const plural = items.length === 1 ? 'event' : 'events';
    return {
      message: `You have ${items.length} ${plural} coming up. Next: "${next.summary || 'Untitled'}" at ${timeStr}.`,
      domain: 'calendar',
      count: items.length,
    };
  }

  async createEvent(calendar, transcript) {
    const { title, start, end, parsedTime } = this.parseEvent(transcript);

    // If we couldn't find any time reference, ask rather than guess a slot.
    if (!parsedTime) {
      return {
        message: `I can schedule "${title}", but I didn't catch a time. Try "schedule ${title} tomorrow at 2pm".`,
        domain: 'calendar',
        needsClarification: true,
      };
    }

    // Send the IANA timezone so "2pm" lands at 2pm local even if the backend
    // runs on a UTC host (toISOString() alone would create it in UTC).
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const { data } = await calendar.events.insert({
      calendarId: 'primary',
      requestBody: {
        summary: title,
        start: { dateTime: start.toISOString(), timeZone },
        end: { dateTime: end.toISOString(), timeZone },
      },
    });

    const timeStr = start.toLocaleString('en-US', {
      weekday: 'long', hour: 'numeric', minute: '2-digit',
    });
    return {
      message: `Scheduled "${title}" for ${timeStr}.`,
      domain: 'calendar',
      eventId: data.id,
      htmlLink: data.htmlLink,
    };
  }

  /**
   * Best-effort extraction of a title + start/end from a transcript.
   * Documented heuristics (deliberately simple — the LLM intent layer, a
   * separate plan, will supply richer entities later):
   *   - time of day: "at 2pm", "at 14:00", "at noon", "at midnight"
   *   - day: "today" (default), "tomorrow", or a weekday name → next occurrence
   *   - duration: fixed 1 hour
   * Returns { title, start, end, parsedTime } where parsedTime is false when no
   * time/day reference was found.
   */
  parseEvent(transcript) {
    const text = (transcript || '').trim();
    const lower = text.toLowerCase();

    const start = new Date();
    start.setSeconds(0, 0);
    let parsedTime = false;

    // --- day ---
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

    // --- time of day ---
    let hour = 9, minute = 0; // sensible default if only a day was given
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
      // Bare hour with no am/pm and no day word is too ambiguous to be a time.
      if (mer || parsedTime) parsedTime = true;
    }
    start.setHours(hour, minute, 0, 0);

    const end = new Date(start);
    end.setHours(end.getHours() + 1);

    // --- title ---
    let title = this.extractTitle(text);

    return { title, start, end, parsedTime };
  }

  extractTitle(text) {
    let t = text
      .replace(/^\s*(please\s+)?(schedule|book|add|create|set up|put|block(?:\s+off)?)\s+/i, '')
      .replace(/\b(a|an|my|the)\s+/i, '')
      // strip trailing time/day clause
      .replace(/\b(today|tonight|tomorrow|on\s+\w+day|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b.*$/i, '')
      .replace(/\bat\s+\d.*$/i, '')
      .replace(/\b(at\s+)?(noon|midnight)\b.*$/i, '')
      .replace(/\bfor\s*$/i, '')
      .trim();
    if (!t) t = 'Event';
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
}

export default CalendarAgent;
