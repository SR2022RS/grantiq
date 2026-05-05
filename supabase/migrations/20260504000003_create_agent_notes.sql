create table if not exists agent_notes (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null check (agent_id in ('grants', 'playwright')),
  note text not null,
  tags text[] not null default '{}',
  confidence text not null check (confidence in ('low', 'medium', 'high')) default 'medium',
  source text,
  supersedes uuid references agent_notes(id),
  archived_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists agent_notes_tags_idx
  on agent_notes using gin (tags);
create index if not exists agent_notes_active_idx
  on agent_notes (agent_id, created_at desc) where archived_at is null;
