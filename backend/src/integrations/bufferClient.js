// backend/src/integrations/bufferClient.js
//
// Buffer client for the SocialAgent. Mirrors the keyless-first integration
// pattern (see googleAuth.js / voice/tts.js): bufferConfigured() gates on a real
// BUFFER_API_KEY, and the live calls throw { status, message } when not ready so
// callers fall back to a "connect Buffer" message instead of crashing.
//
// CAVEAT: Buffer's public API is gated behind their app-approval process. This
// wrapper is built and gated against the documented REST shape (api.bufferapp.com
// /1), but live posting only activates once a real, approved BUFFER_API_KEY is
// set. Until then bufferConfigured() is false and nothing here is called. See the
// Buffer section of SETUP-slack.md.

import { realKey } from '../voice/keys.js';

const BUFFER_API = process.env.BUFFER_API_BASE || 'https://api.bufferapp.com/1';

/** True when a real (non-placeholder) Buffer token is configured. */
export function bufferConfigured() {
  return realKey(process.env.BUFFER_API_KEY);
}

async function bufferFetch(path, { method = 'GET', body } = {}) {
  if (!bufferConfigured()) {
    throw { status: 501, message: 'Buffer not configured (set BUFFER_API_KEY)' };
  }
  const res = await fetch(`${BUFFER_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.BUFFER_API_KEY}`,
      ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.success === false) {
    throw { status: res.status, message: data.message || `Buffer API error (HTTP ${res.status})` };
  }
  return data;
}

// Buffer "service" (twitter/instagram/…) → our canonical platform names, which
// match the frontend BufferPost.platform union in src/services/buffer.ts.
function toPlatform(service) {
  const s = (service || '').toLowerCase();
  if (s.includes('instagram')) return 'instagram';
  if (s.includes('twitter') || s === 'x') return 'twitter';
  if (s.includes('facebook')) return 'facebook';
  if (s.includes('linkedin')) return 'linkedin';
  if (s.includes('tiktok')) return 'tiktok';
  return s || 'unknown';
}

/** Normalized profiles → [{ id, name, platform }] (matches BufferProfile). */
export async function listProfiles() {
  const data = await bufferFetch('/profiles.json');
  const arr = Array.isArray(data) ? data : data.profiles || [];
  return arr.map((p) => ({
    id: p.id || p._id,
    name: p.formatted_username || p.service_username || p.formatted_service || p.service || 'profile',
    platform: toPlatform(p.service),
  }));
}

function normalizeUpdate(u, platform) {
  return {
    id: u.id,
    text: u.text || '',
    // Buffer scheduled_at is a unix epoch (seconds).
    scheduledAt: u.scheduled_at ? new Date(u.scheduled_at * 1000).toISOString() : '',
    status: u.status === 'sent' ? 'sent' : 'scheduled',
    platform: platform || toPlatform(u.profile_service),
  };
}

/** Normalized pending/scheduled posts across all profiles → BufferPost[]. */
export async function listScheduled() {
  const profiles = await listProfiles();
  const lists = await Promise.all(
    profiles.map((p) =>
      bufferFetch(`/profiles/${p.id}/updates/pending.json`)
        .then((d) => (d.updates || []).map((u) => normalizeUpdate(u, p.platform)))
        .catch(() => [])
    )
  );
  return lists.flat();
}

/** Resolve canonical platform names → Buffer profile_ids (all when unspecified). */
async function resolveProfileIds(platforms) {
  const profiles = await listProfiles();
  if (!platforms || !platforms.length) return profiles.map((p) => p.id);
  const want = new Set(platforms.map((p) => String(p).toLowerCase()));
  const ids = profiles.filter((p) => want.has(p.platform)).map((p) => p.id);
  return ids.length ? ids : profiles.map((p) => p.id);
}

/**
 * Create a scheduled (or immediate, when now=true) update. Returns { id }.
 * @param {{text:string, media?:string[], scheduledAt?:string, platforms?:string[], now?:boolean}} input
 */
export async function createPost({ text, media, scheduledAt, platforms, now = false } = {}) {
  const profileIds = await resolveProfileIds(platforms);
  const params = new URLSearchParams();
  profileIds.forEach((id) => params.append('profile_ids[]', id));
  params.append('text', text || '');
  if (now) params.append('now', 'true');
  else if (scheduledAt) params.append('scheduled_at', scheduledAt);
  if (media && media[0]) params.append('media[photo]', media[0]);

  const data = await bufferFetch('/updates/create.json', { method: 'POST', body: params.toString() });
  const created = (data.updates && data.updates[0]) || {};
  return { id: created.id || data.id };
}

/** Publish a buffered update immediately. */
export async function publishPost(postId) {
  await bufferFetch(`/updates/${postId}/share.json`, { method: 'POST' });
  return true;
}

/** Delete a buffered update. */
export async function deletePost(postId) {
  await bufferFetch(`/updates/${postId}/destroy.json`, { method: 'POST' });
  return true;
}

export default {
  bufferConfigured,
  listProfiles,
  listScheduled,
  createPost,
  publishPost,
  deletePost,
};
