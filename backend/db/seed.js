// backend/db/seed.js
// Inserts a default development user. The Electron app sends userId: 1 for now
// (see frontend/main.js voice:send-command handler), so this seeds that row.
import db from '../src/config/database.js';

async function seed() {
  try {
    await db.query(
      `INSERT INTO users (email, username, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO NOTHING`,
      ['dev@luckylefty.local', 'dev', 'admin']
    );
    console.log('[seed] Default development user ensured.');
  } catch (err) {
    console.error('[seed] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

seed();
