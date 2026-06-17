// backend/src/api/routes/voiceRoutes.js
import { Router } from 'express';
import db from '../../config/database.js';
import redis from '../../config/redis.js';
import MotherCodeAgent from '../../agents/MotherCodeAgent.js';
import { processVoiceCommand, getCommandHistory } from '../controllers/voiceController.js';

const router = Router();

// Phase 1: MotherCode starts with no specialized agents registered.
// Calendar / Email / Social agents get registered in Phase 2 (see docs/IMPLEMENTATION_PLAN.md).
const motherCode = new MotherCodeAgent(redis);

// POST /api/voice/command  { userId, transcript }
router.post('/command', (req, res) => processVoiceCommand(req, res, db, motherCode));

// GET /api/voice/history?userId=1&limit=50
router.get('/history', (req, res) => getCommandHistory(req, res, db));

export default router;
