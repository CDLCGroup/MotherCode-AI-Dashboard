// backend/src/agents/StubAgent.js
import BaseAgent from './BaseAgent.js';

/**
 * StubAgent — a registerable specialized agent that returns a deterministic,
 * human-sounding acknowledgement for its domain.
 *
 * Phase 2 ships these so the voice loop is end-to-end observable BEFORE the real
 * Calendar/Email/Social/etc. integrations land: MotherCode can route an intent,
 * an agent actually responds, and `aggregateResults` produces a real sentence
 * instead of the "I wasn't able to complete that action" fallback.
 *
 * Each real agent will replace its stub by registering under the same domain key
 * (see voiceRoutes.js). The contract is identical: execute() returns an object
 * whose `.message` MotherCode.aggregateResults() reads back.
 */
export class StubAgent extends BaseAgent {
  /**
   * @param {string} domain   routing key, e.g. 'calendar'
   * @param {object} redis    shared redis client (optional / lazy)
   * @param {(command:object)=>string} responder  builds the spoken reply
   */
  constructor(domain, redis, responder) {
    super(`Stub:${domain}`, domain, redis);
    this.responder = responder || ((cmd) => `Handled "${cmd.transcript || cmd.intent}".`);
    // Stubs need no async setup.
    this.isReady = true;
  }

  async execute(command) {
    return {
      message: this.responder(command),
      stub: true,
      domain: this.domain,
      intent: command.intent,
    };
  }
}

/**
 * Factory: the default set of stub agents, keyed by the domains MotherCode's
 * routeIntent() can emit. Swap any entry for a real BaseAgent subclass to go live.
 */
export function createDefaultAgents(redis) {
  const defs = {
    calendar: (c) => `I've noted a calendar action for "${c.transcript}". Scheduling goes live once the Calendar agent is connected.`,
    email: (c) => `Got it — I'll handle the email request: "${c.transcript}". Gmail wiring is pending credentials.`,
    social_media: (c) => `Queued a social action for "${c.transcript}". The Buffer/Social agent will post it once connected.`,
    finance: (c) => `Pulling finance data for "${c.transcript}". Stripe reporting activates when keys are added.`,
    analytics: (c) => `Here's the analytics view for "${c.transcript}". Live metrics connect with the Analytics agent.`,
    file_manager: (c) => `File operation acknowledged: "${c.transcript}". The File agent handles edits once enabled.`,
  };
  const agents = {};
  for (const [domain, responder] of Object.entries(defs)) {
    agents[domain] = new StubAgent(domain, redis, responder);
  }
  return agents;
}

export default StubAgent;
