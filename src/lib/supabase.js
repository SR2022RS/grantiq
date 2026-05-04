import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('[supabase] SUPABASE_URL missing');
  if (!key) throw new Error('[supabase] SUPABASE_SERVICE_ROLE_KEY missing');
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function resetSupabase() {
  client = null;
}
