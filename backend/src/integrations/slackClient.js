// backend/src/integrations/slackClient.js
//
// Slack outbound client + the "subagent chat" fan-out. Mirrors the project's
// keyless-first pattern (see voice/tts.js + integrations/googleAuth.js): until a
// real SLACK_BOT_TOKEN is present every call is a graceful no-op, so the voice
// loop runs unchanged keyless and starts posting the instant a token is added.
//
// Scope: one-way OUTBOUND observability (send + status). Inbound control (slash
// commands / Events API) is a deliberate later phase — see SETUP-slack.md. The
// SLACK_SIGNING_SECRET placeholder in .env.example is reserved for that.

import { realKey } from '../voice/keys.js';

const SLACK_API = 'https://slack.com/api';

/** The channel each voice command threads under (overridable via SLACK_CHANNEL). */
export function slackChannel() {
  return process.env.SLACK_CHANNEL || '#mothercode-notifications';
}

/** True when a real (non-placeholder) bot token is configured. */
export function slackConfigured() {
  return realKey(process.env.SLACK_BOT_TOKEN);
}

/**
 * Post a message. Returns { success, ts?, channel?, error?, skipped? }.
 * NEVER throws into the request path: unconfigured → no-op { success:false,
 * skipped:true }; a network/Slack error resolves to { success:false, error }.
 * Pass `thread_ts` to make this a threaded reply.
 */
export async function postMessage({ channel, text, blocks, thread_ts } = {}) {
  if (!slackConfigured()) return { success: false, skipped: true };
  try {
    const res = await fetch(`${SLACK_API}/chat.postMessage`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: channel || slackChannel(),
        ...(text ? { text } : {}),
        ...(blocks ? { blocks } : {}),
        ...(thread_ts ? { thread_ts } : {}),
      }),
    });
    // Slack returns HTTP 200 with { ok, ts?, channel?, error? } in the body.
    const data = await res.json().catch(() => ({}));
    return {
      success: !!data.ok,
      ts: data.ts,
      channel: data.channel,
      error: data.ok ? undefined : data.error || `HTTP ${res.status}`,
    };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Workspace status via auth.test. Returns { connected, team?, error? }.
 * channelCount is deliberately omitted — counting channels needs the
 * channels:read scope, which the minimal chat:write bot setup does not grant.
 */
export async function getStatus() {
  if (!slackConfigured()) return { connected: false };
  try {
    const res = await fetch(`${SLACK_API}/auth.test`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    });
    const data = await res.json().catch(() => ({}));
    return data.ok
      ? { connected: true, team: data.team }
      : { connected: false, error: data.error || `HTTP ${res.status}` };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

/**
 * Pure builder (no network) for the subagent-chat payload: a parent line for the
 * voice command + one reply line per invoked agent. Kept pure so the offline
 * self-test can assert the shape without a token.
 *
 * @param {{intent?:string, transcript?:string, results?:Array}} call
 * @returns {{ parentText:string, replies:string[] }}
 */
export function buildAgentChat({ intent, transcript, results } = {}) {
  const quoted = transcript ? ` — "${transcript}"` : '';
  const parentText = `🎙 *${intent || 'voice command'}*${quoted}`;
  const replies = (Array.isArray(results) ? results : []).map((r) => {
    const ok = !!(r && r.success);
    const domain = (r && r.domain) || 'agent';
    // data is null on agent failure and absent on not-found agents — fall back.
    const detail = (r && r.data && r.data.message) || (r && r.error) || 'no response';
    return `${ok ? '🟢' : '🔴'} *${domain}* — ${detail}`;
  });
  return { parentText, replies };
}

/**
 * The "subagent chat": post a parent message for a voice command, then one
 * threaded reply per invoked agent so the channel reads like the specialized
 * agents talking back.
 *
 * Sequences parent → replies INTERNALLY (replies need the parent's ts). The
 * "fire-and-forget" boundary is the CALL SITE, not here: callers must invoke
 * this un-awaited (and .catch it) so a Slack hiccup never fails a voice command.
 *
 * @param {{intent?:string, transcript?:string, results?:Array}} call
 */
export async function postAgentChat({ intent, transcript, results } = {}) {
  if (!slackConfigured()) return { success: false, skipped: true };

  const { parentText, replies } = buildAgentChat({ intent, transcript, results });
  const parent = await postMessage({ text: parentText });
  // Without a parent ts we can't thread; skip replies rather than orphan them.
  if (!parent.success || !parent.ts) return parent;

  for (const text of replies) {
    await postMessage({ thread_ts: parent.ts, text });
  }
  return { success: true, ts: parent.ts, replies: replies.length };
}

export default {
  slackConfigured,
  slackChannel,
  postMessage,
  getStatus,
  buildAgentChat,
  postAgentChat,
};
