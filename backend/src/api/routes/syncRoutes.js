// backend/src/api/routes/syncRoutes.js
//
// Satisfies src/services/buffer.ts → syncFromGoogleSheets() (POST
// /api/sync/google-sheets). DOCUMENTED STUB: the content pipeline (Google Sheet
// → Buffer queue) is a later phase. The tiktok_archiver writes rows to Sheets
// today; wiring that sheet into the Buffer queue here is deferred. We return the
// frontend's expected { success, count?, error? } shape so the call degrades
// cleanly instead of throwing.
//
// NOTE: a separate frontend service (src/services/googleSheets.ts) talks to a
// different namespace (/api/sheets/*) that is intentionally NOT implemented here.

import { Router } from 'express';

const router = Router();

// POST /api/sync/google-sheets  { sheetId }  -> { success, count?, error? }
router.post('/google-sheets', (req, res) => {
  res.json({ success: false, error: 'Google Sheets sync is not implemented yet (deferred phase).' });
});

export default router;
