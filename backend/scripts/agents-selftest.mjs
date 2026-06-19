// backend/scripts/agents-selftest.mjs
//
// Offline self-test for the promoted agents (analytics, finance, file_manager).
// Verifies keyless-first behavior, real data paths, and the file sandbox guards.
//
//   node backend/scripts/agents-selftest.mjs

import AnalyticsAgent from '../src/agents/AnalyticsAgent.js';
import FinanceAgent from '../src/agents/FinanceAgent.js';
import FileManagerAgent from '../src/agents/FileManagerAgent.js';
import { recordCall, buildCall } from '../src/state/voiceStore.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

let pass = 0, fail = 0;
const check = (label, cond) => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label}`); } };

// Isolate the file sandbox to a throwaway dir for this run.
const HERE = path.dirname(fileURLToPath(import.meta.url));
const SANDBOX = path.join(HERE, '__filetest__');
process.env.MOTHERCODE_FILES_DIR = SANDBOX;
await fs.rm(SANDBOX, { recursive: true, force: true });

console.log('=== 1. AnalyticsAgent — real data from the voice store ===');
const analytics = new AnalyticsAgent(null);
let r = await analytics.execute({ transcript: 'show analytics' });
check('empty store → "no activity" message', /no activity/i.test(r.message));
recordCall(buildCall({ intent: 'schedule_event', transcript: 'x', response: 'ok', success: true }));
recordCall(buildCall({ intent: 'schedule_event', transcript: 'y', response: 'ok', success: true }));
recordCall(buildCall({ intent: 'get_revenue', transcript: 'z', response: 'ok', success: false }));
r = await analytics.execute({ transcript: 'show analytics' });
check('reports total command count', /3 commands/.test(r.message));
check('computes a success rate', typeof r.successRate === 'number' && r.successRate === 67);
check('surfaces the top intent', r.topIntents[0].key === 'schedule_event' && r.topIntents[0].count === 2);

console.log('\n=== 2. FinanceAgent — keyless Paystack gate ===');
delete process.env.PAYSTACK_SECRET_KEY;
const finance = new FinanceAgent(null);
check('configured() false with no key', FinanceAgent.configured() === false);
r = await finance.execute({ transcript: 'what is my revenue' });
check('keyless reply names Paystack, no fabricated number', /paystack/i.test(r.message) && r.needsAuth === true && !/\$|R\s?\d/.test(r.message));
check('placeholder key still reads unconfigured', (() => { process.env.PAYSTACK_SECRET_KEY = 'sk_test_...'; const v = FinanceAgent.configured(); delete process.env.PAYSTACK_SECRET_KEY; return v === false; })());

console.log('\n=== 3. FileManagerAgent — real sandboxed notes ===');
const files = new FileManagerAgent(null);
r = await files.execute({ transcript: 'list my notes' });
check('empty folder message', /empty/i.test(r.message));
r = await files.execute({ transcript: 'save a note: call the venue at 5pm called venue' });
check('creates a note', r.created === true && r.file.endsWith('.md'));
const created = await fs.readFile(path.join(SANDBOX, r.file), 'utf8');
check('note content written to disk', /call the venue at 5pm/.test(created));
r = await files.execute({ transcript: 'save a note: bring the banners called venue' });
check('second write to same name appends (no overwrite)', r.appended === true);
const appended = await fs.readFile(path.join(SANDBOX, 'venue.md'), 'utf8');
check('append preserved original content', /call the venue/.test(appended) && /bring the banners/.test(appended));
r = await files.execute({ transcript: 'read the note called venue' });
check('reads it back', /call the venue/i.test(r.message));
r = await files.execute({ transcript: 'list my notes' });
check('list now shows the note', /1 note/.test(r.message));

console.log('\n=== 4. FileManagerAgent — sandbox safety ===');
const traversal = files.safePath('../../etc/passwd');   // basename strips dirs → passwd.md inside sandbox
check('traversal neutralized to basename inside sandbox', traversal.startsWith(SANDBOX + path.sep) && traversal.endsWith('passwd.md'));
const exe = files.safePath('payload.exe');
check('non-text extension forced to .md', exe.endsWith('.md') && exe.startsWith(SANDBOX + path.sep));
const bad = (() => { try { files.safePath('..'); return null; } catch (e) { return e; } })();
check('".." rejected as a bad name', bad && bad.code === 'BADNAME');
// Defense-in-depth: a write via execute() never escapes the sandbox — the
// resulting filename carries no path separators or traversal, and the file
// actually lands inside SANDBOX.
r = await files.execute({ transcript: 'save a note: x called ../../escape' });
const safeName = r.file && !/[\\/]/.test(r.file) && !r.file.includes('..');
const landed = r.file ? await fs.access(path.join(SANDBOX, r.file)).then(() => true).catch(() => false) : false;
check('execute() write stays in sandbox', (r.created || r.appended) && safeName && landed);

await fs.rm(SANDBOX, { recursive: true, force: true });
console.log(`\n=== ${pass} checks passed, ${fail === 0 ? 'ALL PASS' : fail + ' FAILED'} ===`);
process.exit(fail === 0 ? 0 : 1);
