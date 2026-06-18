// Offline self-test for the Google Calendar + Email agents (Task 1).
// Proves everything that does NOT need real credentials or network:
//   - consent URL carries the 3 exact scopes + the 3001 redirect URI
//   - googleConfigured()/isAuthorized() gate correctly
//   - both agents degrade to the needsAuth message when not connected
//   - CalendarAgent parses title/time + routes create-vs-list
//   - EmailAgent builds a valid RFC-2822 raw draft + parses headers
// The only thing this cannot cover is the live Google API call, which needs the
// user's own OAuth client (see SETUP-google.md).
// Run: node scripts/google-selftest.mjs

import assert from 'node:assert';

// Set dummy-but-valid-looking creds BEFORE importing the module so the config
// gate passes. realKey() only rejects '', 'your_*', and '...'-containing values.
process.env.GOOGLE_CLIENT_ID = 'selftest-client.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = 'selftest-secret-xyz';
process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/auth/google/callback';

const { generateAuthUrl, googleConfigured, isAuthorized, SCOPES } = await import('../src/integrations/googleAuth.js');
const { default: CalendarAgent } = await import('../src/agents/CalendarAgent.js');
const { default: EmailAgent } = await import('../src/agents/EmailAgent.js');

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

console.log('\n=== 1. config + consent URL ===');
check('googleConfigured() true with valid creds', () => assert.equal(googleConfigured(), true));
check('isAuthorized() false (no token file)', () => assert.equal(isAuthorized(), false));

const url = generateAuthUrl();
check('consent URL targets the 3001 callback', () =>
  assert.ok(url.includes(encodeURIComponent('http://localhost:3001/auth/google/callback')), url));
check('consent URL requests access_type=offline + prompt=consent', () => {
  assert.ok(url.includes('access_type=offline'));
  assert.ok(url.includes('prompt=consent'));
});
for (const s of SCOPES) {
  check(`consent URL includes scope ${s.split('/').pop()}`, () =>
    assert.ok(url.includes(encodeURIComponent(s)), url));
}
check('exactly the 3 expected scopes', () =>
  assert.deepEqual([...SCOPES].sort(), [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/gmail.readonly',
  ]));

console.log('\n=== 2. needsAuth fallback (not connected) ===');
const cal = new CalendarAgent(null);
const email = new EmailAgent(null);
if (isAuthorized()) {
  // A real token file exists (you've authorized) — the fallback path can't be
  // exercised without disconnecting. Skip rather than report a false failure.
  console.log('  ⊘ skipped: Google is connected (.google-tokens.json present)');
} else {
  const calAuth = await cal.execute({ transcript: 'schedule a meeting tomorrow at 2pm' });
  const emailAuth = await email.execute({ transcript: 'read my urgent email' });
  check('CalendarAgent returns needsAuth', () => {
    assert.equal(calAuth.needsAuth, true);
    assert.ok(/auth\/google/.test(calAuth.message));
  });
  check('EmailAgent returns needsAuth', () => {
    assert.equal(emailAuth.needsAuth, true);
    assert.ok(/auth\/google/.test(emailAuth.message));
  });
}

console.log('\n=== 3. CalendarAgent parsing/routing ===');
check('routes "what is on my agenda today" → list', () =>
  assert.equal(cal.routeAction('what is on my agenda today'), 'list'));
check('routes "schedule lunch tomorrow at noon" → create', () =>
  assert.equal(cal.routeAction('schedule lunch tomorrow at noon'), 'create'));

const ev = cal.parseEvent('schedule a planning call tomorrow at 2pm');
check('parses title "Planning call"', () => assert.equal(ev.title, 'Planning call'));
check('parses a time (parsedTime true)', () => assert.equal(ev.parsedTime, true));
check('2pm → 14:00 local', () => assert.equal(ev.start.getHours(), 14));
check('event is 1 hour long', () =>
  assert.equal((ev.end - ev.start) / 60000, 60));

const noon = cal.parseEvent('block lunch tomorrow at noon');
check('noon → 12:00', () => assert.equal(noon.start.getHours(), 12));

const vague = cal.parseEvent('schedule a haircut');
check('no time reference → parsedTime false (will ask, not guess)', () =>
  assert.equal(vague.parsedTime, false));

console.log('\n=== 4. EmailAgent raw/header helpers ===');
const raw = email.buildRaw({
  to: 'Jane Doe <jane@example.com>',
  subject: 'Re: Project update',
  inReplyTo: '<abc@mail.gmail.com>',
  body: 'Thanks!',
});
const decoded = Buffer.from(raw.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
check('raw is base64url (no +/=)', () => assert.ok(!/[+/=]/.test(raw)));
check('decoded raw has To/Subject/In-Reply-To headers', () => {
  assert.ok(/^To: Jane Doe <jane@example.com>$/m.test(decoded));
  assert.ok(/^Subject: Re: Project update$/m.test(decoded));
  assert.ok(/^In-Reply-To: <abc@mail.gmail.com>$/m.test(decoded));
});
const hdr = email.extractHeaders({
  payload: { headers: [
    { name: 'From', value: 'Jane Doe <jane@example.com>' },
    { name: 'Subject', value: 'Lunch?' },
    { name: 'Message-ID', value: '<xyz@mail>' },
  ] },
});
check('extractHeaders pulls display name', () => assert.equal(hdr.from, 'Jane Doe'));
check('extractHeaders pulls subject', () => assert.equal(hdr.subject, 'Lunch?'));

console.log(`\n=== ${pass} checks passed${process.exitCode ? ', SOME FAILED' : ', ALL PASS'} ===`);
