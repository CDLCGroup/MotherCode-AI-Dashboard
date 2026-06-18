// backend/src/api/routes/slackRoutes.js
//
// Satisfies the frontend contract in src/services/slack.ts (do NOT change that
// file — the backend matches it). Two endpoints back all of slack.ts's helpers:
// sendMessage → POST /message, getWorkspaceStatus → GET /status (the other
// helpers — sendNotification/sendStatusUpdate/sendPostAlert — compose sendMessage
// client-side, so no extra routes are needed).

import { Router } from 'express';
import { postMessage, getStatus } from '../../integrations/slackClient.js';

const router = Router();

// POST /api/slack/message  { channel, text?, blocks? }  -> { success, messageId?, error? }
router.post('/message', async (req, res) => {
  const { channel, text, blocks } = req.body || {};
  if (!channel) {
    return res.status(400).json({ success: false, error: 'Missing field: channel' });
  }
  const r = await postMessage({ channel, text, blocks });
  if (r.skipped) {
    return res.json({ success: false, error: 'Slack not connected (set SLACK_BOT_TOKEN)' });
  }
  // Map Slack's message `ts` → the `messageId` the frontend expects.
  res.json({ success: r.success, messageId: r.ts, error: r.error });
});

// GET /api/slack/status  -> { connected, channelCount?, error? }
router.get('/status', async (req, res) => {
  res.json(await getStatus());
});

export default router;
