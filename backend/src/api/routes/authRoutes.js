// backend/src/api/routes/authRoutes.js
//
// Google OAuth consent flow for the Calendar + Email agents. Mounted at
// /auth/google in index.js, served on the backend port (3001) — the redirect
// URI must match this exactly in both .env and the Google Cloud Console.

import { Router } from 'express';
import {
  googleConfigured,
  isAuthorized,
  generateAuthUrl,
  exchangeCode,
  SCOPES,
} from '../../integrations/googleAuth.js';

const router = Router();

// GET /auth/google → redirect to Google's consent screen.
router.get('/', (req, res) => {
  if (!googleConfigured()) {
    return res.status(501).send(
      'Google OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and ' +
        'GOOGLE_REDIRECT_URI to backend/.env (see SETUP-google.md), then restart and revisit this page.'
    );
  }
  res.redirect(generateAuthUrl());
});

// GET /auth/google/callback?code=... → exchange code for tokens, persist them.
router.get('/callback', async (req, res) => {
  const { code, error } = req.query;
  if (error) return res.status(400).send(`Google authorization failed: ${error}`);
  if (!code) return res.status(400).send('Missing authorization code.');
  try {
    await exchangeCode(code);
    res.send(
      '<h2>✅ Google account connected</h2>' +
        '<p>MotherCode can now manage your Calendar and Gmail. You can close this tab and return to the dashboard.</p>'
    );
  } catch (err) {
    console.error('[auth] token exchange failed:', err.message);
    res.status(err.status || 500).send(`Token exchange failed: ${err.message || err}`);
  }
});

// GET /auth/google/status → { configured, authorized, scopes }
router.get('/status', (req, res) => {
  res.json({
    configured: googleConfigured(),
    authorized: isAuthorized(),
    scopes: SCOPES,
  });
});

export default router;
