// backend/src/agents/BaseAgent.js
import EventEmitter from 'events';

/**
 * BaseAgent - Abstract base class for all specialized agents
 * All agents (Calendar, Email, Finance, etc.) extend this
 */
export class BaseAgent extends EventEmitter {
  constructor(name, domain, redis) {
    super();
    this.name = name;
    this.domain = domain;
    this.redis = redis;
    this.isReady = false;

    console.log(`[${name}] Agent initialized for domain: ${domain}`);
  }

  /**
   * Initialize agent (setup, auth, etc.)
   */
  async initialize() {
    this.isReady = true;
    console.log(`[${this.name}] Agent ready`);
  }

  /**
   * Process a command routed to this agent
   * @param {Object} command - { intent, params, userId, timestamp }
   * @returns {Promise<Object>} { success, data, error }
   */
  async process(command) {
    try {
      if (!this.isReady) {
        await this.initialize();
      }

      console.log(`[${this.name}] Processing:`, command.intent);

      const startTime = Date.now();
      const result = await this.execute(command);
      const executionTime = Date.now() - startTime;

      // Emit success event
      this.emit('command_executed', {
        agent: this.name,
        intent: command.intent,
        success: true,
        executionTime,
        timestamp: new Date().toISOString()
      });

      console.log(`[${this.name}] Executed in ${executionTime}ms`);

      return {
        success: true,
        agent: this.name,
        data: result,
        executionTime
      };
    } catch (error) {
      console.error(`[${this.name}] Error:`, error.message);

      this.emit('command_failed', {
        agent: this.name,
        intent: command.intent,
        error: error.message,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        agent: this.name,
        error: error.message,
        data: null
      };
    }
  }

  /**
   * Execute the actual command logic
   * Override in subclasses
   */
  async execute(command) {
    throw new Error(`${this.name}.execute() not implemented`);
  }

  /**
   * Get cached data
   */
  async getCached(key) {
    try {
      const data = await this.redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error(`[${this.name}] Cache error:`, error);
      return null;
    }
  }

  /**
   * Set cached data
   */
  async setCached(key, data, ttl = 3600) {
    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error(`[${this.name}] Cache error:`, error);
      return false;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    return {
      name: this.name,
      domain: this.domain,
      status: this.isReady ? 'healthy' : 'initializing',
      timestamp: new Date().toISOString()
    };
  }
}

export default BaseAgent;
