import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSupabase, resetSupabase } from '../../src/lib/supabase.js';

describe('supabase wrapper', () => {
  let saved;
  beforeEach(() => {
    saved = { ...process.env };
    resetSupabase();
  });
  afterEach(() => { process.env = saved; resetSupabase(); });

  it('throws when SUPABASE_URL is missing', () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    expect(() => getSupabase()).toThrow(/SUPABASE_URL/);
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getSupabase()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('returns same instance on repeated calls (memoized)', () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    const a = getSupabase();
    const b = getSupabase();
    expect(a).toBe(b);
  });
});
