// backend/src/voice/tts.js
//
// Text-to-speech via ElevenLabs. Real implementation, gated on ELEVENLABS_API_KEY.
// Until a key is present the frontend falls back to the browser's speechSynthesis,
// so this is the "premium voice" upgrade path: drop the key in .env and it activates.

import { realKey } from './keys.js';

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// Free-tier-safe premade voice used when the configured voice requires a paid
// plan (ElevenLabs 402 paid_plan_required for [professional]/library voices).
// "Eric - Smooth, Trustworthy" — close to a confident, warm assistant.
const FALLBACK_VOICE_ID = 'cjVigY5qzO86Huf0OWal';

export function ttsConfigured() {
  return realKey(process.env.ELEVENLABS_API_KEY) && realKey(process.env.ELEVENLABS_VOICE_ID);
}

// Secondary/backup TTS provider: OpenAI audio/speech. Activates when ElevenLabs
// is unconfigured or fails (incl. after its own free-voice 402 fallback). Needs
// only OPENAI_API_KEY — no Docker. (The LibreChat stack is the heavier alt.)
const OPENAI_TTS_URL = 'https://api.openai.com/v1/audio/speech';

export function ttsFallbackConfigured() {
  return realKey(process.env.OPENAI_API_KEY);
}

/** Synthesize via OpenAI TTS. Returns { audio:Buffer, contentType, voiceId, provider:'openai', fellBack:false }. */
export async function synthesizeOpenAI(text) {
  if (!ttsFallbackConfigured()) {
    throw { status: 501, message: 'OpenAI TTS fallback not configured (set OPENAI_API_KEY)' };
  }
  const voice = process.env.OPENAI_TTS_VOICE || 'alloy';
  const res = await fetch(OPENAI_TTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: process.env.OPENAI_TTS_MODEL || 'tts-1', voice, input: text }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw { status: res.status, message: `OpenAI TTS error: ${detail.slice(0, 300)}` };
  }
  const arrayBuf = await res.arrayBuffer();
  return { audio: Buffer.from(arrayBuf), contentType: 'audio/mpeg', voiceId: voice, provider: 'openai', fellBack: false };
}

/**
 * Synthesize with provider fallback: ElevenLabs first, then OpenAI TTS.
 * Returns { audio, contentType, voiceId, provider, fellBack }. Throws
 * { status, message } only when no provider is configured or all fail.
 */
export async function synthesizeWithFallback(text) {
  if (ttsConfigured()) {
    try {
      const r = await synthesize(text);
      return { ...r, provider: 'elevenlabs' };
    } catch (err) {
      if (!ttsFallbackConfigured()) throw err;
      console.warn(`[tts] ElevenLabs failed (${err.status || '?'}); falling back to OpenAI TTS:`, err.message);
    }
  }
  if (ttsFallbackConfigured()) return synthesizeOpenAI(text);
  throw { status: 501, message: 'No TTS provider configured (set ELEVENLABS_API_KEY or OPENAI_API_KEY)' };
}

// Voices known (this process) to require a paid plan. After the first 402 we
// skip straight to the free fallback instead of re-paying the wasted round-trip
// on every utterance (~440ms saved per spoken response). Cleared on restart, so
// upgrading your ElevenLabs plan + restarting restores the configured voice.
const paidOnlyVoices = new Set();

async function callElevenLabs(voiceId, text) {
  return fetch(`${ELEVENLABS_BASE}/text-to-speech/${voiceId}`, {
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
}

/**
 * Synthesize speech. Returns { audio: Buffer, contentType, voiceId, fellBack }.
 * Throws { status, message } if not configured or the upstream call fails.
 *
 * If the configured voice is paid-plan-only (402), retry once with a free
 * premade voice so TTS still works on a free key — and flag that it fell back.
 */
export async function synthesize(text) {
  if (!ttsConfigured()) {
    throw { status: 501, message: 'ElevenLabs TTS not configured (set ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID)' };
  }

  const configuredVoice = process.env.ELEVENLABS_VOICE_ID;
  const fallbackVoice = process.env.ELEVENLABS_FALLBACK_VOICE_ID || FALLBACK_VOICE_ID;
  const canFallBack = fallbackVoice && fallbackVoice !== configuredVoice;

  // If we already learned the configured voice is paid-only, go straight to the
  // free voice and skip the guaranteed-402 round-trip.
  if (canFallBack && paidOnlyVoices.has(configuredVoice)) {
    const res = await callElevenLabs(fallbackVoice, text);
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw { status: res.status, message: `ElevenLabs error: ${detail.slice(0, 300)}` };
    }
    const arrayBuf = await res.arrayBuffer();
    return { audio: Buffer.from(arrayBuf), contentType: 'audio/mpeg', voiceId: fallbackVoice, fellBack: true };
  }

  let res = await callElevenLabs(configuredVoice, text);
  let fellBack = false;
  let usedVoice = configuredVoice;

  // Configured voice needs a paid plan → retry once with a free premade voice.
  if (res.status === 402 && canFallBack) {
    paidOnlyVoices.add(configuredVoice);
    console.warn(
      `[tts] voice ${configuredVoice} requires a paid ElevenLabs plan (402); falling back to ${fallbackVoice}. ` +
        `Caching this for the process; upgrade your plan or set ELEVENLABS_VOICE_ID to a [premade] voice to silence this.`
    );
    res = await callElevenLabs(fallbackVoice, text);
    fellBack = true;
    usedVoice = fallbackVoice;
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw { status: res.status, message: `ElevenLabs error: ${detail.slice(0, 300)}` };
  }

  const arrayBuf = await res.arrayBuffer();
  return { audio: Buffer.from(arrayBuf), contentType: 'audio/mpeg', voiceId: usedVoice, fellBack };
}

export default {
  ttsConfigured,
  synthesize,
  ttsFallbackConfigured,
  synthesizeOpenAI,
  synthesizeWithFallback,
};
