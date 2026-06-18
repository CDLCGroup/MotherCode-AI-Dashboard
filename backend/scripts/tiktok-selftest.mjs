// Offline self-test for the TikTok archive subagent (TikTokAgent → tt_scraper).
// Mirrors scripts/social-selftest.mjs. Proves everything that does NOT spawn the
// real pipeline or touch the network:
//   - tiktokConfigured() gates on the runner + F:\ dir existing
//   - TikTokAgent degrades to needsAuth when the pipeline isn't reachable
//   - keyword extraction ("...about X") and limit parsing/clamping
//   - MotherCode.routeIntent sends archive intents to 'tiktok' (not 'social_media')
// The live scrape (Playwright + Google) is out of scope here — run the pipeline
// directly via tt_scraper_runner.ps1 to exercise that.
// Run: node scripts/tiktok-selftest.mjs

import assert from 'node:assert';

// Point the gate at a path that cannot exist so tiktokConfigured() is false,
// regardless of whether this host actually has F:\tiktok_archiver.
process.env.TT_SCRAPER_RUNNER = 'Z:\\__nope__\\tt_scraper_runner.ps1';
process.env.TT_SCRAPER_DIR = 'Z:\\__nope__\\tiktok_archiver';

const { tiktokConfigured } = await import('../src/integrations/tiktokClient.js');
const { default: TikTokAgent } = await import('../src/agents/TikTokAgent.js');
const { default: MotherCodeAgent } = await import('../src/agents/MotherCodeAgent.js');

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

console.log('\n=== 1. keyless gating ===');
check('tiktokConfigured() false when runner/dir absent', () => assert.equal(tiktokConfigured(), false));

console.log('\n=== 2. needsAuth fallback (pipeline not reachable) ===');
const tt = new TikTokAgent(null);
const auth = await tt.execute({ transcript: 'archive 5 tiktok videos about cape town nightlife' });
check('TikTokAgent returns needsAuth', () => {
  assert.equal(auth.needsAuth, true);
  assert.equal(auth.domain, 'tiktok');
  assert.ok(/tt_scraper|pipeline/i.test(auth.message));
});

console.log('\n=== 3. keyword + limit parsing ===');
check('extracts "cape town nightlife" from an "...about X" command', () =>
  assert.equal(tt.extractKeyword('archive 5 tiktok videos about cape town nightlife'), 'cape town nightlife'));
check('strips verb + filler when no "about" clause', () =>
  assert.equal(tt.extractKeyword('scrape hatfield nightlife tiktoks'), 'hatfield nightlife'));
check('parses limit "5" -> 5', () => assert.equal(tt.extractLimit('archive 5 videos about x'), 5));
check('default limit -> 10', () => assert.equal(tt.extractLimit('archive videos about x'), 10));
check('clamps an absurd limit to 50', () => assert.equal(tt.extractLimit('archive 9999 videos about x'), 50));

console.log('\n=== 4. routing: archive → tiktok (and NOT social_media) ===');
const mc = new MotherCodeAgent(null, {});
const d1 = mc.routeIntent('archive_tiktok');
check('archive intent routes to tiktok', () => assert.ok(d1.includes('tiktok')));
check('archive intent does NOT also route to social_media', () => assert.ok(!d1.includes('social_media')));

console.log(`\n=== ${pass} checks passed${process.exitCode ? ', SOME FAILED' : ', ALL PASS'} ===`);
