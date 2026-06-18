// backend/src/integrations/googleAuth.js
//
// Shared Google OAuth2 layer for the Calendar + Email agents. Mirrors the
// project's keyless-first pattern (see src/voice/keys.js + tts.js): until real
// OAuth credentials are present and the user has completed consent, the agents
// degrade gracefully to a "connect your Google account" message. Drop real
// credentials in .env, hit /auth/google once, and the live path activates with
// no code change.
//
// Tokens are persisted to a single gitignored file (this is a single-user
// personal assistant). We deliberately DO NOT use redis: config/redis.js is
// lazyConnect/optional and may be down, but auth must survive a restart.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { google } from 'googleapis';
import { realKey } from '../voice/keys.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/.google-tokens.json (two levels up from src/integrations)
const TOKEN_PATH = path.join(__dirname, '..', '..', '.google-tokens.json');

// Scopes — get these right the first time; re-consent is a manual user action.
//   calendar.events  → create/list events
//   gmail.readonly   → read urgent/unread mail
//   gmail.compose    → create draft replies (never auto-send)
export const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.compose',
];

/**
 * True when real (non-placeholder) OAuth credentials are configured.
 * realKey() rejects '', 'your_*', and anything containing '...'.
 */
export function googleConfigured() {
  return (
    realKey(process.env.GOOGLE_CLIENT_ID) &&
    realKey(process.env.GOOGLE_CLIENT_SECRET) &&
    realKey(process.env.GOOGLE_REDIRECT_URI)
  );
}

export function loadTokens() {
  try {
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function saveTokens(tokens) {
  // Preserve an existing refresh_token: Google only returns it on the first
  // consent, so a later re-auth (which may omit it) must not wipe it.
  const existing = loadTokens() || {};
  const merged = { ...existing, ...tokens };
  if (!merged.refresh_token && existing.refresh_token) {
    merged.refresh_token = existing.refresh_token;
  }
  fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged, null, 2), 'utf8');
  return merged;
}

/** Configured AND consent completed (a token file exists). */
export function isAuthorized() {
  return googleConfigured() && loadTokens() !== null;
}

/** Build a bare OAuth2 client from env credentials. */
export function oauthClient() {
  if (!googleConfigured()) {
    throw { status: 501, message: 'Google OAuth not configured (set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI)' };
  }
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/**
 * Consent URL. access_type:'offline' + prompt:'consent' forces Google to return
 * a refresh_token so the assistant keeps working after the access token expires.
 */
export function generateAuthUrl() {
  return oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

/** Exchange the ?code from the OAuth callback for tokens and persist them. */
export async function exchangeCode(code) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  return saveTokens(tokens);
}

/**
 * An OAuth2 client primed with stored tokens, ready for API calls. googleapis
 * auto-refreshes the access token from the refresh_token; we persist the
 * refreshed token via the 'tokens' event so it survives the next restart.
 * Throws { status, message } when not yet authorized — callers fall back to the
 * needsAuth message.
 */
export function getAuthedClient() {
  if (!isAuthorized()) {
    throw { status: 401, message: 'Google account not connected. Visit /auth/google to authorize.' };
  }
  const client = oauthClient();
  client.setCredentials(loadTokens());
  client.on('tokens', (tokens) => {
    try {
      saveTokens(tokens);
    } catch (e) {
      console.warn('[googleAuth] failed to persist refreshed tokens:', e.message);
    }
  });
  return client;
}

export default {
  SCOPES,
  googleConfigured,
  isAuthorized,
  loadTokens,
  saveTokens,
  oauthClient,
  generateAuthUrl,
  exchangeCode,
  getAuthedClient,
};
