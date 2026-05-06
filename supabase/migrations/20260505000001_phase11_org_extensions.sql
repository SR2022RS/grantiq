-- Phase 11: self-service business + grant onboarding
--
-- 1) org_templates — DB-stored templates for orgs created via UI (filesystem
--    is read-only on Vercel, so we can't write workspace/templates/<id>/*.md
--    at runtime). document-catalog.js falls back to this table when no file
--    exists for (org_id, doc_type).
--
-- 2) org_kb — knowledge-base entries per org (notes, links, doc summaries).
--    Read by Grants agent into its system prompt at run time.
--
-- 3) org_kb_files — metadata for files uploaded to the 'org-kb' Supabase
--    Storage bucket. Bucket itself is created via supabase.storage API
--    (idempotent block at the bottom, run separately if needed).

create table if not exists org_templates (
  org_id text not null references orgs(id) on delete cascade,
  doc_type text not null,
  title text,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, doc_type)
);

create index if not exists idx_org_templates_org on org_templates(org_id);

create table if not exists org_kb (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references orgs(id) on delete cascade,
  kind text not null check (kind in ('note','link','file_summary')),
  title text not null,
  body text,
  url text,
  file_id uuid,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_kb_org on org_kb(org_id);
create index if not exists idx_org_kb_kind on org_kb(org_id, kind);

create table if not exists org_kb_files (
  id uuid primary key default gen_random_uuid(),
  org_id text not null references orgs(id) on delete cascade,
  filename text not null,
  mime_type text,
  size_bytes bigint,
  storage_path text not null,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_org_kb_files_org on org_kb_files(org_id);

-- grant_opportunities already exists; add columns for manually-added grants
-- and async research workflow.
alter table grant_opportunities
  add column if not exists source text default 'agent',
  add column if not exists research_status text default 'complete',
  add column if not exists research_started_at timestamptz,
  add column if not exists research_completed_at timestamptz,
  add column if not exists research_report jsonb,
  add column if not exists submitted_url text;

create index if not exists idx_grant_opps_research_status
  on grant_opportunities(research_status)
  where research_status in ('pending','running');

-- agent_tasks already exists; we just use a new task_type='grant_research'.
-- No schema change needed there.
