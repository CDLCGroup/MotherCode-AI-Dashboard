// backend/src/agents/EmailAgent.js
//
// Real Gmail agent. Replaces the email StubAgent. Registered under the 'email'
// domain key (see voiceRoutes.js). Same contract as the stub: execute() returns
// an object whose `.message` MotherCode.aggregateResults reads back.
//
// Reuses the shared googleAuth layer (built/proven by CalendarAgent). Keyless-
// first: returns a needsAuth guide message until Google is connected.
//
// Safety: drafting creates a Gmail DRAFT only — this agent never auto-sends.

import { google } from 'googleapis';
import BaseAgent from './BaseAgent.js';
import { isAuthorized, getAuthedClient } from '../integrations/googleAuth.js';

const NEEDS_AUTH =
  'I can read and draft email once your Google account is connected — open http://localhost:3001/auth/google to enable it.';

export class EmailAgent extends BaseAgent {
  constructor(redis) {
    super('EmailAgent', 'email', redis);
    this.isReady = true; // auth checked per-command
  }

  async execute(command) {
    if (!isAuthorized()) {
      return { message: NEEDS_AUTH, needsAuth: true, domain: 'email' };
    }

    const text = (command.transcript || command.intent || '').toLowerCase();
    const gmail = google.gmail({ version: 'v1', auth: getAuthedClient() });

    if (/\b(draft|reply|respond|write back|answer)\b/.test(text)) {
      return this.draftReply(gmail);
    }
    return this.readUrgent(gmail);
  }

  /** Summarize recent unread mail (the "read urgent email" path). */
  async readUrgent(gmail) {
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread newer_than:2d',
      maxResults: 5,
    });

    const msgs = data.messages || [];
    if (msgs.length === 0) {
      return { message: 'You have no unread email from the last two days.', domain: 'email', count: 0 };
    }

    const headers = await Promise.all(
      msgs.slice(0, 3).map((m) =>
        gmail.users.messages
          .get({ userId: 'me', id: m.id, format: 'metadata', metadataHeaders: ['From', 'Subject'] })
          .then((r) => this.extractHeaders(r.data))
          .catch(() => null)
      )
    );

    const lines = headers
      .filter(Boolean)
      .map((h) => `${h.from} — "${h.subject}"`)
      .join('; ');
    const plural = msgs.length === 1 ? 'message' : 'messages';
    return {
      message: `You have ${msgs.length} unread ${plural}. Top: ${lines}.`,
      domain: 'email',
      count: msgs.length,
    };
  }

  /** Create a draft reply to the most recent unread message. Never sends. */
  async draftReply(gmail) {
    const { data } = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread newer_than:7d',
      maxResults: 1,
    });
    const msgs = data.messages || [];
    if (msgs.length === 0) {
      return { message: 'There are no recent unread messages to reply to.', domain: 'email', count: 0 };
    }

    const full = await gmail.users.messages.get({
      userId: 'me',
      id: msgs[0].id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Message-ID'],
    });
    const h = this.extractHeaders(full.data);
    const threadId = full.data.threadId;

    const raw = this.buildRaw({
      to: h.fromRaw,
      subject: h.subject.startsWith('Re:') ? h.subject : `Re: ${h.subject}`,
      inReplyTo: h.messageId,
      body:
        `Hi,\n\nThanks for your message — I'll get back to you shortly with a full reply.\n\nBest regards`,
    });

    const draft = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw, threadId } },
    });

    return {
      message: `I drafted a reply to ${h.from} about "${h.subject}". It's saved in your Drafts — review and send when ready.`,
      domain: 'email',
      draftId: draft.data.id,
    };
  }

  extractHeaders(message) {
    const arr = message?.payload?.headers || [];
    const get = (name) => arr.find((x) => x.name.toLowerCase() === name.toLowerCase())?.value || '';
    const fromRaw = get('From');
    // "Jane Doe <jane@x.com>" → "Jane Doe"
    const fromName = fromRaw.replace(/<[^>]*>/, '').replace(/"/g, '').trim() || fromRaw;
    return {
      from: fromName,
      fromRaw,
      subject: get('Subject') || '(no subject)',
      messageId: get('Message-ID'),
    };
  }

  /** RFC 2822 message, base64url-encoded as Gmail's drafts API expects. */
  buildRaw({ to, subject, inReplyTo, body }) {
    const lines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
    ];
    if (inReplyTo) {
      lines.push(`In-Reply-To: ${inReplyTo}`);
      lines.push(`References: ${inReplyTo}`);
    }
    lines.push('', body);
    return Buffer.from(lines.join('\r\n'), 'utf8')
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }
}

export default EmailAgent;
