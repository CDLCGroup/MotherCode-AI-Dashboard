// backend/src/api/controllers/voiceController.js

/**
 * Handle voice command processing
 */

export const processVoiceCommand = async (req, res, db, motherCode) => {
  try {
    const { userId, transcript, audio } = req.body;

    if (!userId || !transcript) {
      return res.status(400).json({
        error: 'Missing required fields: userId, transcript'
      });
    }

    console.log(`[VoiceController] Processing command from user ${userId}:`, transcript);

    // Parse intent from transcript (could use Claude API for better accuracy)
    const intent = parseIntent(transcript);

    // Route to MotherCode for orchestration
    const command = {
      userId,
      transcript,
      intent,
      timestamp: new Date().toISOString()
    };

    const result = await motherCode.process(command);

    // Log to database
    await db.query(
      `INSERT INTO voice_commands
       (user_id, transcript, intent, success, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, transcript, intent, result.success]
    );

    res.json({
      success: result.success,
      transcript,
      intent,
      response: result.response,
      agents_invoked: result.agents_invoked || [],
      execution_time_ms: result.executionTime || 0
    });
  } catch (error) {
    console.error('[VoiceController] Error:', error);
    res.status(500).json({
      error: 'Failed to process voice command',
      message: error.message
    });
  }
};

/**
 * Get voice command history
 */
export const getCommandHistory = async (req, res, db) => {
  try {
    const { userId } = req.query;
    const limit = parseInt(req.query.limit) || 50;

    const result = await db.query(
      `SELECT * FROM voice_commands
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );

    res.json({
      commands: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('[VoiceController] History error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Simple intent parser
 * In production, use Claude API for better accuracy
 */
function parseIntent(transcript) {
  const lower = transcript.toLowerCase();

  if (/schedule|meeting|calendar/.test(lower)) return 'schedule_event';
  if (/read|urgent|email/.test(lower)) return 'read_emails';
  if (/post|tiktok|instagram/.test(lower)) return 'schedule_post';
  if (/earn|revenue|stripe/.test(lower)) return 'get_revenue';
  if (/trending|hashtag/.test(lower)) return 'check_trends';
  if (/file|edit|save/.test(lower)) return 'manage_file';

  return 'unknown';
}

export default {
  processVoiceCommand,
  getCommandHistory
};
