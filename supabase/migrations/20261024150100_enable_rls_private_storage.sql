-- GrantIQ: lock down the database and client files. 2026-10-24
-- * Row-level security ON for every public table, with NO anon/authenticated
--   policies: the browser anon key can no longer read or write anything.
--   All access goes through server routes using the service role (which
--   bypasses RLS). Client upload pages use per-client link tokens checked
--   server-side; admin routes require the portal login.
-- * The 'grant-documents' bucket becomes private and its anon policies are
--   dropped. Files are served only via short-lived signed URLs.
-- Rollback: supabase/rollback/20261024_security_rollback.sql
begin;
alter table public.agent_activity_log enable row level security;
alter table public.agent_notes enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.agents enable row level security;
alter table public.alerts enable row level security;
alter table public.application_drafts enable row level security;
alter table public.application_packages enable row level security;
alter table public.budget_templates enable row level security;
alter table public.deadline_alerts enable row level security;
alter table public.document_vault enable row level security;
alter table public.grant_opportunities enable row level security;
alter table public.grant_runs enable row level security;
alter table public.grants_conversations enable row level security;
alter table public.grants_messages enable row level security;
alter table public.marketing_leads enable row level security;
alter table public.org_kb enable row level security;
alter table public.org_kb_files enable row level security;
alter table public.org_templates enable row level security;
alter table public.orgs enable row level security;
alter table public.playwright_sessions enable row level security;
alter table public.youtube_intel enable row level security;

-- the view runs with its owner's rights, so close it to the API roles too
revoke all on public.agent_context_v from anon, authenticated;
alter view public.agent_context_v set (security_invoker = on);

update storage.buckets set public = false where id = 'grant-documents';
drop policy if exists "Allow public reads"   on storage.objects;
drop policy if exists "Allow public uploads" on storage.objects;
drop policy if exists "Allow public updates" on storage.objects;
commit;
