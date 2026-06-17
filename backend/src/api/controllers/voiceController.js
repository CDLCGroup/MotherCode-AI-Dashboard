// backend/src/api/controllers/voiceController.js

import { recordCall, buildCall, getCalls, getMetrics } from '../../state/voiceStore.js';
import { broadcast } from '../../realtime/wsHub.js';
import { ttsConfigured, synthesize } from '../../voice/tts.js';
import { sttConfigured, transcribe } from '../../voice/stt.js';

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
      stt: sttConfigured() ? 'deepgram' : 'browser-speech',
      tts: ttsConfigured() ? 'elevenlabs' : 'browser-speech',
    },
  });
};

/**
 * POST /api/voice/tts   { text }  -> audio/mpeg (ElevenLabs), or 501 if unconfigured.
 */
export const ttsHandler = async (req, res) => {
  try {
    const { text } = req.body || {};
    if (!text) return res.status(400).json({ error: 'Missing field: text' });
    const { audio, contentType } = await synthesize(text);
    res.set('Content-Type', contentType);
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
    const result = await transcribe(audio, req.get('Content-Type') || 'audio/webm');
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

  if (/schedule|meeting|calendar/.test(lower)) return 'schedule_event';
  if (/read|urgent|email/.test(lower)) return 'read_emails';
  if (/post|tiktok|instagram/.test(lower)) return 'schedule_post';
  if (/earn|revenue|stripe/.test(lower)) return 'get_revenue';
  if (/trending|hashtag/.test(lower)) return 'check_trends';
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
