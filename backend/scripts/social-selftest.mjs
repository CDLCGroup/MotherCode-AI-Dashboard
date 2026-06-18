// Offline self-test for the Slack outbound client + SocialAgent (Buffer).
// Mirrors scripts/google-selftest.mjs. Proves everything that does NOT need real
// tokens or network:
//   - slackConfigured()/bufferConfigured() gate on realKey
//   - postMessage()/getStatus()/postAgentChat() are graceful no-ops unconfigured
//   - buildAgentChat() builds a well-formed parent + threaded-reply payload
//   - SocialAgent degrades to needsAuth when Buffer isn't connected
//   - SocialAgent routes list/now/schedule and parses caption/platforms/time
// The only thing this cannot cover is the live Slack/Buffer call, which needs a
// real bot token / approved Buffer key (see SETUP-slack.md).
// Run: node scripts/social-selftest.mjs

import assert from 'node:assert';

// Force a clean keyless baseline regardless of the real .env: clear the tokens
// BEFORE importing the modules so the config gates read "not configured".
delete process.env.SLACK_BOT_TOKEN;
delete process.env.BUFFER_API_KEY;

const slack = await import('../src/integrations/slackClient.js');
const { bufferConfigured } = await import('../src/integrations/bufferClient.js');
const { default: SocialAgent } = await import('../src/agents/SocialAgent.js');

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
check('slackConfigured() false without token', () => assert.equal(slack.slackConfigured(), false));
check('bufferConfigured() false without key', () => assert.equal(bufferConfigured(), false));
check('slackChannel() defaults to #mothercode-notifications', () =>
  assert.equal(slack.slackChannel(), '#mothercode-notifications'));

console.log('\n=== 2. Slack no-ops when unconfigured ===');
const pm = await slack.postMessage({ channel: '#x', text: 'hi' });
check('postMessage is a skipped no-op', () => {
  assert.equal(pm.success, false);
  assert.equal(pm.skipped, true);
});
const st = await slack.getStatus();
check('getStatus reports disconnected', () => assert.equal(st.connected, false));
const chat = await slack.postAgentChat({ intent: 'schedule_post', transcript: 'post', results: [] });
check('postAgentChat is a skipped no-op (never throws, never networks)', () =>
  assert.equal(chat.skipped, true));

console.log('\n=== 3. subagent-chat payload shape (pure builder) ===');
const built = slack.buildAgentChat({
  intent: 'schedule_post',
  transcript: 'post about the launch',
  results: [
    { domain: 'social_media', success: true, data: { message: 'Scheduled for Monday.' } },
    { domain: 'calendar', success: false, error: 'Agent not found' },
    { domain: 'email', success: false, data: null }, // failure w/ null data → fallback
  ],
});
check('parent has mic + intent + quoted transcript', () => {
  assert.ok(built.parentText.includes('schedule_post'));
  assert.ok(built.parentText.includes('post about the launch'));
  assert.ok(built.parentText.startsWith('🎙'));
});
check('one threaded reply per result', () => assert.equal(built.replies.length, 3));
check('success reply is 🟢 with the agent message', () => {
  assert.ok(built.replies[0].startsWith('🟢'));
  assert.ok(built.replies[0].includes('social_media'));
  assert.ok(built.replies[0].includes('Scheduled for Monday.'));
});
check('failure reply is 🔴 with the error', () => {
  assert.ok(built.replies[1].startsWith('🔴'));
  assert.ok(built.replies[1].includes('Agent not found'));
});
check('failure with null data falls back to "no response"', () => {
  assert.ok(built.replies[2].startsWith('🔴'));
  assert.ok(built.replies[2].includes('no response'));
});

console.log('\n=== 4. SocialAgent needsAuth (Buffer not connected) ===');
const social = new SocialAgent(null);
const auth = await social.execute({ transcript: 'schedule a tiktok about our launch tomorrow at 5pm' });
check('SocialAgent returns needsAuth', () => {
  assert.equal(auth.needsAuth, true);
  assert.equal(auth.domain, 'social_media');
  assert.ok(/BUFFER_API_KEY|Buffer/.test(auth.message));
});

console.log('\n=== 5. SocialAgent routing + parsing ===');
check('routes "show my scheduled posts" → list', () =>
  assert.equal(social.routeAction('show my scheduled posts'), 'list'));
check('routes "post this now" → now', () =>
  assert.equal(social.routeAction('post this now'), 'now'));
check('routes "schedule a post about x tomorrow at 2pm" → schedule', () =>
  assert.equal(social.routeAction('schedule a post about x tomorrow at 2pm'), 'schedule'));

const parsed = social.parsePost('schedule a tiktok and instagram post about our product launch tomorrow at 5pm');
check('detects platforms tiktok + instagram', () =>
  assert.deepEqual([...parsed.platforms].sort(), ['instagram', 'tiktok']));
check('parses a caption mentioning the topic', () =>
  assert.ok(parsed.caption.toLowerCase().includes('product launch')));
check('parses a scheduled time (parsedTime true)', () => assert.equal(parsed.parsedTime, true));
check('5pm → 17:00 local', () => assert.equal(parsed.scheduledAt.getHours(), 17));

const noPlat = social.parsePost('post about the new feature now');
check('no platform mentioned → empty platforms (caller defaults)', () =>
  assert.equal(noPlat.platforms.length, 0));
check('"now" parses no scheduled time', () => assert.equal(noPlat.parsedTime, false));

check('defaultPlatforms() falls back to [tiktok] with no channels set', () =>
  assert.deepEqual(social.defaultPlatforms(), ['tiktok']));

console.log(`\n=== ${pass} checks passed${process.exitCode ? ', SOME FAILED' : ', ALL PASS'} ===`);
