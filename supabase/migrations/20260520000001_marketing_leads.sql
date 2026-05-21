-- Marketing leads from the GrantIQ sales page (grantiq.operatorhq.agency/landing).
-- Captured by the public /api/leads/submit Vercel function (service-role insert),
-- reviewed by the operator inside the Command Center "Leads" view.
--
-- SECURITY MODEL (differs from Growth Engine):
--   GrantIQ has NO Supabase Auth and NO is_platform_admin() predicate. The browser
--   reads public tables with the anon key (see public/live-data.jsx); every
--   privileged operation goes through /api/* using SUPABASE_SERVICE_ROLE_KEY.
--   So we enable RLS with NO policies: the anon key cannot read or write leads,
--   and only the service-role endpoints can touch this table. Admin reads/updates
--   happen via /api/leads/list + /api/leads/update, which sit behind the portal's
--   HTTP Basic Auth gate (middleware.js). Do NOT add an anon insert/select policy.

CREATE TABLE IF NOT EXISTS public.marketing_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  agency_name text,
  email text NOT NULL,
  phone text,
  message text,
  interest text,                       -- which CTA: 'trial' | 'demo' | 'walkthrough'
  source text NOT NULL DEFAULT 'grantiq-sales-page',
  status text NOT NULL DEFAULT 'new',  -- new | contacted | qualified | onboarded | closed
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS enabled with no policies → service-role only (bypasses RLS); anon gets nothing.
ALTER TABLE public.marketing_leads ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS marketing_leads_created_idx ON public.marketing_leads (created_at DESC);
