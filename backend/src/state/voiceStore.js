// backend/src/state/voiceStore.js
//
// In-memory ring buffer of recent voice calls + derived metrics.
//
// This is the source of truth for the live dashboard so the voice loop is
// observable WITHOUT a database: every processed command is recorded here and
// the /conversations, /metrics endpoints read from it. Postgres persistence is
// best-effort and additive (see voiceController) — if a DB is present the same
// rows are written there too, but the dashboard never depends on it.

const MAX_CALLS = 100;

/** @type {Array<object>} most-recent-first */
const calls = [];

let seq = 0;

/**
 * Append a VoiceCall (shape matches the frontend `VoiceCall` interface in src/store.ts):
 *   { conversationId, duration, status, intent, summary, timestamp }
 */
export function recordCall(call) {
  calls.unshift(call);
  if (calls.length > MAX_CALLS) calls.length = MAX_CALLS;
  return call;
}

/** Build a VoiceCall from a processed command + orchestration result. */
export function buildCall({ intent, transcript, response, success, durationSec, executionTimeMs }) {
  seq += 1;
  const duration =
    typeof durationSec === 'number' && durationSec >= 0
      ? Math.round(durationSec)
      : Math.max(1, Math.round((executionTimeMs || 0) / 1000));
  return {
    conversationId: `vc_${Date.now()}_${seq}`,
    duration,
    status: success ? 'completed' : 'failed',
    intent: intent || 'unknown',
    summary: response || transcript || '',
    timestamp: new Date().toISOString(),
  };
}

/** Recent calls, most-recent-first, capped at `limit`. */
export function getCalls(limit = 20) {
  return calls.slice(0, Math.max(0, limit));
}

/** Aggregate metrics over the buffer (shape matches `VoiceMetrics` in src/store.ts). */
export function getMetrics() {
  const total = calls.length;
  const completed = calls.filter((c) => c.status === 'completed').length;
  const avgDuration = total
    ? Math.round(calls.reduce((sum, c) => sum + (c.duration || 0), 0) / total)
    : 0;
  const intentCounts = {};
  for (const c of calls) {
    const key = c.intent || 'unknown';
    intentCounts[key] = (intentCounts[key] || 0) + 1;
  }
  return { total, completed, avgDuration, intentCounts };
}

export default { recordCall, buildCall, getCalls, getMetrics };
