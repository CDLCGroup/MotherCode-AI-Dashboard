// backend/src/api/routes/taskRoutes.js
import { Router } from 'express';
import db from '../../config/database.js';

const router = Router();

// GET /api/tasks?userId=1
router.get('/', async (req, res, next) => {
  try {
    const { userId } = req.query;
    const result = await db.query(
      `SELECT * FROM tasks
       WHERE ($1::int IS NULL OR user_id = $1) AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [userId ? parseInt(userId, 10) : null]
    );
    res.json({ tasks: result.rows, count: result.rowCount });
  } catch (err) {
    next(err);
  }
});

// POST /api/tasks  { userId, title, description?, agentResponsible?, dueDate?, createdByVoice? }
router.post('/', async (req, res, next) => {
  try {
    const { userId, title, description, agentResponsible, dueDate, createdByVoice } = req.body;
    if (!userId || !title) {
      return res.status(400).json({ error: 'Missing required fields: userId, title' });
    }
    const result = await db.query(
      `INSERT INTO tasks (user_id, title, description, agent_responsible, due_date, created_by_voice)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, title, description || null, agentResponsible || null, dueDate || null, !!createdByVoice]
    );
    res.status(201).json({ task: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

export default router;
