// backend/src/voice/keys.js
// Treat `.env.example`-style placeholders ("...", "sk_...", "sk-ant-...", "your_...")
// as "not configured" so the app cleanly falls back to browser speech instead of
// firing real API calls with junk keys.
export function realKey(value) {
  if (!value) return false;
  const v = String(value).trim();
  if (v === '') return false;
  if (v.includes('...')) return false;
  if (/^your_/i.test(v)) return false;
  return true;
}

export default { realKey };
