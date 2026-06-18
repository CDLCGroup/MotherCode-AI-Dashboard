// Offline self-test for the voice provider fallback (Item 6).
// Proves the network-free parts: configured-gating for the OpenAI backup legs,
// and that the *WithFallback wrappers throw a clean 501 when NO provider is
// configured. The live legs (Deepgram/ElevenLabs/OpenAI HTTP calls) need real
// keys + network and are out of scope here.
// Run: node scripts/voice-fallback-selftest.mjs

import assert from 'node:assert';

// Clean baseline: clear every speech key so the gates read "unconfigured".
for (const k of ['DEEPGRAM_API_KEY', 'ELEVENLABS_API_KEY', 'ELEVENLABS_VOICE_ID', 'OPENAI_API_KEY']) {
  delete process.env[k];
}

const tts = await import('../src/voice/tts.js');
const stt = await import('../src/voice/stt.js');

let pass = 0;
const check = (name, fn) => {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    pass++;
  } catch (e) {
    console.error(`  ✗ ${name}\n      ${e.message}`);
    process.exitCode = 1;
  }
};
const rejects = async (name, fn, status) => {
  try {
    await fn();
    console.error(`  ✗ ${name}\n      expected a throw, got a result`);
    process.exitCode = 1;
  } catch (e) {
    try {
      assert.equal(e.status, status);
      console.log(`  ✓ ${name}`);
      pass++;
    } catch (e2) {
      console.error(`  ✗ ${name}\n      ${e2.message} (threw status=${e.status})`);
      process.exitCode = 1;
    }
  }
};

console.log('\n=== 1. nothing configured ===');
check('ttsConfigured() false', () => assert.equal(tts.ttsConfigured(), false));
check('ttsFallbackConfigured() false', () => assert.equal(tts.ttsFallbackConfigured(), false));
check('sttConfigured() false', () => assert.equal(stt.sttConfigured(), false));
check('sttFallbackConfigured() false', () => assert.equal(stt.sttFallbackConfigured(), false));
await rejects('synthesizeWithFallback throws 501 (no provider)', () => tts.synthesizeWithFallback('hi'), 501);
await rejects('transcribeWithFallback throws 501 (no provider)', () => stt.transcribeWithFallback(Buffer.from([1, 2, 3])), 501);

console.log('\n=== 2. only the OpenAI backup configured ===');
process.env.OPENAI_API_KEY = 'sk-selftest-not-real-but-passes-realKey';
check('ttsFallbackConfigured() true with OPENAI_API_KEY', () => assert.equal(tts.ttsFallbackConfigured(), true));
check('sttFallbackConfigured() true with OPENAI_API_KEY', () => assert.equal(stt.sttFallbackConfigured(), true));
check('primary ttsConfigured() still false', () => assert.equal(tts.ttsConfigured(), false));
check('primary sttConfigured() still false', () => assert.equal(stt.sttConfigured(), false));

console.log('\n=== 3. placeholder OPENAI key reads as unconfigured (realKey) ===');
process.env.OPENAI_API_KEY = 'sk-...';
check('ttsFallbackConfigured() false for "sk-..." placeholder', () => assert.equal(tts.ttsFallbackConfigured(), false));
check('sttFallbackConfigured() false for "sk-..." placeholder', () => assert.equal(stt.sttFallbackConfigured(), false));

console.log(`\n=== ${pass} checks passed${process.exitCode ? ', SOME FAILED' : ', ALL PASS'} ===`);
