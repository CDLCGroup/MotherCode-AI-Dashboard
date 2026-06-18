// backend/src/api/routes/bufferRoutes.js
//
// Satisfies the frontend contract in src/services/buffer.ts (do NOT change that
// file — the backend matches it). Keyless-first: every endpoint short-circuits to
// the contract's empty/"not connected" shape when bufferConfigured() is false, so
// the dashboard degrades cleanly and goes live the instant BUFFER_API_KEY is set.
//
// Route order note: the literal /posts/scheduled (GET) and /posts/create (POST)
// are declared before the /posts/:postId param routes so they are never shadowed.

import { Router } from 'express';
import {
  bufferConfigured,
  listProfiles,
  listScheduled,
  createPost,
  publishPost,
  deletePost,
} from '../../integrations/bufferClient.js';

const router = Router();
const NOT_CONNECTED = 'Buffer not connected (set BUFFER_API_KEY)';

// GET /api/buffer/queue  -> { count }
router.get('/queue', async (req, res) => {
  if (!bufferConfigured()) return res.json({ count: 0 });
  try {
    const posts = await listScheduled();
    res.json({ count: posts.length });
  } catch (err) {
    res.json({ count: 0, error: err.message });
  }
});

// GET /api/buffer/posts/scheduled  -> { posts: BufferPost[] }
router.get('/posts/scheduled', async (req, res) => {
  if (!bufferConfigured()) return res.json({ posts: [] });
  try {
    res.json({ posts: await listScheduled() });
  } catch (err) {
    res.json({ posts: [], error: err.message });
  }
});

// POST /api/buffer/posts/create  { text, media?, scheduledAt, platforms[] }  -> { success, postId?, error? }
router.post('/posts/create', async (req, res) => {
  if (!bufferConfigured()) return res.json({ success: false, error: NOT_CONNECTED });
  const { text, media, scheduledAt, platforms } = req.body || {};
  if (!text) return res.status(400).json({ success: false, error: 'Missing field: text' });
  try {
    const { id } = await createPost({ text, media, scheduledAt, platforms });
    res.json({ success: true, postId: id });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// POST /api/buffer/posts/:postId/publish  -> { success, error? }
router.post('/posts/:postId/publish', async (req, res) => {
  if (!bufferConfigured()) return res.json({ success: false, error: NOT_CONNECTED });
  try {
    await publishPost(req.params.postId);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// DELETE /api/buffer/posts/:postId  -> { success, error? }
router.delete('/posts/:postId', async (req, res) => {
  if (!bufferConfigured()) return res.json({ success: false, error: NOT_CONNECTED });
  try {
    await deletePost(req.params.postId);
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, error: err.message });
  }
});

// GET /api/buffer/profiles  -> { profiles: BufferProfile[] }
router.get('/profiles', async (req, res) => {
  if (!bufferConfigured()) return res.json({ profiles: [] });
  try {
    res.json({ profiles: await listProfiles() });
  } catch (err) {
    res.json({ profiles: [], error: err.message });
  }
});

export default router;
