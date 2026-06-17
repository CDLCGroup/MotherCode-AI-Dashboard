// backend/src/voice/tts.js
//
// Text-to-speech via ElevenLabs. Real implementation, gated on ELEVENLABS_API_KEY.
// Until a key is present the frontend falls back to the browser's speechSynthesis,
// so this is the "premium voice" upgrade path: drop the key in .env and it activates.

import { realKey } from './keys.js';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

export function ttsConfigured() {
  return realKey(process.env.ELEVENLABS_API_KEY) && realKey(process.env.ELEVENLABS_VOICE_ID);
}

/**
 * Synthesize speech. Returns { audio: Buffer, contentType }.
 * Throws { status, message } if not configured or the upstream call fails.
 */
export async function synthesize(text) {
  if (!ttsConfigured()) {
    throw { status: 501, message: 'ElevenLabs TTS not configured (set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID)' };
  }
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'dOqxOZEisn8SiUH1dPCC';
  const res = await fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': process.env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.4, similarity_boost: 0.75 },
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw { status: res.status, message: `ElevenLabs error: ${detail.slice(0, 300)}` };
  }

  const arrayBuf = await res.arrayBuffer();
  return { audio: Buffer.from(arrayBuf), contentType: 'audio/mpeg' };
}

export default { ttsConfigured, synthesize };
