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

export default { sttConfigured, transcribe };
