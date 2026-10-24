-- GrantIQ: per-client upload links (additive). 2026-10-24
-- A client gets /u/<token>; the token maps to exactly one org.
-- Only the server (service role) reads or writes this table.
create table if not exists public.upload_links (
  id          uuid primary key default gen_random_uuid(),
  org_id      text not null references public.orgs(id) on delete cascade,
  token       text not null unique,
  label       text,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index if not exists upload_links_org_id_idx on public.upload_links(org_id);
alter table public.upload_links enable row level security;
revoke all on public.upload_links from anon, authenticated;
