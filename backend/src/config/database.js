// backend/src/config/database.js
// PostgreSQL connection pool. Configured from .env (see backend/.env.example).
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'lefty_user',
  password: process.env.DB_PASSWORD || 'lefty_password',
  database: process.env.DB_NAME || 'lucky_lefty',
});

pool.on('error', (err) => {
  console.error('[db] Unexpected PostgreSQL pool error:', err.message);
});

export default pool;
