// backend/src/voice/intentRouter.js
//
// LLM-backed intent router for the voice loop. When ANTHROPIC_API_KEY is set,
// a single claude-opus-4-8 call classifies the transcript into a snake_case
// intent label + the list of agent domains that should handle it (structured
// output via a forced tool call). When the key is absent — or the API call
// fails for any reason — callers fall back to the existing regex router, so the
// stack stays keyless-first: nothing here ever throws to the request path.
//
// This module deliberately does NOT import the regex router; the controller
// owns the fallback so there is no circular dependency with voiceController /
// MotherCodeAgent. Keep DOMAINS in sync with the registered agents.

import Anthropic from '@anthropic-ai/sdk';

/** Canonical agent domains. Must match the keys registered on MotherCodeAgent. */
export const DOMAINS = [
  'calendar',
  'email',
  'social_media',
  'finance',
  'analytics',
  'file_manager',
  'tiktok',
];

const MODEL = process.env.MOTHERCODE_ROUTER_MODEL || 'claude-opus-4-8';

// Placeholder values that env.example / setup docs ship with — treat as "unset"
// so a template key never makes the router think it is live (mirrors the
// realKey() gate used by the voice providers).
const PLACEHOLDER = /^(your[-_]?|sk-ant-\.\.\.|sk-\.\.\.|xxx+|changeme|placeholder)/i;

/** Resolve the key from either env var name (env.example documents CLAUDE_API_KEY). */
function apiKey() {
  return (process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '').trim();
}

/** True when a usable Anthropic key is present (not blank, not a placeholder). */
export function llmConfigured() {
  const k = apiKey();
  return k.length > 20 && !PLACEHOLDER.test(k);
}

let _client = null;
function client() {
  if (!_client) _client = new Anthropic({ apiKey: apiKey() });
  return _client;
}

const ROUTING_TOOL = {
  name: 'route_command',
  description:
    'Route a user voice command to the agent domain(s) responsible for it. ' +
    'Return every domain that should act; return an empty array if none apply.',
  input_schema: {
    type: 'object',
    properties: {
      intent: {
        type: 'string',
        description:
          'A short snake_case intent label, e.g. schedule_event, read_emails, ' +
          'schedule_post, archive_tiktok, get_revenue, get_analytics, ' +
          'manage_file, or unknown when nothing fits.',
      },
      domains: {
        type: 'array',
        items: { type: 'string', enum: DOMAINS },
        description: 'The agent domains that should handle this command.',
      },
    },
    required: ['intent', 'domains'],
  },
};

const SYSTEM = [
  'You are the intent router for MotherCode, a voice assistant that dispatches a',
  'user command to specialized agents. Classify the command and pick the agent',
  'domain(s) that should act. Rules:',
  '- calendar: scheduling, meetings, availability, reminders, time blocking.',
  '- email: reading, drafting, replying to, or searching mail.',
  '- social_media: creating/scheduling posts to TikTok, Instagram, etc.',
  '- tiktok: ARCHIVING / scraping / downloading existing TikTok videos via the',
  '  tt_scraper pipeline. This is distinct from posting — an archive/scrape',
  '  request routes to tiktok ONLY, never social_media.',
  '- finance: revenue, payments, Stripe, subscribers, invoices.',
  '- analytics: performance, engagement, metrics, views, likes, insights.',
  '- file_manager: creating, editing, saving, organizing files/documents.',
  'Prefer the single best domain; only return multiple when the command truly',
  'spans more than one. Return domains: [] for chit-chat or anything unsupported.',
].join('\n');

/** Defensive cleanup shared with the regex path's invariants. */
function sanitizeDomains(domains) {
  let out = [...new Set((domains || []).filter((d) => DOMAINS.includes(d)))];
  // An archive request must not also fire the social poster (mirror MotherCodeAgent).
  if (out.includes('tiktok')) out = out.filter((d) => d !== 'social_media');
  return out;
}

/**
 * Classify a transcript with the LLM. Resolves to { intent, domains, source }.
 * Throws on any API/SDK failure so the caller can fall back to regex — callers
 * MUST wrap this in try/catch (or use llmConfigured() to gate it).
 */
export async function classifyIntent(transcript) {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 256,
    tools: [ROUTING_TOOL],
    tool_choice: { type: 'tool', name: 'route_command' },
    system: SYSTEM,
    messages: [{ role: 'user', content: String(transcript) }],
  });

  const block = (msg.content || []).find((b) => b.type === 'tool_use');
  if (!block || !block.input) {
    throw new Error('router: model returned no tool_use block');
  }
  const intent = typeof block.input.intent === 'string' ? block.input.intent : 'unknown';
  return { intent, domains: sanitizeDomains(block.input.domains), source: 'llm' };
}

export { sanitizeDomains, MODEL };
