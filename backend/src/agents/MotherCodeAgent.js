// backend/src/agents/MotherCodeAgent.js
import BaseAgent from './BaseAgent.js';

/**
 * MotherCode - Master Orchestrator Agent
 * Routes user intents to appropriate specialized agents
 * Aggregates results and generates voice responses
 */
export class MotherCodeAgent extends BaseAgent {
  constructor(redis, agents = {}) {
    super('MotherCode', 'orchestration', redis);
    this.agents = agents;  // { 'calendar': CalendarAgent, 'email': EmailAgent, ... }
  }

  /**
   * Register a specialized agent
   */
  registerAgent(domain, agent) {
    this.agents[domain] = agent;
    console.log(`[MotherCode] Registered agent: ${domain}`);
  }

  /**
   * Execute the command by routing to appropriate agent(s)
   */
  async execute(command) {
    // command = { intent, params, userId, transcript }

    try {
      // Determine which agent(s) to invoke. The LLM router (when configured)
      // supplies command.domains directly; otherwise fall back to the regex
      // router over the parsed intent label. Pre-supplied domains are still
      // filtered to registered agents so a stale/unknown domain can't break us.
      const targetAgents = Array.isArray(command.domains)
        ? [...new Set(command.domains)].filter((d) => this.agents[d])
        : this.routeIntent(command.intent);

      if (targetAgents.length === 0) {
        return {
          response: "I'm not sure how to help with that. Could you rephrase?",
          intent_recognized: false,
          actions_taken: []
        };
      }

      // Execute agents in parallel where possible
      const results = await Promise.all(
        targetAgents.map(domain => {
          const agent = this.agents[domain];
          if (!agent) {
            console.warn(`[MotherCode] Agent not found: ${domain}`);
            return { domain, success: false, error: 'Agent not found' };
          }
          return agent.process(command).then(result => ({ domain, ...result }));
        })
      );

      // Check for failures
      const failures = results.filter(r => !r.success);
      if (failures.length > 0 && results.length > 1) {
        // Partial failure - some agents succeeded
        console.warn(`[MotherCode] Partial failure:`, failures);
      }

      // Aggregate results into voice response
      const response = this.aggregateResults(results, command);

      return {
        response,
        intents_recognized: true,
        agents_invoked: targetAgents,
        results,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('[MotherCode] Orchestration error:', error);
      return {
        response: "I encountered an error processing your command. Please try again.",
        error: error.message,
        intents_recognized: false,
        agents_invoked: []
      };
    }
  }

  /**
   * Route intent to appropriate agent(s)
   * Simple keyword matching - upgrade to Claude API for production
   */
  routeIntent(intent) {
    const domains = [];

    // Calendar keywords
    if (/schedule|meeting|calendar|thursday|friday|monday|tuesday|wednesday|time|block/i.test(intent)) {
      domains.push('calendar');
    }

    // Email keywords
    if (/email|mail|urgent|reply|send|read|message|inbox/i.test(intent)) {
      domains.push('email');
    }

    // Social media keywords
    if (/post|tiktok|instagram|youtube|linkedin|schedule|trending|viral|hashtag|content/i.test(intent)) {
      domains.push('social_media');
    }

    // Finance keywords
    if (/stripe|earn|revenue|subscriber|payment|money|bill|invoice|transaction/i.test(intent)) {
      domains.push('finance');
    }

    // Analytics keywords
    if (/analytics|performance|metrics|engagement|views|likes|trend|data/i.test(intent)) {
      domains.push('analytics');
    }

    // File keywords
    if (/file|document|edit|save|folder|directory|update|csv|markdown/i.test(intent)) {
      domains.push('file_manager');
    }

    // TikTok archive (tt_scraper pipeline) — distinct from social posting.
    if (/archive|scrape/i.test(intent)) {
      domains.push('tiktok');
    }

    let result = [...new Set(domains)];  // Remove duplicates
    // An archive request should not also fire the social media poster.
    if (result.includes('tiktok')) result = result.filter((d) => d !== 'social_media');
    return result;
  }

  /**
   * Aggregate results from multiple agents into a voice response
   */
  aggregateResults(results, command) {
    const successful = results.filter(r => r.success);

    if (successful.length === 0) {
      return "I wasn't able to complete that action. Please try again or provide more details.";
    }

    // Build response from successful results
    const responses = successful.map(result => {
      switch (result.domain) {
        case 'calendar':
          return result.data?.message || "Calendar updated.";
        case 'email':
          return result.data?.message || "Email processed.";
        case 'social_media':
          return result.data?.message || "Social media action completed.";
        case 'finance':
          return result.data?.message || "Financial data retrieved.";
        case 'analytics':
          return result.data?.message || "Analytics retrieved.";
        case 'file_manager':
          return result.data?.message || "File operation completed.";
        case 'tiktok':
          return result.data?.message || "TikTok archive started.";
        default:
          return "Done.";
      }
    });

    return responses.join(" ");
  }

  /**
   * Get all registered agents and their status
   */
  async getAgentsStatus() {
    const status = {};
    for (const [domain, agent] of Object.entries(this.agents)) {
      status[domain] = await agent.healthCheck();
    }
    return status;
  }
}

export default MotherCodeAgent;
