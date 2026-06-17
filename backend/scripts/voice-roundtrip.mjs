// Live round-trip validation of the voice providers (Task 4 voice hardening).
// ElevenLabs TTS synthesizes a phrase -> the real MP3 is fed to Deepgram STT ->
// we confirm the transcript matches. Exercises both real keys with real audio.
// Run: node scripts/voice-roundtrip.mjs
import 'dotenv/config';
import { performance } from 'node:perf_hooks';
import { synthesize, ttsConfigured } from '../src/voice/tts.js';
import { transcribe, sttConfigured } from '../src/voice/stt.js';

const PHRASE = process.argv[2] || 'open spotify and play my focus playlist';

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

(async () => {
  console.log('=== config ===');
  console.log('TTS configured (ElevenLabs):', ttsConfigured());
  console.log('STT configured (Deepgram) :', sttConfigured());
  if (!ttsConfigured() || !sttConfigured()) {
    console.error('Cannot run round-trip: a provider key is missing.');
    process.exit(2);
  }

  console.log('\n=== TTS leg (ElevenLabs) ===');
  const t0 = performance.now();
  const { audio, contentType, voiceId, fellBack } = await synthesize(PHRASE);
  const ttsMs = Math.round(performance.now() - t0);
  console.log(`spoken phrase : "${PHRASE}"`);
  console.log(`audio bytes   : ${audio.length}`);
  console.log(`content-type  : ${contentType}`);
  console.log(`voice         : ${voiceId}${fellBack ? ' (fell back to free voice)' : ''}`);
  console.log(`latency       : ${ttsMs} ms`);

  console.log('\n=== STT leg (Deepgram) ===');
  const t1 = performance.now();
  const { transcript, confidence } = await transcribe(audio, 'audio/mpeg');
  const sttMs = Math.round(performance.now() - t1);
  console.log(`transcript    : "${transcript}"`);
  console.log(`confidence    : ${confidence}`);
  console.log(`latency       : ${sttMs} ms`);

  console.log('\n=== verdict ===');
  const a = norm(PHRASE), b = norm(transcript);
  const match = a === b;
  const aWords = new Set(a.split(' '));
  const overlap = b.split(' ').filter((w) => aWords.has(w)).length;
  const ratio = a.split(' ').length ? overlap / a.split(' ').length : 0;
  console.log(`exact match   : ${match}`);
  console.log(`word overlap  : ${overlap}/${a.split(' ').length} (${Math.round(ratio * 100)}%)`);
  console.log(`round-trip    : ${ttsMs + sttMs} ms`);
  const pass = match || ratio >= 0.7;
  console.log(`RESULT        : ${pass ? 'PASS' : 'FAIL'}`);
  process.exit(pass ? 0 : 1);
})().catch((e) => {
  console.error('\n=== ERROR ===');
  console.error(e?.message || e);
  if (e?.status) console.error('status:', e.status);
  process.exit(3);
});
