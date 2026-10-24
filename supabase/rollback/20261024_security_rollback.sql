-- ROLLBACK for 20261024150100_enable_rls_private_storage.sql (+ optional upload_links)
-- Restores the exact pre-change state of 2026-10-24. Run in the Supabase SQL editor.
-- WARNING: this re-opens the database and the 'grant-documents' files to anyone with the anon key.
begin;
alter table public.agent_activity_log disable row level security;
alter table public.agent_notes disable row level security;
alter table public.agent_tasks disable row level security;
alter table public.agents disable row level security;
alter table public.alerts disable row level security;
alter table public.application_drafts disable row level security;
alter table public.application_packages disable row level security;
alter table public.budget_templates disable row level security;
alter table public.deadline_alerts disable row level security;
alter table public.document_vault disable row level security;
alter table public.grant_opportunities disable row level security;
alter table public.grant_runs disable row level security;
alter table public.grants_conversations disable row level security;
alter table public.grants_messages disable row level security;
alter table public.org_kb disable row level security;
alter table public.org_kb_files disable row level security;
alter table public.org_templates disable row level security;
alter table public.orgs disable row level security;
alter table public.playwright_sessions disable row level security;
alter table public.youtube_intel disable row level security;
-- (marketing_leads already had RLS on before the change; left on)

alter view public.agent_context_v reset (security_invoker);
grant select on public.agent_context_v to anon, authenticated;

update storage.buckets set public = true where id = 'grant-documents';
create policy "Allow public reads"   on storage.objects for select to anon using (bucket_id = 'grant-documents');
create policy "Allow public uploads" on storage.objects for insert to anon with check (bucket_id = 'grant-documents');
create policy "Allow public updates" on storage.objects for update to anon using (bucket_id = 'grant-documents');
commit;

-- Optional: remove client upload links entirely (breaks every /u/<token> link):
-- drop table if exists public.upload_links;

-- Data edits made the same day (revert only if wanted):
-- update public.document_vault set doc_name = 'IRS 508(c)(1)(a) Determination Letter',
--   description = 'Faith-based nonprofit tax exemption proof — required for ALL foundation and federal grants'
--   where id = 'a95dc89e-4a14-4502-a644-3aa8f1d9b8cc';
-- update public.orgs set data = jsonb_set(data, '{address}', '"4014 Ophie Dr NE, Marietta, GA 30066-2330"') where id = 'holigenix_healthcare';
-- update public.orgs set data = jsonb_set(data, '{address}', '"4014 Ophie Dr NE, Marietta, GA 30066"') where id = 'holigenix_wellness_foundation';
-- NOTE: rolling back the database alone is not enough if the new app code stays deployed;
-- to fully revert, also revert the merged PR in GitHub (Vercel redeploys main).
