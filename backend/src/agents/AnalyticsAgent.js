// backend/src/agents/AnalyticsAgent.js
//
// Real analytics agent. Replaces the analytics StubAgent. Keyless-first AND
// genuinely functional with no keys: it reports REAL usage analytics derived
// from the in-memory voice store (the same data the dashboard charts). External
// social/web analytics (Buffer, GA) are a gated upgrade noted in the reply.
//
// Contract matches the other agents: execute() returns { message, ... } where
// MotherCode.aggregateResults() reads `.message` as the spoken reply.

import BaseAgent from './BaseAgent.js';
import { getMetrics } from '../state/voiceStore.js';
import { bufferConfigured } from '../integrations/bufferClient.js';

export class AnalyticsAgent extends BaseAgent {
  constructor(redis) {
    super('AnalyticsAgent', 'analytics', redis);
    this.isReady = true;
  }

  async execute(command) {
    const m = getMetrics();

    if (m.total === 0) {
      return {
        message:
          "There's no activity to analyze yet — run a few voice commands and I'll report usage, " +
          'success rate, and the busiest agents.',
        domain: 'analytics',
        metrics: m,
      };
    }

    const successRate = Math.round((m.completed / m.total) * 100);
    const ranked = this.rankIntents(m.intentCounts);

    const parts = [
      `You've run ${m.total} command${m.total === 1 ? '' : 's'} with a ${successRate}% success rate.`,
    ];
    if (ranked.length) {
      const top = ranked.slice(0, 3).map((r) => `${this.humanize(r.key)} (${r.count})`);
      parts.push(`Top request${ranked.length === 1 ? '' : 's'}: ${top.join(', ')}.`);
    }
    if (m.avgDuration) parts.push(`Average turn: ${m.avgDuration}s.`);
    if (!bufferConfigured()) {
      parts.push('Connect Buffer to fold in social-post reach and engagement.');
    }

    return {
      message: parts.join(' '),
      domain: 'analytics',
      metrics: m,
      successRate,
      topIntents: ranked.slice(0, 3),
      external: { buffer: bufferConfigured() },
    };
  }

  /** Rank a { key: count } map descending → [{ key, count }, ...]. */
  rankIntents(counts) {
    return Object.entries(counts || {})
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }

  humanize(key) {
    return String(key).replace(/_/g, ' ');
  }
}

export default AnalyticsAgent;
