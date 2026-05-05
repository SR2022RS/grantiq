import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MODEL, MAX_TOKENS, MAX_TOOL_ITERATIONS, RETRY_STATUSES, assertRequiredEnv } from '../../src/lib/constants.js';

describe('constants', () => {
  it('MODEL defaults to claude-sonnet-4-6', () => {
    expect(MODEL).toBe(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6');
  });

  it('MAX_TOKENS is a positive integer', () => {
    expect(Number.isInteger(MAX_TOKENS) && MAX_TOKENS > 0).toBe(true);
  });

  it('MAX_TOOL_ITERATIONS defaults to 8', () => {
    expect(MAX_TOOL_ITERATIONS).toBeGreaterThan(0);
  });

  it('RETRY_STATUSES includes 429 and 529', () => {
    expect(RETRY_STATUSES.has(429)).toBe(true);
    expect(RETRY_STATUSES.has(529)).toBe(true);
  });

  describe('assertRequiredEnv', () => {
    let saved;
    beforeEach(() => { saved = { ...process.env }; });
    afterEach(() => { process.env = saved; });

    it('throws when ANTHROPIC_API_KEY is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => assertRequiredEnv()).toThrow(/ANTHROPIC_API_KEY/);
    });

    it('throws when SUPABASE_URL is missing', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      delete process.env.SUPABASE_URL;
      expect(() => assertRequiredEnv()).toThrow(/SUPABASE_URL/);
    });

    it('passes when all required are set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ-test';
      expect(() => assertRequiredEnv()).not.toThrow();
    });
  });
});
