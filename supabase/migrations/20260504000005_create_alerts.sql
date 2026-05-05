create table if not exists alerts (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  severity text not null check (severity in ('info', 'warning', 'high', 'critical')),
  message text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists alerts_unread_idx
  on alerts (read_at, created_at desc) where read_at is null;
