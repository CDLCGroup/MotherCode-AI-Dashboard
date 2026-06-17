// backend/src/config/redis.js
// Redis client (ioredis). lazyConnect keeps app startup from blocking when
// Redis isn't up yet — Phase 1 only uses the cache opportunistically.
import Redis from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 2,
});

redis.on('error', (err) => {
  console.error('[redis] connection error:', err.message);
});

export default redis;
