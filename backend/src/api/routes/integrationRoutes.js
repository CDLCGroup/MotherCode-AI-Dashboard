// backend/src/api/routes/integrationRoutes.js
import { Router } from 'express';
import db from '../../config/database.js';

const router = Router();

// GET /api/integrations?userId=1  — credentials are never returned.
router.get('/', async (req, res, next) => {
  try {
    const { userId } = req.query;
    const result = await db.query(
      `SELECT id, user_id, integration_type, status, last_sync_at, created_at, updated_at
       FROM integrations
       WHERE ($1::int IS NULL OR user_id = $1)
       ORDER BY integration_type`,
      [userId ? parseInt(userId, 10) : null]
    );
    res.json({ integrations: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
});

export default router;
