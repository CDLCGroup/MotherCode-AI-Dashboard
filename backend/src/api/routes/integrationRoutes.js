// backend/src/api/routes/integrationRoutes.js
import { Router } from 'express';
import db from '../../config/database.js';

const router = Router();

// GET /api/integrations?userId=1  — credentials are never returned.
// Non-fatal: without a database (keyless dev) this returns an empty list tagged
// `source: 'memory'` rather than 500-ing, so the Settings view degrades cleanly.
router.get('/', async (req, res) => {
  const { userId } = req.query;
  try {
    const result = await db.query(
      `SELECT id, user_id, integration_type, status, last_sync_at, created_at, updated_at
       FROM integrations
       WHERE ($1::int IS NULL OR user_id = $1)
       ORDER BY integration_type`,
      [userId ? parseInt(userId, 10) : null]
    );
    res.json({ integrations: result.rows, count: result.rowCount });
  } catch (err) {
    console.warn('[integrations] DB unavailable, serving empty:', err.message);
    res.json({ integrations: [], count: 0, source: 'memory' });
  }
});

export default router;
