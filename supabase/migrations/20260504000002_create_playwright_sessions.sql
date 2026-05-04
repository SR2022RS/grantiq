create table if not exists playwright_sessions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid references grant_opportunities(id),
  draft_id uuid references application_drafts(id),
  org_id text not null,
  application_url text not null,
  form_type text,
  status text not null check (status in (
    'starting', 'in_progress', 'gated', 'awaiting_resume',
    'completed', 'failed', 'cancelled'
  )),
  current_step int default 0,
  total_steps int,
  state_json jsonb default '{}'::jsonb,
  screenshots jsonb default '[]'::jsonb,
  gate_reason text,
  gate_screenshot_url text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  result jsonb
);

create index if not exists playwright_sessions_status_idx
  on playwright_sessions (status, started_at desc);
create index if not exists playwright_sessions_grant_idx
  on playwright_sessions (grant_id);
