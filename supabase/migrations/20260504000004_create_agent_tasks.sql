-- Cross-agent + cron task queue
-- to_agent='grants' is used by cron jobs (daily-discovery, deadline-check) that
--   queue work for the Grants agent rather than calling it inline.
-- to_agent='playwright' is used by the Grants agent's delegate_to_playwright tool.
create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  from_agent text not null,  -- 'grants', 'playwright', 'cron', or 'user'
  to_agent text not null check (to_agent in ('grants', 'playwright')),
  status text not null check (status in (
    'queued', 'claimed', 'in_progress', 'done', 'failed', 'gated'
  )) default 'queued',
  payload jsonb not null,
  result jsonb,
  alert_id uuid,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index if not exists agent_tasks_pending_idx
  on agent_tasks (to_agent, status, created_at) where status in ('queued', 'claimed');
