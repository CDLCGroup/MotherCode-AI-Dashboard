// backend/scripts/llm-router-selftest.mjs
//
// Offline self-test for the LLM intent router. Runs with NO key — verifies the
// keyless-first contract: the router reports unconfigured, the regex fallback
// still routes correctly, MotherCodeAgent honors pre-supplied domains, and the
// domain sanitizer enforces the archive≠social invariant. Does NOT call the API.
//
//   node backend/scripts/llm-router-selftest.mjs

import { llmConfigured, sanitizeDomains, DOMAINS, MODEL } from '../src/voice/intentRouter.js';
import MotherCodeAgent from '../src/agents/MotherCodeAgent.js';
import { createDefaultAgents } from '../src/agents/StubAgent.js';

let pass = 0;
let fail = 0;
function check(label, cond) {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}`); }
}

// Ensure no key leaks in from the environment for this offline run.
delete process.env.ANTHROPIC_API_KEY;
delete process.env.CLAUDE_API_KEY;

console.log('=== 1. keyless detection ===');
check('llmConfigured() is false with no key', llmConfigured() === false);
check('placeholder ANTHROPIC_API_KEY reads as unconfigured', (() => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-...';
  const r = llmConfigured();
  delete process.env.ANTHROPIC_API_KEY;
  return r === false;
})());
check('a realistic key reads as configured', (() => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-api03-' + 'x'.repeat(40);
  const r = llmConfigured();
  delete process.env.ANTHROPIC_API_KEY;
  return r === true;
})());
check('default model is claude-opus-4-8', MODEL === 'claude-opus-4-8');

console.log('\n=== 2. domain sanitizer ===');
check('dedupes + drops unknown domains', JSON.stringify(sanitizeDomains(['email', 'email', 'bogus'])) === JSON.stringify(['email']));
check('archive (tiktok) excludes social_media', JSON.stringify(sanitizeDomains(['tiktok', 'social_media'])) === JSON.stringify(['tiktok']));
check('empty in → empty out', JSON.stringify(sanitizeDomains([])) === '[]');
check('all canonical domains pass through', sanitizeDomains(DOMAINS).length === DOMAINS.length - 1); // social_media dropped because tiktok present

console.log('\n=== 3. MotherCodeAgent honors pre-supplied domains (LLM path) ===');
const mc = new MotherCodeAgent(null, createDefaultAgents(null));
const r1 = await mc.execute({ intent: 'anything', domains: ['email'], transcript: 'x' });
check('uses command.domains verbatim', JSON.stringify(r1.agents_invoked) === JSON.stringify(['email']));
const r2 = await mc.execute({ intent: 'anything', domains: ['bogus_domain'], transcript: 'x' });
check('filters unknown pre-supplied domain → no agent acts', (!r2.agents_invoked || r2.agents_invoked.length === 0) && r2.intent_recognized === false);

console.log('\n=== 4. regex fallback still works when no domains supplied ===');
const r3 = await mc.execute({ intent: 'archive_tiktok', transcript: 'archive videos' });
check('no domains → routeIntent fallback (archive → tiktok)', r3.agents_invoked.includes('tiktok') && !r3.agents_invoked.includes('social_media'));

console.log(`\n=== ${pass} checks passed, ${fail === 0 ? 'ALL PASS' : fail + ' FAILED'} ===`);
process.exit(fail === 0 ? 0 : 1);
