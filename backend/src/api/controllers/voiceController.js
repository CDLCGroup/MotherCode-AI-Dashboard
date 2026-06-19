// backend/src/api/controllers/voiceController.js

import { recordCall, buildCall, getCalls, getMetrics } from '../../state/voiceStore.js';
import { broadcast } from '../../realtime/wsHub.js';
import { ttsConfigured, ttsFallbackConfigured, synthesizeWithFallback } from '../../voice/tts.js';
import { sttConfigured, sttFallbackConfigured, transcribeWithFallback } from '../../voice/stt.js';
import { googleConfigured, isAuthorized } from '../../integrations/googleAuth.js';
import { slackConfigured, postAgentChat } from '../../integrations/slackClient.js';
import { bufferConfigured } from '../../integrations/bufferClient.js';

/**
 * Handle voice command processing.
 * Body: { userId, transcript, audio?, durationSec? }
 */
export const processVoiceCommand = async (req, res, db, motherCode) => {
  try {
    const { userId, transcript, durationSec } = req.body;

    if (!userId || !transcript) {
      return res.status(400).json({
        error: 'Missing required fields: userId, transcript'
      });
    }

    console.log(`[VoiceController] Processing command from user ${userId}:`, transcript);

    // Parse intent from transcript (could use Claude API for better accuracy)
    const intent = parseIntent(transcript);

    // Route to MotherCode for orchestration
    const command = {
      userId,
      transcript,
      intent,
      timestamp: new Date().toISOString()
    };

    const result = await motherCode.process(command);

    // BaseAgent.process() wraps execute()'s output:
    //   { success, agent, data: { response, agents_invoked, results, ... }, executionTime }
    // so the orchestration payload lives under result.data.
    const payload = result.data || {};
    const responseText = payload.response || '';
    const agentsInvoked = payload.agents_invoked || [];

    // Record into the in-memory store (source of truth for the live dashboard)
    // and push to any connected WebSocket clients in real time.
    const call = buildCall({
      intent,
      transcript,
      response: responseText,
      success: result.success,
      durationSec,
      executionTimeMs: result.executionTime,
    });
    recordCall(call);
    broadcast('voice_call', call);

    // Mirror the command into Slack as a "subagent chat": one parent message per
    // voice command, then one threaded reply per invoked agent. Reads the
    // controller locals (intent, transcript, and payload.results) — NOT `call`,
    // which carries none of them. Outbound-only and fire-and-forget: invoked
    // un-awaited and .catch()'d so a Slack hiccup never fails the request path.
    if (slackConfigured()) {
      postAgentChat({ intent, transcript, results: payload.results })
        .then((r) => {
          // postMessage resolves (never throws) on a Slack API error, so surface
          // a failed post here — most often channel_not_found (invite the bot to
          // SLACK_CHANNEL). Logged, not thrown: the request has already returned.
          if (r && r.success === false && !r.skipped) {
            console.warn('[VoiceController] Slack subagent-chat not posted:', r.error);
          }
        })
        .catch((err) => console.warn('[VoiceController] Slack subagent-chat skipped:', err.message));
    }

    // Best-effort persistence: a logging insert must never fail the request path.
    // If Postgres isn't up (Phase 2 dev runs without it), we log and continue.
    try {
      await db.query(
        `INSERT INTO voice_commands
         (user_id, transcript, intent, agent_routed_to, execution_time_ms, success, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
        [userId, transcript, intent, agentsInvoked.join(','), result.executionTime || 0, result.success]
      );
    } catch (dbErr) {
      console.warn('[VoiceController] voice_commands persistence skipped:', dbErr.message);
    }

    res.json({
      success: result.success,
      transcript,
      intent,
      response: responseText,
      agents_invoked: agentsInvoked,
      execution_time_ms: result.executionTime || 0,
      conversationId: call.conversationId,
    });
  } catch (error) {
    console.error('[VoiceController] Error:', error);
    res.status(500).json({
      error: 'Failed to process voice command',
      message: error.message
    });
  }
};

/**
 * Get voice command history (DB-backed; falls back to in-memory store).
 */
export const getCommandHistory = async (req, res, db) => {
  try {
    const { userId } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    const result = await db.query(
      `SELECT * FROM voice_commands
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      commands: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    // DB not available — serve recent in-memory calls so the endpoint still works.
    console.warn('[VoiceController] history DB unavailable, serving in-memory:', error.message);
    const calls = getCalls(parseInt(req.query.limit) || 50);
    res.json({ commands: calls, count: calls.length, source: 'memory' });
  }
};

/**
 * GET /api/voice/conversations?limit=20
 * Recent calls in the frontend VoiceCall shape.
 */
export const getConversations = (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  res.json({ conversations: getCalls(limit) });
};

/**
 * GET /api/voice/metrics
 * Aggregate metrics in the frontend VoiceMetrics shape.
 */
export const getVoiceMetrics = (req, res) => {
  res.json(getMetrics());
};

/**
 * GET /api/voice/agent/status
 * Whether the voice agent + providers are configured, and the registered agents.
 */
export const getAgentStatus = async (req, res, motherCode) => {
  let agents = {};
  try {
    agents = await motherCode.getAgentsStatus();
  } catch {
    agents = {};
  }
  const domains = Object.keys(motherCode.agents || {});
  res.json({
    configured: domains.length > 0,
    agentCount: domains.length,
    domains,
    agents,
    providers: {
      stt: sttConfigured() ? 'deepgram' : sttFallbackConfigured() ? 'openai' : 'browser-speech',
      tts: ttsConfigured() ? 'elevenlabs' : ttsFallbackConfigured() ? 'openai' : 'browser-speech',
      sttFallback: sttFallbackConfigured() ? 'openai' : null,
      ttsFallback: ttsFallbackConfigured() ? 'openai' : null,
    },
    google: {
      configured: googleConfigured(),
      authorized: isAuthorized(),
    },
    // Top-level sibling keys (parallel to `google`), not inside `providers`.
    slack: { configured: slackConfigured() },
    social: { configured: bufferConfigured() },
  });
};

/**
 * POST /api/voice/tts   { text }  -> audio/mpeg (ElevenLabs), or 501 if unconfigured.
 */
export const ttsHandler = async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Missing field: text' });
    // Provider fallback: ElevenLabs → OpenAI TTS (X-Voice-Provider names the winner).
    const { audio, contentType, voiceId, fellBack, provider } = await synthesizeWithFallback(text);
    res.set('Content-Type', contentType);
    res.set('X-Voice-Id', voiceId || '');
    res.set('X-Voice-Provider', provider || '');
    res.set('X-Voice-Fell-Back', fellBack ? '1' : '0');
    res.send(audio);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'TTS failed' });
  }
};

/**
 * POST /api/voice/transcribe  (raw audio body) -> { transcript } (Deepgram), or 501.
 */
export const transcribeHandler = async (req, res) => {
  try {
    const audio = req.body; // express.raw() populates a Buffer
    if (!audio || !audio.length) return res.status(400).json({ error: 'Missing audio body' });
    // Provider fallback: Deepgram → OpenAI Whisper (result.provider names the winner).
    const result = await transcribeWithFallback(audio, req.get('Content-Type') || 'audio/webm');
    res.set('X-Voice-Provider', result.provider || '');
    res.json(result);
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message || 'STT failed' });
  }
};

/**
 * Simple intent parser
 * In production, use Claude API for better accuracy
 */
function parseIntent(transcript) {
  const lower = transcript.toLowerCase();

  // TikTok archive (tt_scraper) must win over generic "post a tiktok" social routing.
  if (/\barchive\b/.test(lower) || (/tiktok/.test(lower) && /\b(scrape|download|collect|grab|fetch)\b/.test(lower))) return 'archive_tiktok';
  if (/schedule|meeting|calendar/.test(lower)) return 'schedule_event';
  if (/read|urgent|email/.test(lower)) return 'read_emails';
  if (/post|tiktok|instagram/.test(lower)) return 'schedule_post';
  if (/earn|revenue|stripe/.test(lower)) return 'get_revenue';
  if (/trending|hashtag/.test(lower)) return 'check_trends';
  if (/analytics|metrics|engagement|performance|insight|\bviews\b|\blikes\b/.test(lower)) return 'get_analytics';
  if (/file|edit|save/.test(lower)) return 'manage_file';

  return 'unknown';
}

export default {
  processVoiceCommand,
  getCommandHistory,
  getConversations,
  getVoiceMetrics,
  getAgentStatus,
  ttsHandler,
  transcribeHandler,
};
