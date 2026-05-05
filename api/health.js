import { getSupabase } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  const checks = { server: 'ok', supabase: 'unknown', anthropic: 'unknown' };
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('orgs').select('id').limit(1);
    checks.supabase = error ? `err: ${error.message}` : 'ok';
  } catch (e) {
    checks.supabase = `err: ${e.message}`;
  }
  checks.anthropic = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';
  const allOk = Object.values(checks).every((v) => v === 'ok' || v === 'configured');
  return res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks, uptime_s: Math.floor(process.uptime()) });
}
