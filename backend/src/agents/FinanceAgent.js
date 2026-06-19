// backend/src/agents/FinanceAgent.js
//
// Real finance agent. Replaces the finance StubAgent. Payments are backed by
// Paystack (https://paystack.com). Keyless-first: with no PAYSTACK_SECRET_KEY it
// returns an honest "connect Paystack" message and NEVER fabricates revenue.
// When a key is present it fetches a real summary (available balance + last-7-day
// volume) from the Paystack REST API via fetch — no SDK dependency. Any API
// error degrades to a clear message, never throws.
//
// Paystack amounts are in the currency's minor unit (ZAR cents / NGN kobo), so
// every amount is divided by 100 and formatted with its currency code.
//
// Contract matches the other agents: execute() → { message, ... }.

import BaseAgent from './BaseAgent.js';
import { realKey } from '../voice/keys.js';

const NEEDS_AUTH =
  'I can report revenue, balance, and payouts once Paystack is connected — set PAYSTACK_SECRET_KEY in .env to enable it.';

export class FinanceAgent extends BaseAgent {
  constructor(redis) {
    super('FinanceAgent', 'finance', redis);
    this.isReady = true;
  }

  static configured() {
    return realKey(process.env.PAYSTACK_SECRET_KEY);
  }

  async execute(command) {
    if (!FinanceAgent.configured()) {
      return { message: NEEDS_AUTH, needsAuth: true, domain: 'finance' };
    }

    try {
      const [balance, recent] = await Promise.all([this.fetchBalance(), this.fetchRecentTotals()]);
      const parts = [];
      if (balance) parts.push(`Available balance: ${this.money(balance.amount, balance.currency)}.`);
      if (recent && recent.count > 0) {
        parts.push(`Over the last 7 days: ${this.money(recent.amount, recent.currency)} across ${recent.count} successful payment${recent.count === 1 ? '' : 's'}.`);
      } else if (recent) {
        parts.push('No successful payments in the last 7 days.');
      }
      if (!parts.length) parts.push('Paystack is connected, but I found no activity to report.');
      return { message: parts.join(' '), domain: 'finance', balance, recent };
    } catch (err) {
      console.warn('[FinanceAgent] Paystack query failed:', err.message);
      return {
        message: 'Paystack is connected but I could not reach it just now. Please try again shortly.',
        domain: 'finance',
        error: err.message,
      };
    }
  }

  async paystackGet(path) {
    const res = await fetch(`https://api.paystack.co/${path}`, {
      headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.status === false) {
      throw new Error(body.message || `Paystack ${res.status} on ${path}`);
    }
    return body;
  }

  /** First available balance entry → { amount (major units), currency }. */
  async fetchBalance() {
    const b = await this.paystackGet('balance');
    const first = (b.data || [])[0];
    if (!first) return null;
    return { amount: (first.balance || 0) / 100, currency: first.currency || 'ZAR' };
  }

  /** Last-7-day totals via /transaction/totals → { amount, count, currency }. */
  async fetchRecentTotals() {
    const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const data = await this.paystackGet(`transaction/totals?from=${encodeURIComponent(from)}`);
    const d = data.data || {};
    // total_volume_by_currency: [{ currency, amount }]; fall back to total_volume.
    const byCcy = (d.total_volume_by_currency || [])[0];
    const amount = (byCcy ? byCcy.amount : d.total_volume || 0) / 100;
    return { amount, count: d.total_transactions || 0, currency: byCcy ? byCcy.currency : 'ZAR' };
  }

  money(n, currency = 'ZAR') {
    try {
      return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(Number(n));
    } catch {
      return `${currency} ${Number(n).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}`;
    }
  }
}

export default FinanceAgent;
