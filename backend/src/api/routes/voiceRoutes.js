// backend/src/api/routes/voiceRoutes.js
import { Router, raw } from 'express';
import db from '../../config/database.js';
import redis from '../../config/redis.js';
import MotherCodeAgent from '../../agents/MotherCodeAgent.js';
import { createDefaultAgents } from '../../agents/StubAgent.js';
import CalendarAgent from '../../agents/CalendarAgent.js';
import EmailAgent from '../../agents/EmailAgent.js';
import SocialAgent from '../../agents/SocialAgent.js';
import {
  processVoiceCommand,
  getCommandHistory,
  getConversations,
  getVoiceMetrics,
  getAgentStatus,
  ttsHandler,
  transcribeHandler,
} from '../controllers/voiceController.js';

const router = Router();

// Phase 2: MotherCode boots with a full set of stub agents so the voice loop is
// end-to-end observable. Replace any stub by registering a real BaseAgent under
// the same domain key (e.g. motherCode.registerAgent('calendar', new CalendarAgent(...))).
const motherCode = new MotherCodeAgent(redis, createDefaultAgents(redis));

// Go-live: replace the calendar/email stubs with real Google-backed agents.
// They self-degrade to a "connect your Google account" message until OAuth
// tokens exist (see googleAuth.js), so the dashboard stays live keyless and
// activates the real path the instant the user completes /auth/google.
motherCode.registerAgent('calendar', new CalendarAgent(redis));
motherCode.registerAgent('email', new EmailAgent(redis));
// Social goes live the same way: Buffer-backed, self-degrades to a "connect
// Buffer" message until BUFFER_API_KEY is set. MUST register under 'social_media'
// (the key routeIntent emits) to override the social_media stub.
motherCode.registerAgent('social_media', new SocialAgent(redis));

// POST /api/voice/command  { userId, transcript, durationSec? }
router.post('/command', (req, res) => processVoiceCommand(req, res, db, motherCode));

// GET /api/voice/history?userId=1&limit=50
router.get('/history', (req, res) => getCommandHistory(req, res, db));

// --- Dashboard contract (consumed by src/components/VoiceCallLog.tsx + OrchestrationDashboard) ---

// GET /api/voice/conversations?limit=20  -> { conversations: VoiceCall[] }
router.get('/conversations', getConversations);

// GET /api/voice/metrics  -> VoiceMetrics
router.get('/metrics', getVoiceMetrics);

// GET /api/voice/agent/status  -> { configured, domains, providers, ... }
router.get('/agent/status', (req, res) => getAgentStatus(req, res, motherCode));

// --- Premium voice providers (gated on API keys; 501 until configured) ---

// POST /api/voice/tts  { text }  -> audio/mpeg (ElevenLabs)
router.post('/tts', ttsHandler);

// POST /api/voice/transcribe  (raw audio) -> { transcript } (Deepgram)
router.post('/transcribe', raw({ type: ['audio/*', 'application/octet-stream'], limit: '25mb' }), transcribeHandler);

export default router;
