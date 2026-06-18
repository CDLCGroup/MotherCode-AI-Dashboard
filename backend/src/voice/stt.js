// backend/src/voice/stt.js
//
// Speech-to-text via Deepgram (prerecorded endpoint). Real implementation, gated
// on DEEPGRAM_API_KEY. The default frontend uses the browser SpeechRecognition
// API for STT (no key); this server path is the premium upgrade for clients that
// stream raw audio (e.g. MediaRecorder blobs) instead of in-browser transcripts.

import { realKey } from './keys.js';

const DEEPGRAM_URL = 'https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true';

export function sttConfigured() {
  return realKey(process.env.DEEPGRAM_API_KEY);
}

// Secondary/backup STT provider: OpenAI Whisper. Activates when Deepgram is
// unconfigured or errors, as long as OPENAI_API_KEY is set. (LibreChat speech is
// the heavier Docker-based alternative; this in-process leg needs no Docker.)
const OPENAI_STT_URL = 'https://api.openai.com/v1/audio/transcriptions';

export function sttFallbackConfigured() {
  return realKey(process.env.OPENAI_API_KEY);
}

function extForContentType(ct = '') {
  if (ct.includes('webm')) return 'webm';
  if (ct.includes('ogg')) return 'ogg';
  if (ct.includes('wav')) return 'wav';
  if (ct.includes('mp3') || ct.includes('mpeg')) return 'mp3';
  if (ct.includes('mp4') || ct.includes('m4a')) return 'm4a';
  return 'webm';
}

/** Transcribe via OpenAI Whisper. Returns { transcript, confidence:null, provider:'openai' }. */
export async function transcribeOpenAI(audioBuffer, contentType = 'audio/webm') {
  if (!sttFallbackConfigured()) {
    throw { status: 501, message: 'OpenAI STT fallback not configured (set OPENAI_API_KEY)' };
  }
  const form = new FormData();
  const ext = extForContentType(contentType);
  form.append('file', new Blob([audioBuffer], { type: contentType }), `audio.${ext}`);
  form.append('model', process.env.OPENAI_STT_MODEL || 'whisper-1');
  form.append('response_format', 'json');

  const res = await fetch(OPENAI_STT_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw { status: res.status, message: `OpenAI STT error: ${detail.slice(0, 300)}` };
  }
  const json = await res.json();
  return { transcript: json.text || '', confidence: null, provider: 'openai' };
}

/**
 * Transcribe with provider fallback: Deepgram first, then OpenAI Whisper.
 * Returns { transcript, confidence, provider }. Throws { status, message } only
 * when no provider is configured or all configured providers fail.
 */
export async function transcribeWithFallback(audioBuffer, contentType = 'audio/webm') {
  if (sttConfigured()) {
    try {
      const r = await transcribe(audioBuffer, contentType);
      return { ...r, provider: 'deepgram' };
    } catch (err) {
      if (!sttFallbackConfigured()) throw err;
      console.warn(`[stt] Deepgram failed (${err.status || '?'}); falling back to OpenAI Whisper:`, err.message);
    }
  }
  if (sttFallbackConfigured()) return transcribeOpenAI(audioBuffer, contentType);
  throw { status: 501, message: 'No STT provider configured (set DEEPGRAM_API_KEY or OPENAI_API_KEY)' };
}

/**
 * Transcribe an audio buffer. Returns { transcript, confidence }.
 * Throws { status, message } if not configured or the upstream call fails.
 */
export async function transcribe(audioBuffer, contentType = 'audio/webm') {
  if (!sttConfigured()) {
    throw { status: 501, message: 'Deepgram STT not configured (set DEEPGRAM_API_KEY)' };
  }
  const res = await fetch(DEEPGRAM_URL, {
    method: 'POST',
    headers: {
      Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
      'Content-Type': contentType,
    },
    body: audioBuffer,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw { status: res.status, message: `Deepgram error: ${detail.slice(0, 300)}` };
  }

  const json = await res.json();
  const alt = json?.results?.channels?.[0]?.alternatives?.[0] || {};
  return { transcript: alt.transcript || '', confidence: alt.confidence ?? null };
}

export default {
  sttConfigured,
  transcribe,
  sttFallbackConfigured,
  transcribeOpenAI,
  transcribeWithFallback,
};
