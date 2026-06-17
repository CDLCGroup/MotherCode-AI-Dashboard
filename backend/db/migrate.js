// backend/db/migrate.js
// Applies db/schema.sql to the configured PostgreSQL database.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import db from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');
  console.log(`[migrate] Applying schema from ${schemaPath} ...`);
  try {
    await db.query(sql);
    console.log('[migrate] Schema applied successfully.');
  } catch (err) {
    console.error('[migrate] Failed:', err.message);
    process.exitCode = 1;
  } finally {
    await db.end();
  }
}

migrate();
