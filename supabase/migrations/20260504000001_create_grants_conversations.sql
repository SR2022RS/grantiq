create table if not exists grants_conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'web',
  user_chat_id text,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb
);

create table if not exists grants_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references grants_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null,
  tool_use_id text,
  created_at timestamptz not null default now()
);

create index if not exists grants_messages_conv_time_idx
  on grants_messages (conversation_id, created_at);

create index if not exists grants_conversations_chat_idx
  on grants_conversations (user_chat_id, last_message_at desc);
