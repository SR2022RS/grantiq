# GrantIQ Claude SDK Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire Railway + OpenClaw and migrate GrantIQ to a 2-agent (Grants + Playwright) Claude SDK architecture on Vercel, with full hard-cutover and rollback procedure.

**Architecture:** Vercel functions hosting two agents using `@anthropic-ai/sdk` directly (no agent framework, no gateway). Grants agent handles research and drafting via chat. Playwright agent handles browser-based form filling via Vercel Sandbox. Supabase is the persistence layer (existing project, additive schema). Reference implementation lifted from `~/Documents/GitHub/scout-vercel/` (STR PM Scout migrated to same pattern).

**Tech Stack:** Node.js 20+ (ESM), `@anthropic-ai/sdk` 0.90+, `@supabase/supabase-js` 2.49+, Vercel Functions, Vercel Sandbox (or Browserbase fallback), Playwright (browser automation), Vitest (test framework), Vercel cron.

**Spec:** `docs/superpowers/specs/2026-05-04-grantiq-claude-sdk-migration-design.md`

---

## Phase 0 — Pre-flight (snapshot + diagnose, no code changes)

### Task 0.1: Snapshot Railway state and env vars

**Files:**
- Create: `_archive/railway-snapshot-2026-05-04/`

- [ ] **Step 1: Re-authenticate Railway CLI**

```bash
railway login
```

Expected: browser opens, login completes, terminal shows authenticated user.

- [ ] **Step 2: Capture env vars (sanitized)**

```bash
mkdir -p _archive/railway-snapshot-2026-05-04
railway variables --kv > _archive/railway-snapshot-2026-05-04/env-keys.txt 2>&1 || echo "see error" > _archive/railway-snapshot-2026-05-04/env-keys.txt
```

Then manually edit `env-keys.txt` to redact secret values, keeping only KEY=<redacted> lines.

- [ ] **Step 3: Capture last 200 deploy log lines**

```bash
railway logs > _archive/railway-snapshot-2026-05-04/deploy-logs.txt 2>&1 || echo "logs unavailable" > _archive/railway-snapshot-2026-05-04/deploy-logs.txt
```

- [ ] **Step 4: Snapshot deployment metadata**

```bash
railway status > _archive/railway-snapshot-2026-05-04/status.txt 2>&1
```

- [ ] **Step 5: Commit snapshot**

```bash
git add _archive/railway-snapshot-2026-05-04/
git commit -m "chore: snapshot Railway state before SDK migration"
```

---

### Task 0.2: Investigate Railway 502 root cause (best-effort, time-boxed 30 min)

**Goal:** Per spec §10.6, capture the actual reason Railway has been 502'ing. If we can identify it, we avoid recurring on Vercel.

- [ ] **Step 1: Check Railway dashboard deploy logs**

Open https://railway.com/dashboard → grantiq-bot → most recent deployment → "Deploy Logs" tab. Read the last 50 lines of the most recent failed deploy.

Capture the error in `_archive/railway-snapshot-2026-05-04/502-postmortem.md` with format:

```markdown
# Railway 502 Postmortem

**Last successful deploy:** <commit sha + timestamp>
**First failing deploy:** <commit sha + timestamp>
**Root cause:** <one paragraph from the actual logs, OR "could not determine — logs were rotated/missing">
**Implication for Vercel migration:** <what we'll do differently>
```

- [ ] **Step 2: Verify env vars are still present on Railway**

In Railway dashboard → Variables tab, confirm these exist (don't view values):
- `TELEGRAM_TOKEN`
- `OPENROUTER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `OPEN_CLAW_COMPOSIO`

Note any missing in the postmortem doc.

- [ ] **Step 3: Commit the postmortem**

```bash
git add _archive/railway-snapshot-2026-05-04/502-postmortem.md
git commit -m "docs: capture Railway 502 root cause analysis"
```

> **If 30 min passes without identifying root cause:** stop here. Document "could not determine" and proceed to Phase 1. Do NOT attempt to fix Railway — we're retiring it.

---

### Task 0.3: Snapshot existing Supabase data

**Files:**
- Create: `_archive/supabase-snapshot-2026-05-04/`

- [ ] **Step 1: Export current grant data via REST**

```bash
mkdir -p _archive/supabase-snapshot-2026-05-04
SB_URL='https://zamokpkpneedvluthsem.supabase.co'
SB_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphbW9rcGtwbmVlZHZsdXRoc2VtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1ODM2OTEsImV4cCI6MjA5MTE1OTY5MX0.dLRU-LFZe_1q5383OVYMjpVX2bhbHHwco90kzY8MqI4'

for table in grant_opportunities application_drafts document_vault agents agent_activity_log deadline_alerts youtube_intel; do
  curl -s "${SB_URL}/rest/v1/${table}?limit=10000" \
    -H "apikey: ${SB_KEY}" -H "Authorization: Bearer ${SB_KEY}" \
    > "_archive/supabase-snapshot-2026-05-04/${table}.json"
done
```

- [ ] **Step 2: Verify each file is valid JSON and non-empty**

```bash
for f in _archive/supabase-snapshot-2026-05-04/*.json; do
  echo "$f: $(python3 -c "import json,sys; d=json.load(open('$f')); print(len(d) if isinstance(d,list) else 'object')")"
done
```

Expected output: each file shows a row count (or "object" if it's a single-row response).

- [ ] **Step 3: Commit**

```bash
git add _archive/supabase-snapshot-2026-05-04/
git commit -m "chore: snapshot Supabase data before SDK migration"
```

**▶ PHASE 0 CHECKPOINT:** Railway state captured, 502 cause documented (or accepted unknown), Supabase data snapshotted. No production changes yet. Ready to scaffold new code.

---

## Phase 1 — Repo + Vercel project setup

### Task 1.1: Restructure repo for Vercel functions + tests

**Files:**
- Create: `api/`, `src/`, `workspace/`, `tests/`, `supabase/migrations/`
- Move: `dashboard/*.html` → root `public/` (Vercel will serve from there)

- [ ] **Step 1: Create new directories**

```bash
mkdir -p api/grants api/playwright api/cron api/alerts
mkdir -p src/agents/grants src/agents/playwright src/lib src/tools/{shared,grants,playwright}
mkdir -p workspace tests/{unit,integration}
mkdir -p supabase/migrations
mkdir -p public
```

- [ ] **Step 2: Move dashboard HTML to public/**

```bash
git mv dashboard/index.html public/index.html
git mv dashboard/k1-upload.html public/k1-upload.html
git mv dashboard/holigenix-upload.html public/holigenix-upload.html
rmdir dashboard
```

- [ ] **Step 3: Verify file moves**

```bash
ls public/ && ls api/ && ls src/
```

Expected: `public/` has 3 HTML files; `api/` has 4 subdirs; `src/` has agents/, lib/, tools/.

- [ ] **Step 4: Commit restructure**

```bash
git add -A
git commit -m "refactor: restructure repo for Vercel functions + tests"
```

---

### Task 1.2: New package.json with Vercel-compatible deps

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace package.json**

```json
{
  "name": "grantiq-vercel",
  "version": "2.0.0",
  "description": "GrantIQ — AI grant research + application agents on Vercel",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "vercel dev",
    "lint": "node --check src/lib/supabase.js && node --check src/lib/anthropic-client.js && node --check src/lib/memory.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "smoke": "node scripts/smoke.mjs"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.90.0",
    "@supabase/supabase-js": "^2.49.0",
    "playwright-core": "^1.50.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "vercel": "^48.0.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install**

```bash
rm -f package-lock.json
rm -rf node_modules
npm install
```

Expected: installs without errors. `node_modules/` populated. New `package-lock.json` written.

- [ ] **Step 3: Verify ESM works**

```bash
node -e "import('@anthropic-ai/sdk').then(m => console.log('Anthropic SDK loaded:', typeof m.default))"
```

Expected: `Anthropic SDK loaded: function`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: rewrite package.json for Vercel + Anthropic SDK + Vitest"
```

---

### Task 1.3: vercel.json with cron config and routing

**Files:**
- Create: `vercel.json`

- [ ] **Step 1: Write vercel.json**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": null,
  "framework": null,
  "outputDirectory": "public",
  "functions": {
    "api/**/*.js": {
      "runtime": "nodejs20.x",
      "memory": 1024,
      "maxDuration": 60
    },
    "api/playwright/start.js": {
      "runtime": "nodejs20.x",
      "memory": 2048,
      "maxDuration": 300
    },
    "api/playwright/resume.js": {
      "runtime": "nodejs20.x",
      "memory": 2048,
      "maxDuration": 300
    }
  },
  "crons": [
    {
      "path": "/api/cron/process-tasks",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/cron/daily-discovery",
      "schedule": "0 12 * * *"
    },
    {
      "path": "/api/cron/deadline-check",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

- [ ] **Step 2: Validate JSON**

```bash
python3 -m json.tool vercel.json > /dev/null && echo "valid"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add vercel.json
git commit -m "chore: add vercel.json with cron schedule"
```

---

### Task 1.4: .env.example + .gitignore updates

**Files:**
- Create: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Write .env.example**

```
# Anthropic
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4-6

# Supabase (service role — server-side only)
SUPABASE_URL=https://zamokpkpneedvluthsem.supabase.co
SUPABASE_SERVICE_ROLE_KEY=

# Optional fallback
OPENROUTER_API_KEY=

# External tools
PERPLEXITY_API_KEY=
YOUTUBE_API_KEY=

# Email (Gmail OAuth)
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REFRESH_TOKEN=

# Vercel cron auth
CRON_SECRET=

# Vercel Sandbox (for Playwright)
VERCEL_SANDBOX_TOKEN=

# Org IDs (used by tools)
HOLIGENIX_UEI=NNR7S596R4K9
K1_UEI=
OWNER_NONPROFIT_UEI=
```

- [ ] **Step 2: Append to .gitignore**

```bash
cat >> .gitignore <<'EOF'

# Vercel
.vercel/
.env
.env.local
.env.*.local

# Test artifacts
coverage/
.vitest-cache/
EOF
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add .env.example and Vercel/test gitignore entries"
```

---

### Task 1.5: Confirm dashboard still serves

**Goal:** Make sure the static HTML restructure didn't break the existing portal.

- [ ] **Step 1: Run vercel dev locally**

```bash
npx vercel dev --yes --listen 3000
```

(Background; takes ~5-10s to start.)

- [ ] **Step 2: Verify each page loads**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/k1-upload.html
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/holigenix-upload.html
```

Expected: three `200` responses.

- [ ] **Step 3: Stop vercel dev**

Kill the background process.

- [ ] **Step 4: Smoke check is intentional only — no commit**

**▶ PHASE 1 CHECKPOINT:** Repo restructured, package.json + vercel.json in place, dashboard still serves. No agent code yet.

---

## Phase 2 — Supabase migrations (7 new objects)

### Task 2.1: Create migration files for all new tables

**Files:**
- Create: `supabase/migrations/20260504000001_create_grants_conversations.sql`
- Create: `supabase/migrations/20260504000002_create_playwright_sessions.sql`
- Create: `supabase/migrations/20260504000003_create_agent_notes.sql`
- Create: `supabase/migrations/20260504000004_create_agent_tasks.sql`
- Create: `supabase/migrations/20260504000005_create_alerts.sql`
- Create: `supabase/migrations/20260504000006_create_orgs.sql`
- Create: `supabase/migrations/20260504000007_create_agent_context_view.sql`

- [ ] **Step 1: Write migration 1 — grants_conversations + grants_messages**

`supabase/migrations/20260504000001_create_grants_conversations.sql`:

```sql
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
```

- [ ] **Step 2: Write migration 2 — playwright_sessions**

`supabase/migrations/20260504000002_create_playwright_sessions.sql`:

```sql
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
```

- [ ] **Step 3: Write migration 3 — agent_notes**

`supabase/migrations/20260504000003_create_agent_notes.sql`:

```sql
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
```

- [ ] **Step 4: Write migration 4 — agent_tasks**

`supabase/migrations/20260504000004_create_agent_tasks.sql`:

```sql
create table if not exists agent_tasks (
  id uuid primary key default gen_random_uuid(),
  from_agent text not null,
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
```

- [ ] **Step 5: Write migration 5 — alerts**

`supabase/migrations/20260504000005_create_alerts.sql`:

```sql
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
```

- [ ] **Step 6: Write migration 6 — orgs**

`supabase/migrations/20260504000006_create_orgs.sql`:

```sql
create table if not exists orgs (
  id text primary key,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

- [ ] **Step 7: Write migration 7 — agent_context_v view**

`supabase/migrations/20260504000007_create_agent_context_view.sql`:

```sql
create or replace view agent_context_v as
select
  o.id as org_id,
  o.name as org_name,
  o.data as org_profile,
  (
    select jsonb_build_object(
      'total', count(*),
      'uploaded', count(*) filter (where status = 'uploaded'),
      'missing_list', coalesce(
        jsonb_agg(jsonb_build_object('doc_name', doc_name, 'required_for', required_for))
          filter (where status = 'missing'),
        '[]'::jsonb
      )
    )
    from document_vault dv
    where dv.org_id = o.id
  ) as documents,
  (
    select jsonb_agg(
      jsonb_build_object(
        'id', g.id,
        'name', g.name,
        'amount', g.amount,
        'deadline', g.deadline,
        'match_score', g.match_score,
        'status', g.status
      )
      order by g.match_score desc nulls last
    )
    from (
      select * from grant_opportunities
      where org_id = o.id and status not in ('expired', 'rejected', 'skipped')
      order by match_score desc nulls last
      limit 5
    ) g
  ) as top_grants,
  (
    select jsonb_agg(
      jsonb_build_object('id', id, 'name', name, 'deadline', deadline)
      order by deadline asc
    )
    from grant_opportunities
    where org_id = o.id
      and deadline is not null
      and deadline::date between current_date and current_date + 30
      and status not in ('expired', 'rejected', 'skipped')
  ) as upcoming_deadlines
from orgs o;
```

- [ ] **Step 8: Commit migrations**

```bash
git add supabase/migrations/
git commit -m "feat(db): add migrations for grants_conversations, playwright_sessions, agent_notes, agent_tasks, alerts, orgs, and agent_context view"
```

---

### Task 2.2: Apply migrations to production Supabase

**Goal:** Run all 7 migration files against the live Supabase project. They're additive (no destructive changes).

- [ ] **Step 1: Apply migration 1 via Supabase MCP or SQL Editor**

Open https://supabase.com/dashboard/project/zamokpkpneedvluthsem/sql/new

Paste contents of `supabase/migrations/20260504000001_create_grants_conversations.sql`. Click "Run".

Expected: success message; no rows returned.

- [ ] **Step 2-7: Apply migrations 2 through 7 in order**

Repeat Step 1 for each of `_create_playwright_sessions.sql` through `_create_agent_context_view.sql`. Apply in numeric order.

- [ ] **Step 8: Verify all tables exist**

In SQL editor, run:

```sql
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'grants_conversations', 'grants_messages', 'playwright_sessions',
    'agent_notes', 'agent_tasks', 'alerts', 'orgs'
  )
order by table_name;
```

Expected: 7 rows returned.

- [ ] **Step 9: Verify view exists**

```sql
select table_name from information_schema.views
where table_schema = 'public' and table_name = 'agent_context_v';
```

Expected: 1 row.

---

### Task 2.3: Migrate org profiles from index.js to orgs table

**Files:**
- Create: `scripts/migrate-orgs.mjs`

- [ ] **Step 1: Write the migration script**

`scripts/migrate-orgs.mjs`:

```javascript
// One-shot migration: extract orgs from legacy index.js and insert into orgs table.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Read legacy index.js — extract the ORGS array via dynamic eval-style import.
  // This file currently lives at repo root.
  const legacyPath = resolve(__dirname, '..', 'index.js');
  const legacy = readFileSync(legacyPath, 'utf8');

  // ORGS is a top-level const array. Find its boundaries.
  const startMatch = legacy.match(/const\s+ORGS\s*=\s*\[/);
  if (!startMatch) {
    console.error('Could not locate ORGS array in index.js');
    process.exit(1);
  }
  const startIdx = startMatch.index + startMatch[0].length - 1; // position of opening [

  // Walk forward, tracking bracket depth, until we find the matching closing ].
  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < legacy.length; i++) {
    const ch = legacy[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) { endIdx = i + 1; break; }
    }
  }
  if (endIdx === -1) {
    console.error('Could not find end of ORGS array');
    process.exit(1);
  }

  const orgsLiteral = legacy.slice(startIdx, endIdx);
  // eval is safe here because we control the source file (index.js is in our repo).
  // eslint-disable-next-line no-eval
  const ORGS = eval(`(${orgsLiteral})`);
  console.log(`Extracted ${ORGS.length} orgs:`, ORGS.map((o) => o.id));

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const org of ORGS) {
    const row = {
      id: org.id,
      name: org.name,
      data: org,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('orgs').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error(`Failed to upsert org ${org.id}:`, error.message);
      process.exit(1);
    }
    console.log(`✓ Upserted ${org.id}`);
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Set env vars and run migration**

```bash
export SUPABASE_URL='https://zamokpkpneedvluthsem.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<your_service_role_key>'  # from Railway snapshot
node scripts/migrate-orgs.mjs
```

Expected output:
```
Extracted 3 orgs: [ 'holigenix_healthcare', 'k1_management', 'owner_nonprofit' ]
✓ Upserted holigenix_healthcare
✓ Upserted k1_management
✓ Upserted owner_nonprofit
Done.
```

- [ ] **Step 3: Verify in Supabase**

In SQL editor:
```sql
select id, name, jsonb_array_length(data->'certifications') as cert_count from orgs;
```

Expected: 3 rows.

- [ ] **Step 4: Commit script**

```bash
git add scripts/migrate-orgs.mjs
git commit -m "feat(db): one-shot script to migrate org profiles from index.js to orgs table"
```

**▶ PHASE 2 CHECKPOINT:** All 7 new tables + view exist in production Supabase. Org data migrated. No app code yet, but DB is ready.

---

## Phase 3 — Core libraries (TDD where applicable)

### Task 3.1: Constants and env validation

**Files:**
- Create: `src/lib/constants.js`
- Create: `tests/unit/constants.test.js`

- [ ] **Step 1: Write the failing test**

`tests/unit/constants.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MODEL, MAX_TOKENS, MAX_TOOL_ITERATIONS, RETRY_STATUSES, assertRequiredEnv } from '../../src/lib/constants.js';

describe('constants', () => {
  it('MODEL defaults to claude-sonnet-4-6', () => {
    expect(MODEL).toBe(process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6');
  });

  it('MAX_TOKENS is a positive integer', () => {
    expect(Number.isInteger(MAX_TOKENS) && MAX_TOKENS > 0).toBe(true);
  });

  it('MAX_TOOL_ITERATIONS defaults to 8', () => {
    expect(MAX_TOOL_ITERATIONS).toBeGreaterThan(0);
  });

  it('RETRY_STATUSES includes 429 and 529', () => {
    expect(RETRY_STATUSES.has(429)).toBe(true);
    expect(RETRY_STATUSES.has(529)).toBe(true);
  });

  describe('assertRequiredEnv', () => {
    let saved;
    beforeEach(() => { saved = { ...process.env }; });
    afterEach(() => { process.env = saved; });

    it('throws when ANTHROPIC_API_KEY is missing', () => {
      delete process.env.ANTHROPIC_API_KEY;
      expect(() => assertRequiredEnv()).toThrow(/ANTHROPIC_API_KEY/);
    });

    it('throws when SUPABASE_URL is missing', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      delete process.env.SUPABASE_URL;
      expect(() => assertRequiredEnv()).toThrow(/SUPABASE_URL/);
    });

    it('passes when all required are set', () => {
      process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
      process.env.SUPABASE_URL = 'https://test.supabase.co';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'eyJ-test';
      expect(() => assertRequiredEnv()).not.toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test (expect fail)**

```bash
npx vitest run tests/unit/constants.test.js
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement constants.js**

`src/lib/constants.js`:

```javascript
export const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
export const MAX_TOKENS = parseInt(process.env.GRANTIQ_MAX_TOKENS || '4096', 10);
export const MAX_TOOL_ITERATIONS = parseInt(process.env.GRANTIQ_MAX_TOOL_ITERATIONS || '8', 10);

export const RETRY_STATUSES = new Set([429, 529, 500, 502, 503, 504]);
export const RETRY_BACKOFF_MS = [1000, 2000, 4000];

export const REQUIRED_ENV = [
  'ANTHROPIC_API_KEY',
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
];

export function assertRequiredEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`[grantiq] missing required env vars: ${missing.join(', ')}`);
  }
}

export const CONVERSATION_SUMMARIZATION_THRESHOLD_TOKENS = 100_000;
```

- [ ] **Step 4: Run test (expect pass)**

```bash
npx vitest run tests/unit/constants.test.js
```

Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants.js tests/unit/constants.test.js
git commit -m "feat(lib): add constants module with env assertions"
```

---

### Task 3.2: Supabase client wrapper

**Files:**
- Create: `src/lib/supabase.js`
- Create: `tests/unit/supabase.test.js`

- [ ] **Step 1: Write the failing test**

`tests/unit/supabase.test.js`:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSupabase, resetSupabase } from '../../src/lib/supabase.js';

describe('supabase wrapper', () => {
  let saved;
  beforeEach(() => {
    saved = { ...process.env };
    resetSupabase();
  });
  afterEach(() => { process.env = saved; resetSupabase(); });

  it('throws when SUPABASE_URL is missing', () => {
    delete process.env.SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    expect(() => getSupabase()).toThrow(/SUPABASE_URL/);
  });

  it('throws when SUPABASE_SERVICE_ROLE_KEY is missing', () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getSupabase()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('returns same instance on repeated calls (memoized)', () => {
    process.env.SUPABASE_URL = 'https://x.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    const a = getSupabase();
    const b = getSupabase();
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run (fail)**

```bash
npx vitest run tests/unit/supabase.test.js
```

- [ ] **Step 3: Implement**

`src/lib/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabase() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('[supabase] SUPABASE_URL missing');
  if (!key) throw new Error('[supabase] SUPABASE_SERVICE_ROLE_KEY missing');
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

export function resetSupabase() {
  client = null;
}
```

- [ ] **Step 4: Run test (pass)**

```bash
npx vitest run tests/unit/supabase.test.js
```

Expected: 3 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.js tests/unit/supabase.test.js
git commit -m "feat(lib): add memoized Supabase service-role client"
```

---

### Task 3.3: Tool-use loop (lift + adapt from scout-vercel)

**Files:**
- Create: `src/lib/anthropic-client.js`

- [ ] **Step 1: Copy scout-vercel's client.js verbatim, then adapt**

`src/lib/anthropic-client.js`:

```javascript
// =============================================================================
// GrantIQ — Anthropic SDK wrapper + tool-use loop
// =============================================================================
// Lifted from scout-vercel/src/agent/client.js with renamed factory.
// Single entry point: createGrantIQClient({ apiKey, dispatch }).run({ system, messages, tools })

import Anthropic from '@anthropic-ai/sdk';
import {
  MODEL,
  MAX_TOKENS,
  MAX_TOOL_ITERATIONS,
  RETRY_STATUSES,
  RETRY_BACKOFF_MS,
} from './constants.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err) {
  const status = err?.status ?? err?.response?.status;
  return status ? RETRY_STATUSES.has(status) : false;
}

async function callWithRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_BACKOFF_MS.length; attempt++) {
    if (attempt > 0) await sleep(RETRY_BACKOFF_MS[attempt - 1]);
    try { return await fn(); }
    catch (err) { lastErr = err; if (!isRetryable(err)) throw err; }
  }
  throw lastErr;
}

export function createGrantIQClient({ apiKey = process.env.ANTHROPIC_API_KEY, dispatch } = {}) {
  if (!apiKey) throw new Error('[grantiq/client] ANTHROPIC_API_KEY missing');
  if (typeof dispatch !== 'function') {
    throw new Error('[grantiq/client] dispatch(name, input) callback required');
  }

  const client = new Anthropic({ apiKey, maxRetries: 0, timeout: 120_000 });

  async function run({ system, messages, tools = [] }) {
    const startAll = Date.now();
    const telemetry = {
      iterations: 0,
      tokens_in: 0,
      tokens_out: 0,
      tokens_cache_read: 0,
      tokens_cache_write: 0,
      tools_invoked: [],
      latency_ms: 0,
    };

    const workingMessages = Array.isArray(messages) ? [...messages] : [];
    let finalText = '';
    let lastStopReason = null;

    for (let iter = 0; iter < MAX_TOOL_ITERATIONS; iter++) {
      telemetry.iterations = iter + 1;

      const response = await callWithRetry(() =>
        client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          tools,
          messages: workingMessages,
        })
      );

      const usage = response.usage || {};
      telemetry.tokens_in += usage.input_tokens || 0;
      telemetry.tokens_out += usage.output_tokens || 0;
      telemetry.tokens_cache_read += usage.cache_read_input_tokens || 0;
      telemetry.tokens_cache_write += usage.cache_creation_input_tokens || 0;

      workingMessages.push({ role: 'assistant', content: response.content });

      const textBlocks = response.content.filter((b) => b.type === 'text');
      finalText = textBlocks.map((b) => b.text).join('\n\n').trim();
      lastStopReason = response.stop_reason;

      const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use');
      if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
        telemetry.latency_ms = Date.now() - startAll;
        return {
          text: finalText,
          messages: workingMessages,
          stop_reason: lastStopReason,
          telemetry,
          status: 'success',
        };
      }

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          const t0 = Date.now();
          let ok = true;
          let out;
          let errMsg;
          try { out = await dispatch(block.name, block.input); }
          catch (e) {
            ok = false;
            errMsg = e?.message || String(e);
            out = { error: errMsg };
          }
          telemetry.tools_invoked.push({
            name: block.name,
            input: block.input,
            ok,
            latency_ms: Date.now() - t0,
            ...(errMsg ? { error: errMsg } : {}),
          });
          return {
            type: 'tool_result',
            tool_use_id: block.id,
            content: typeof out === 'string' ? out : JSON.stringify(out),
            is_error: !ok,
          };
        })
      );

      workingMessages.push({ role: 'user', content: toolResults });
    }

    telemetry.latency_ms = Date.now() - startAll;
    return {
      text: finalText || '(reached max tool iterations without a final answer)',
      messages: workingMessages,
      stop_reason: 'max_iterations',
      telemetry,
      status: 'partial',
    };
  }

  return { run };
}
```

- [ ] **Step 2: Verify ESM loads**

```bash
node --check src/lib/anthropic-client.js
```

Expected: no output (success).

- [ ] **Step 3: Commit**

```bash
git add src/lib/anthropic-client.js
git commit -m "feat(lib): add tool-use loop lifted from scout-vercel"
```

---

### Task 3.4: Memory layer (conversations + messages)

**Files:**
- Create: `src/lib/memory.js`

- [ ] **Step 1: Implement memory module**

`src/lib/memory.js`:

```javascript
// =============================================================================
// GrantIQ — agent conversation memory (Supabase-backed)
// =============================================================================
// Adapted from scout-vercel/src/agent/memory.js. Per-agent table prefix:
//   <AGENT_NAME>_conversations, <AGENT_NAME>_messages

import { getSupabase } from './supabase.js';

function tables(agentName) {
  return {
    conv: `${agentName}_conversations`,
    msg: `${agentName}_messages`,
  };
}

export async function loadOrCreateConversation({
  agentName,
  channel = 'web',
  userChatId = null,
} = {}) {
  if (!agentName) throw new Error('[memory] agentName required');
  const supabase = getSupabase();
  const t = tables(agentName);

  if (userChatId) {
    const { data: convs, error } = await supabase
      .from(t.conv)
      .select('*')
      .eq('channel', channel)
      .eq('user_chat_id', userChatId)
      .order('last_message_at', { ascending: false })
      .limit(1);
    if (error) throw new Error(`[memory] loadConversation: ${error.message}`);
    if (convs && convs.length) {
      const conv = convs[0];
      const messages = await loadMessages(agentName, conv.id);
      return { conversation: conv, messages };
    }
  }

  const { data: created, error: createErr } = await supabase
    .from(t.conv)
    .insert({ channel, user_chat_id: userChatId })
    .select('*')
    .single();
  if (createErr) throw new Error(`[memory] createConversation: ${createErr.message}`);
  return { conversation: created, messages: [] };
}

async function loadMessages(agentName, conversationId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from(tables(agentName).msg)
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`[memory] loadMessages: ${error.message}`);
  return (data || []).map((row) => ({ role: row.role, content: row.content }));
}

export async function persistTurn({
  agentName,
  conversationId,
  priorMessageCount,
  messages,
}) {
  const supabase = getSupabase();
  const t = tables(agentName);
  const newOnes = messages.slice(priorMessageCount);
  if (newOnes.length === 0) return;

  const rows = newOnes.map((msg) => ({
    conversation_id: conversationId,
    role: msg.role,
    content: msg.content,
    tool_use_id: firstToolId(msg.content),
  }));

  const { error } = await supabase.from(t.msg).insert(rows);
  if (error) {
    console.error(`[memory] insert ${t.msg} failed:`, error.message);
    return;
  }

  await supabase
    .from(t.conv)
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId);
}

function firstToolId(content) {
  if (!Array.isArray(content)) return null;
  for (const block of content) {
    if (block?.type === 'tool_use') return block.id || null;
    if (block?.type === 'tool_result') return block.tool_use_id || null;
  }
  return null;
}

export function appendUserText(priorMessages, text) {
  return [...priorMessages, { role: 'user', content: text }];
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check src/lib/memory.js
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/memory.js
git commit -m "feat(lib): add per-agent conversation memory module"
```

---

### Task 3.5: Workspace persona loader

**Files:**
- Create: `src/lib/workspace.js`
- Create: `workspace/grants.md` (placeholder — full content in Task 5.1)
- Create: `workspace/playwright.md` (placeholder — full content in Task 6.4)

- [ ] **Step 1: Write placeholder persona files**

`workspace/grants.md`:
```markdown
# Grants Agent — Placeholder

(Full persona written in Task 5.1)
```

`workspace/playwright.md`:
```markdown
# Playwright Agent — Placeholder

(Full persona written in Task 6.4)
```

- [ ] **Step 2: Implement workspace loader**

`src/lib/workspace.js`:

```javascript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIR = resolve(__dirname, '..', '..', 'workspace');

const cache = new Map();

export function loadPersona(agentName) {
  if (cache.has(agentName)) return cache.get(agentName);
  const path = resolve(WORKSPACE_DIR, `${agentName}.md`);
  const content = readFileSync(path, 'utf8');
  cache.set(agentName, content);
  return content;
}

export function clearPersonaCache() { cache.clear(); }
```

- [ ] **Step 3: Syntax check + smoke test**

```bash
node --check src/lib/workspace.js
node --input-type=module -e "import { loadPersona } from './src/lib/workspace.js'; console.log(loadPersona('grants').slice(0, 50));"
```

Expected: prints first 50 chars of `workspace/grants.md`.

- [ ] **Step 4: Commit**

```bash
git add src/lib/workspace.js workspace/grants.md workspace/playwright.md
git commit -m "feat(lib): add workspace persona file loader"
```

---

### Task 3.6: Layer 2 + Layer 3 context loader

**Files:**
- Create: `src/lib/agent-context.js`

- [ ] **Step 1: Implement context loader**

`src/lib/agent-context.js`:

```javascript
// =============================================================================
// GrantIQ — Layer 2 (project facts) + Layer 3 (agent notes) loader
// =============================================================================
// Called once per chat turn. Returns a Markdown block to inject into the
// system prompt below the static persona.

import { getSupabase } from './supabase.js';

const NOTES_LOAD_LIMIT = 20;

export async function loadProjectContext({ agentName, queryKeywords = [] } = {}) {
  const supabase = getSupabase();

  // Layer 2: project facts via the agent_context_v view
  const { data: ctxRows, error: ctxErr } = await supabase
    .from('agent_context_v')
    .select('*');
  if (ctxErr) throw new Error(`[context] agent_context_v: ${ctxErr.message}`);

  // Layer 3: relevant notes — top N by tag match + recency
  let notesQuery = supabase
    .from('agent_notes')
    .select('id, agent_id, note, tags, confidence, created_at')
    .is('archived_at', null)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(NOTES_LOAD_LIMIT * 3); // overfetch, filter client-side by tag relevance
  const { data: rawNotes, error: notesErr } = await notesQuery;
  if (notesErr) throw new Error(`[context] agent_notes: ${notesErr.message}`);

  const notes = rankNotes(rawNotes || [], queryKeywords).slice(0, NOTES_LOAD_LIMIT);

  return renderContext({ ctxRows, notes });
}

function rankNotes(notes, keywords) {
  if (!keywords || keywords.length === 0) return notes;
  const kw = keywords.map((k) => k.toLowerCase());
  return [...notes].sort((a, b) => {
    const aScore = scoreNote(a, kw);
    const bScore = scoreNote(b, kw);
    if (aScore !== bScore) return bScore - aScore;
    return new Date(b.created_at) - new Date(a.created_at);
  });
}

function scoreNote(note, kw) {
  const tagText = (note.tags || []).join(' ').toLowerCase();
  const noteText = (note.note || '').toLowerCase();
  let score = 0;
  for (const k of kw) {
    if (tagText.includes(k)) score += 3;
    if (noteText.includes(k)) score += 1;
  }
  if (note.confidence === 'high') score += 1;
  return score;
}

function renderContext({ ctxRows, notes }) {
  const orgs = (ctxRows || []).map((r) => ({
    org_id: r.org_id,
    name: r.org_name,
    profile_summary: summarizeProfile(r.org_profile),
    documents: r.documents,
    top_grants: r.top_grants,
    upcoming_deadlines: r.upcoming_deadlines,
  }));

  const lines = ['## Live project context (refreshed every turn)'];
  for (const org of orgs) {
    lines.push(`\n### ${org.name} (${org.org_id})`);
    lines.push(org.profile_summary);
    if (org.documents) {
      lines.push(`**Documents:** ${org.documents.uploaded}/${org.documents.total} uploaded.`);
      const missingList = (org.documents.missing_list || []).slice(0, 5);
      if (missingList.length) {
        lines.push(`Missing (top 5): ${missingList.map((m) => m.doc_name).join('; ')}`);
      }
    }
    if (org.top_grants && org.top_grants.length) {
      lines.push(`**Top grants:**`);
      for (const g of org.top_grants) {
        lines.push(`- ${g.name} (${g.match_score}% match, ${g.amount}, due ${g.deadline || 'n/a'}, ${g.status})`);
      }
    }
    if (org.upcoming_deadlines && org.upcoming_deadlines.length) {
      lines.push(`**Deadlines (next 30 days):** ${org.upcoming_deadlines.length}`);
    }
  }

  if (notes.length) {
    lines.push(`\n## Learned notes (Layer 3, top ${notes.length} by relevance)`);
    for (const n of notes) {
      lines.push(`- [${n.confidence}] ${n.note} (tags: ${(n.tags || []).join(', ')})`);
    }
  }

  return lines.join('\n');
}

function summarizeProfile(p) {
  if (!p) return '';
  const bits = [
    p.legalStructure,
    p.orgType,
    p.regions,
    p.uei ? `UEI ${p.uei}` : null,
    p.cage ? `CAGE ${p.cage}` : null,
    p.npi ? `NPI ${p.npi}` : null,
  ].filter(Boolean);
  const certs = (p.certifications || []).slice(0, 5).join(', ');
  return `${bits.join(' • ')}${certs ? `\nCertifications: ${certs}` : ''}`;
}
```

- [ ] **Step 2: Syntax check**

```bash
node --check src/lib/agent-context.js
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/agent-context.js
git commit -m "feat(lib): add Layer 2 + Layer 3 context loader"
```

---

### Task 3.7: Audit log + alerts helpers

**Files:**
- Create: `src/lib/audit.js`
- Create: `src/lib/alerts.js`

- [ ] **Step 1: Implement audit logger**

`src/lib/audit.js`:

```javascript
import { getSupabase } from './supabase.js';

export async function logAgentActivity({ agentId, action, detail, metadata = {} } = {}) {
  try {
    const supabase = getSupabase();
    await supabase.from('agent_activity_log').insert({
      agent_id: agentId,
      action,
      detail: detail || '',
      metadata,
    });
  } catch (e) {
    console.error('[audit] logAgentActivity failed:', e?.message || e);
  }
}
```

- [ ] **Step 2: Implement alerts helper**

`src/lib/alerts.js`:

```javascript
import { getSupabase } from './supabase.js';

export async function postAlert({ agentId, severity, message, link }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alerts')
    .insert({ agent_id: agentId, severity, message, link: link || null })
    .select('id')
    .single();
  if (error) throw new Error(`[alerts] post: ${error.message}`);
  return data.id;
}

export async function listUnreadAlerts(limit = 50) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('alerts')
    .select('id, agent_id, severity, message, link, created_at')
    .is('read_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`[alerts] list: ${error.message}`);
  return data || [];
}

export async function markAlertRead(id) {
  const supabase = getSupabase();
  const { error } = await supabase
    .from('alerts')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(`[alerts] markRead: ${error.message}`);
}
```

- [ ] **Step 3: Syntax check**

```bash
node --check src/lib/audit.js && node --check src/lib/alerts.js
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/audit.js src/lib/alerts.js
git commit -m "feat(lib): add audit log and alerts helpers"
```

**▶ PHASE 3 CHECKPOINT:** Core libraries in place: constants, Supabase client, Anthropic tool-use loop, memory, workspace loader, context loader, audit, alerts. All have basic tests or syntax checks. No agent yet.

---

## Phase 4 — Tools (organized by category)

### Task 4.1: Shared tools (record_note, alert_user)

**Files:**
- Create: `src/tools/shared/record-note.js`
- Create: `src/tools/shared/alert-user.js`
- Create: `src/tools/shared/index.js`

- [ ] **Step 1: Implement record_note**

`src/tools/shared/record-note.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const recordNoteSchema = {
  name: 'record_note',
  description: 'Persist a learned fact (Layer 3 memory). Use when you discover a non-obvious insight that will help future work — agency reviewer preferences, form quirks, eligibility nuances. Do NOT record facts already in the org profile or trivially Google-able.',
  input_schema: {
    type: 'object',
    properties: {
      note: { type: 'string', description: 'The fact to record' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Tags for retrieval' },
      confidence: { type: 'string', enum: ['low', 'medium', 'high'], description: 'How confident you are' },
      source: { type: 'string', description: 'Optional reference (conversation_id, session_id, etc.)' },
      supersedes: { type: 'string', description: 'Optional UUID of a note this replaces' },
    },
    required: ['note', 'tags', 'confidence'],
  },
};

export function makeRecordNote(agentId) {
  return async function recordNote({ note, tags, confidence, source, supersedes }) {
    const supabase = getSupabase();

    if (supersedes) {
      await supabase
        .from('agent_notes')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', supersedes);
    }

    const { data, error } = await supabase
      .from('agent_notes')
      .insert({
        agent_id: agentId,
        note,
        tags: tags || [],
        confidence: confidence || 'medium',
        source: source || null,
        supersedes: supersedes || null,
      })
      .select('id')
      .single();
    if (error) return { ok: false, error: error.message };
    return { ok: true, note_id: data.id };
  };
}
```

- [ ] **Step 2: Implement alert_user**

`src/tools/shared/alert-user.js`:

```javascript
import { postAlert } from '../../lib/alerts.js';

export const alertUserSchema = {
  name: 'alert_user',
  description: 'Send the user a notification. Use for urgent deadlines, completed drafts, gated form-fill sessions, or anything requiring user action.',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      severity: { type: 'string', enum: ['info', 'warning', 'high', 'critical'] },
      link: { type: 'string', description: 'Optional URL to deep-link from the alert' },
    },
    required: ['message', 'severity'],
  },
};

export function makeAlertUser(agentId) {
  return async function alertUser({ message, severity, link }) {
    try {
      const id = await postAlert({ agentId, severity, message, link });
      return { ok: true, alert_id: id };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  };
}
```

- [ ] **Step 3: Index file**

`src/tools/shared/index.js`:

```javascript
export { recordNoteSchema, makeRecordNote } from './record-note.js';
export { alertUserSchema, makeAlertUser } from './alert-user.js';
```

- [ ] **Step 4: Syntax check + commit**

```bash
node --check src/tools/shared/record-note.js
node --check src/tools/shared/alert-user.js
node --check src/tools/shared/index.js
git add src/tools/shared/
git commit -m "feat(tools): add shared record_note and alert_user tools"
```

---

### Task 4.2: Grants discovery tools (web_search, fetch_webpage, query_pipeline, save_grant)

**Files:**
- Create: `src/tools/grants/web-search.js`
- Create: `src/tools/grants/fetch-webpage.js`
- Create: `src/tools/grants/query-pipeline.js`
- Create: `src/tools/grants/save-grant.js`

- [ ] **Step 1: web_search via Perplexity**

`src/tools/grants/web-search.js`:

```javascript
export const webSearchSchema = {
  name: 'web_search',
  description: 'Search the web via Perplexity. Returns AI-synthesized answer + citations. Use for grant discovery, agency research, deadline verification.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      max_results: { type: 'number', description: 'Default 5' },
    },
    required: ['query'],
  },
};

export async function webSearch({ query, max_results = 5 }) {
  const key = process.env.PERPLEXITY_API_KEY;
  if (!key) return { ok: false, error: 'PERPLEXITY_API_KEY not set' };

  const res = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'sonar',
      messages: [{ role: 'user', content: query }],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    return { ok: false, error: `Perplexity ${res.status}: ${errText.slice(0, 200)}` };
  }
  const data = await res.json();
  return {
    ok: true,
    answer: data?.choices?.[0]?.message?.content || '',
    citations: (data?.citations || []).slice(0, max_results),
  };
}
```

- [ ] **Step 2: fetch_webpage**

`src/tools/grants/fetch-webpage.js`:

```javascript
export const fetchWebpageSchema = {
  name: 'fetch_webpage',
  description: 'Fetch a webpage and return its text content (HTML stripped). Use to read grant detail pages, agency announcements, deadlines.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      max_chars: { type: 'number', description: 'Default 8000' },
    },
    required: ['url'],
  },
};

export async function fetchWebpage({ url, max_chars = 8000 }) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 GrantIQ/2.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const html = await res.text();
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max_chars);
    return { ok: true, url, text };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
```

- [ ] **Step 3: query_pipeline**

`src/tools/grants/query-pipeline.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const queryPipelineSchema = {
  name: 'query_pipeline',
  description: 'Read existing grants from the pipeline. Filter by org, status, min match score, deadline window.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: { type: 'string' },
      status: { type: 'string', description: 'Filter by status (new, reviewing, etc.)' },
      min_match: { type: 'number' },
      deadline_within_days: { type: 'number' },
      limit: { type: 'number' },
    },
  },
};

export async function queryPipeline({ org_id, status, min_match, deadline_within_days, limit = 25 }) {
  const supabase = getSupabase();
  let q = supabase
    .from('grant_opportunities')
    .select('id, name, agency, amount, deadline, match_score, status, url, created_at')
    .order('match_score', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (org_id) q = q.eq('org_id', org_id);
  if (status) q = q.eq('status', status);
  if (min_match) q = q.gte('match_score', min_match);
  if (deadline_within_days) {
    const cutoff = new Date(Date.now() + deadline_within_days * 86400_000).toISOString();
    q = q.lte('deadline', cutoff);
  }
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };
  return { ok: true, grants: data || [] };
}
```

- [ ] **Step 4: save_grant**

`src/tools/grants/save-grant.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const saveGrantSchema = {
  name: 'save_grant',
  description: 'Insert or update a grant in the pipeline. Use after discovery to persist findings.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: { type: 'string' },
      name: { type: 'string' },
      agency: { type: 'string' },
      amount: { type: 'string' },
      deadline: { type: 'string', description: 'ISO date or null' },
      url: { type: 'string' },
      description: { type: 'string' },
      match_score: { type: 'number' },
      status: { type: 'string', description: 'new, reviewing, applied, rejected, etc.' },
    },
    required: ['org_id', 'name'],
  },
};

export async function saveGrant(input) {
  const supabase = getSupabase();
  const row = {
    org_id: input.org_id,
    name: input.name,
    agency: input.agency || '',
    amount: input.amount || '',
    deadline: input.deadline || null,
    url: input.url || '',
    description: input.description || '',
    match_score: input.match_score || null,
    status: input.status || 'new',
  };
  const { data, error } = await supabase
    .from('grant_opportunities')
    .upsert(row, { onConflict: 'org_id,name' })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, grant_id: data.id };
}
```

- [ ] **Step 5: Syntax checks + commit**

```bash
for f in src/tools/grants/web-search.js src/tools/grants/fetch-webpage.js src/tools/grants/query-pipeline.js src/tools/grants/save-grant.js; do
  node --check "$f" || exit 1
done
git add src/tools/grants/
git commit -m "feat(tools): add grants discovery tools (web_search, fetch_webpage, query_pipeline, save_grant)"
```

---

### Task 4.3: Grants analysis tools (score_grant, check_documents, list_deadlines)

**Files:**
- Create: `src/tools/grants/score-grant.js`
- Create: `src/tools/grants/check-documents.js`
- Create: `src/tools/grants/list-deadlines.js`

- [ ] **Step 1: score_grant**

`src/tools/grants/score-grant.js`:

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../lib/supabase.js';
import { MODEL } from '../../lib/constants.js';

export const scoreGrantSchema = {
  name: 'score_grant',
  description: 'LLM-based eligibility score (0-100) for a grant against an org profile. Writes the score back to grant_opportunities.match_score.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      org_id: { type: 'string' },
    },
    required: ['grant_id', 'org_id'],
  },
};

export async function scoreGrant({ grant_id, org_id }) {
  const supabase = getSupabase();
  const [{ data: grant }, { data: org }] = await Promise.all([
    supabase.from('grant_opportunities').select('*').eq('id', grant_id).single(),
    supabase.from('orgs').select('*').eq('id', org_id).single(),
  ]);
  if (!grant) return { ok: false, error: 'grant not found' };
  if (!org) return { ok: false, error: 'org not found' };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: 'You are a grant eligibility analyst. Output ONLY a JSON object: {"score": <0-100>, "rationale": "<one sentence>"}.',
    messages: [{
      role: 'user',
      content: `Score this grant (0-100) for org fit.\n\nORG:\n${JSON.stringify(org.data, null, 2)}\n\nGRANT:\n${JSON.stringify(grant, null, 2)}`,
    }],
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'no JSON in response' };
  const parsed = JSON.parse(m[0]);
  const score = Math.max(0, Math.min(100, Math.round(parsed.score)));

  await supabase
    .from('grant_opportunities')
    .update({ match_score: score })
    .eq('id', grant_id);

  return { ok: true, grant_id, score, rationale: parsed.rationale };
}
```

- [ ] **Step 2: check_documents**

`src/tools/grants/check-documents.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const checkDocumentsSchema = {
  name: 'check_documents',
  description: 'Compare an org\'s document_vault against documents typically required for a grant. Returns ready/missing breakdown.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: { type: 'string' },
      grant_id: { type: 'string', description: 'Optional — if provided, also flags grant-specific docs' },
    },
    required: ['org_id'],
  },
};

export async function checkDocuments({ org_id, grant_id }) {
  const supabase = getSupabase();
  const { data: docs, error } = await supabase
    .from('document_vault')
    .select('doc_name, doc_type, status, required_for')
    .eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };

  const total = docs.length;
  const uploaded = docs.filter((d) => d.status === 'uploaded').length;
  const missing = docs
    .filter((d) => d.status === 'missing')
    .map((d) => ({ doc_name: d.doc_name, doc_type: d.doc_type, required_for: d.required_for }));

  return {
    ok: true,
    org_id,
    grant_id: grant_id || null,
    total,
    uploaded,
    readiness_percent: total ? Math.round((uploaded / total) * 100) : 0,
    missing,
  };
}
```

- [ ] **Step 3: list_deadlines**

`src/tools/grants/list-deadlines.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const listDeadlinesSchema = {
  name: 'list_deadlines',
  description: 'List grant deadlines within N days for an org.',
  input_schema: {
    type: 'object',
    properties: {
      org_id: { type: 'string' },
      days: { type: 'number', description: 'Default 30' },
    },
    required: ['org_id'],
  },
};

export async function listDeadlines({ org_id, days = 30 }) {
  const supabase = getSupabase();
  const cutoff = new Date(Date.now() + days * 86400_000).toISOString();
  const { data, error } = await supabase
    .from('grant_opportunities')
    .select('id, name, agency, deadline, match_score, status')
    .eq('org_id', org_id)
    .not('deadline', 'is', null)
    .lte('deadline', cutoff)
    .not('status', 'in', '(expired,rejected,skipped)')
    .order('deadline', { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, deadlines: data || [] };
}
```

- [ ] **Step 4: Syntax + commit**

```bash
for f in src/tools/grants/score-grant.js src/tools/grants/check-documents.js src/tools/grants/list-deadlines.js; do
  node --check "$f" || exit 1
done
git add src/tools/grants/
git commit -m "feat(tools): add grants analysis tools (score, check_documents, list_deadlines)"
```

---

### Task 4.4: Grants drafting tools (draft_narrative, generate_budget, save_draft, search_past_drafts)

**Files:**
- Create: `src/tools/grants/draft-narrative.js`
- Create: `src/tools/grants/generate-budget.js`
- Create: `src/tools/grants/save-draft.js`
- Create: `src/tools/grants/search-past-drafts.js`

- [ ] **Step 1: draft_narrative**

`src/tools/grants/draft-narrative.js`:

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../lib/supabase.js';
import { MODEL } from '../../lib/constants.js';

export const draftNarrativeSchema = {
  name: 'draft_narrative',
  description: 'Generate an application narrative for a grant. Returns a structured narrative ready to be saved as a draft.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      org_id: { type: 'string' },
      sections: {
        type: 'array',
        items: { type: 'string' },
        description: 'Section names to draft (e.g., ["needs", "approach", "outcomes"])',
      },
      prior_draft_id: { type: 'string', description: 'Optional — to revise rather than start fresh' },
      tone_notes: { type: 'string', description: 'Optional voice/tone guidance from prior wins' },
    },
    required: ['grant_id', 'org_id'],
  },
};

const DEFAULT_SECTIONS = ['executive_summary', 'organizational_capacity', 'needs_statement', 'project_approach', 'outcomes_and_evaluation', 'sustainability'];

export async function draftNarrative({ grant_id, org_id, sections = DEFAULT_SECTIONS, prior_draft_id, tone_notes }) {
  const supabase = getSupabase();
  const [{ data: grant }, { data: org }] = await Promise.all([
    supabase.from('grant_opportunities').select('*').eq('id', grant_id).single(),
    supabase.from('orgs').select('*').eq('id', org_id).single(),
  ]);
  if (!grant || !org) return { ok: false, error: 'grant or org not found' };

  let priorDraft = null;
  if (prior_draft_id) {
    const r = await supabase.from('application_drafts').select('narrative').eq('id', prior_draft_id).single();
    priorDraft = r.data?.narrative || null;
  }

  const phiRule = org.id === 'holigenix_healthcare' ? 'NEVER include patient names, ages, conditions, or any PHI.' : '';
  const leadAngle = org.id === 'holigenix_healthcare'
    ? 'Lead with 508(c)(1)(a) faith-based status for foundation grants; SDVOSB for federal.'
    : org.id === 'k1_management'
      ? 'Lead with COSTARS (March 2026 acceptance) for PA grants; Delaware OSD/SBF for DE grants; MWBE-NJ for NJ grants.'
      : '';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: `You are a senior grant writer. Output ONLY valid JSON: {"sections": {<section_name>: "<text>"}}. Each section is 200-500 words, professional voice, specific to the grant. ${phiRule} ${leadAngle} ${tone_notes || ''}`,
    messages: [{
      role: 'user',
      content: `Draft these sections: ${sections.join(', ')}.\n\nGRANT:\n${JSON.stringify(grant, null, 2)}\n\nORG PROFILE:\n${JSON.stringify(org.data, null, 2)}\n\n${priorDraft ? `PRIOR DRAFT (revise, don't start over):\n${JSON.stringify(priorDraft)}` : ''}`,
    }],
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'no JSON in response' };
  return { ok: true, narrative: JSON.parse(m[0]) };
}
```

- [ ] **Step 2: generate_budget**

`src/tools/grants/generate-budget.js`:

```javascript
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '../../lib/supabase.js';
import { MODEL } from '../../lib/constants.js';

export const generateBudgetSchema = {
  name: 'generate_budget',
  description: 'Generate a line-item budget for a grant. Returns categorized line items totaling the grant amount.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      org_id: { type: 'string' },
      amount: { type: 'number', description: 'Total grant amount in dollars' },
      categories: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional — specific line categories to use',
      },
    },
    required: ['grant_id', 'org_id', 'amount'],
  },
};

export async function generateBudget({ grant_id, org_id, amount, categories }) {
  const supabase = getSupabase();
  const [{ data: grant }, { data: org }] = await Promise.all([
    supabase.from('grant_opportunities').select('*').eq('id', grant_id).single(),
    supabase.from('orgs').select('*').eq('id', org_id).single(),
  ]);
  if (!grant || !org) return { ok: false, error: 'grant or org not found' };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: 'You are a grant budget specialist. Output ONLY valid JSON: {"line_items": [{"category": "<cat>", "description": "<desc>", "amount": <number>, "justification": "<one sentence>"}], "total": <number>, "indirect_rate": <number 0-1>}. Indirect rate ≤12% for federal. Sum of line_items.amount must equal total.',
    messages: [{
      role: 'user',
      content: `Generate a $${amount} budget.\n\nGRANT:\n${JSON.stringify(grant, null, 2)}\n\nORG:\n${JSON.stringify(org.data, null, 2)}\n\n${categories ? `Required categories: ${categories.join(', ')}` : 'Choose appropriate categories.'}`,
    }],
  });
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { ok: false, error: 'no JSON in response' };
  return { ok: true, budget: JSON.parse(m[0]) };
}
```

- [ ] **Step 3: save_draft**

`src/tools/grants/save-draft.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const saveDraftSchema = {
  name: 'save_draft',
  description: 'Persist an application draft (narrative + budget). Returns draft_id.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      org_id: { type: 'string' },
      narrative: { type: 'object' },
      budget: { type: 'object' },
      status: { type: 'string', description: 'draft, ready, submitted' },
    },
    required: ['grant_id', 'org_id'],
  },
};

export async function saveDraft({ grant_id, org_id, narrative, budget, status = 'draft' }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('application_drafts')
    .insert({
      grant_id, org_id,
      narrative: narrative || {},
      budget: budget || {},
      status,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, draft_id: data.id };
}
```

- [ ] **Step 4: search_past_drafts**

`src/tools/grants/search-past-drafts.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const searchPastDraftsSchema = {
  name: 'search_past_drafts',
  description: 'Search previous application drafts for similar grants or voice/tone references. Returns matching drafts with metadata.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Substring match against narrative content + grant name' },
      org_id: { type: 'string' },
      limit: { type: 'number' },
    },
    required: ['query'],
  },
};

export async function searchPastDrafts({ query, org_id, limit = 5 }) {
  const supabase = getSupabase();
  let q = supabase
    .from('application_drafts')
    .select('id, grant_id, status, narrative, created_at, grant_opportunities(name, agency)')
    .order('created_at', { ascending: false })
    .limit(limit * 4);
  if (org_id) q = q.eq('org_id', org_id);
  const { data, error } = await q;
  if (error) return { ok: false, error: error.message };

  const lower = query.toLowerCase();
  const filtered = (data || [])
    .filter((d) => {
      const narrText = JSON.stringify(d.narrative || {}).toLowerCase();
      const grantName = (d.grant_opportunities?.name || '').toLowerCase();
      return narrText.includes(lower) || grantName.includes(lower);
    })
    .slice(0, limit);

  return { ok: true, drafts: filtered };
}
```

- [ ] **Step 5: Syntax + commit**

```bash
for f in src/tools/grants/draft-narrative.js src/tools/grants/generate-budget.js src/tools/grants/save-draft.js src/tools/grants/search-past-drafts.js; do
  node --check "$f" || exit 1
done
git add src/tools/grants/
git commit -m "feat(tools): add grants drafting tools (draft_narrative, generate_budget, save_draft, search_past_drafts)"
```

---

### Task 4.5: Grants read tools + delegate (get_grant, get_org, get_document_vault, read_document, get_draft, delegate_to_playwright)

**Files:**
- Create: `src/tools/grants/get-grant.js`
- Create: `src/tools/grants/get-org.js`
- Create: `src/tools/grants/get-document-vault.js`
- Create: `src/tools/grants/read-document.js`
- Create: `src/tools/grants/get-draft.js`
- Create: `src/tools/grants/delegate-to-playwright.js`
- Create: `src/tools/grants/index.js`

- [ ] **Step 1: get_grant + get_org + get_draft (read tools)**

`src/tools/grants/get-grant.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const getGrantSchema = {
  name: 'get_grant',
  description: 'Fetch full grant details by ID.',
  input_schema: { type: 'object', properties: { grant_id: { type: 'string' } }, required: ['grant_id'] },
};

export async function getGrant({ grant_id }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('grant_opportunities').select('*').eq('id', grant_id).single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, grant: data };
}
```

`src/tools/grants/get-org.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const getOrgSchema = {
  name: 'get_org',
  description: 'Fetch full org profile by ID.',
  input_schema: { type: 'object', properties: { org_id: { type: 'string' } }, required: ['org_id'] },
};

export async function getOrg({ org_id }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('orgs').select('*').eq('id', org_id).single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, org: data };
}
```

`src/tools/grants/get-draft.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const getDraftSchema = {
  name: 'get_draft',
  description: 'Fetch a saved application draft by ID.',
  input_schema: { type: 'object', properties: { draft_id: { type: 'string' } }, required: ['draft_id'] },
};

export async function getDraft({ draft_id }) {
  const supabase = getSupabase();
  const { data, error } = await supabase.from('application_drafts').select('*').eq('id', draft_id).single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, draft: data };
}
```

- [ ] **Step 2: get_document_vault + read_document**

`src/tools/grants/get-document-vault.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const getDocumentVaultSchema = {
  name: 'get_document_vault',
  description: 'List documents in an org\'s vault. Returns metadata only (URLs, not content).',
  input_schema: { type: 'object', properties: { org_id: { type: 'string' } }, required: ['org_id'] },
};

export async function getDocumentVault({ org_id }) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('document_vault')
    .select('id, doc_name, doc_type, status, required_for, file_url, expiry_date')
    .eq('org_id', org_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, documents: data || [] };
}
```

`src/tools/grants/read-document.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const readDocumentSchema = {
  name: 'read_document',
  description: 'Fetch a single document\'s text content (when narrative drafting needs to reference specific contents).',
  input_schema: { type: 'object', properties: { doc_id: { type: 'string' } }, required: ['doc_id'] },
};

export async function readDocument({ doc_id }) {
  const supabase = getSupabase();
  const { data: doc, error } = await supabase
    .from('document_vault')
    .select('doc_name, file_url, doc_type')
    .eq('id', doc_id)
    .single();
  if (error || !doc) return { ok: false, error: error?.message || 'not found' };
  if (!doc.file_url) return { ok: false, error: 'document has no file_url' };

  // Download file (PDF text extraction is out of scope; return URL + name + type for now)
  // The agent can request a specific page or summary if needed in a future iteration.
  return { ok: true, doc_id, doc_name: doc.doc_name, doc_type: doc.doc_type, file_url: doc.file_url, note: 'Full text extraction not implemented in R1; URL returned for reference' };
}
```

- [ ] **Step 3: delegate_to_playwright**

`src/tools/grants/delegate-to-playwright.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';

export const delegateToPlaywrightSchema = {
  name: 'delegate_to_playwright',
  description: 'Hand off form-filling to the Playwright agent. Creates an agent_tasks row; Playwright picks it up via cron.',
  input_schema: {
    type: 'object',
    properties: {
      grant_id: { type: 'string' },
      draft_id: { type: 'string' },
      application_url: { type: 'string' },
      org_id: { type: 'string' },
      form_type: { type: 'string', description: 'grant, vendor_onboarding, cert_renewal, rfp, costars, sam_gov, other' },
      instructions: { type: 'string', description: 'Optional special instructions' },
    },
    required: ['application_url', 'org_id'],
  },
};

export async function delegateToPlaywright(payload) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('agent_tasks')
    .insert({
      from_agent: 'grants',
      to_agent: 'playwright',
      status: 'queued',
      payload,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, task_id: data.id, message: 'Handed to Playwright. Cron will pick up within 60 seconds; alert will fire when session starts and on first gate.' };
}
```

- [ ] **Step 4: Index file**

`src/tools/grants/index.js`:

```javascript
export * from './web-search.js';
export * from './fetch-webpage.js';
export * from './query-pipeline.js';
export * from './save-grant.js';
export * from './score-grant.js';
export * from './check-documents.js';
export * from './list-deadlines.js';
export * from './draft-narrative.js';
export * from './generate-budget.js';
export * from './save-draft.js';
export * from './search-past-drafts.js';
export * from './get-grant.js';
export * from './get-org.js';
export * from './get-document-vault.js';
export * from './read-document.js';
export * from './get-draft.js';
export * from './delegate-to-playwright.js';
```

- [ ] **Step 5: Syntax + commit**

```bash
for f in src/tools/grants/*.js; do node --check "$f" || exit 1; done
git add src/tools/grants/
git commit -m "feat(tools): add grants read tools + delegate_to_playwright"
```

**▶ PHASE 4 CHECKPOINT:** All 18 Grants agent tools defined with schemas. Each is independently importable. No agent loop wired yet.

---

## Phase 5 — Grants agent

### Task 5.1: Write the Grants persona file

**Files:**
- Modify: `workspace/grants.md`

- [ ] **Step 1: Replace placeholder with full persona**

`workspace/grants.md`:

```markdown
# Grants Agent

You are the GrantIQ Grants Agent — a senior grant operations specialist with deep expertise in federal, state, and foundation grants for healthcare nonprofits and minority-owned government contractors.

## Identity and voice

- Methodical, precise, decisive. Every recommendation has a one-sentence rationale.
- You command tools to do work, not narrate what you'll do. Use tools first, summarize after.
- You are not a chatbot — you are an operator. Treat the user as a peer who's busy.

## Your operator

Rodney Williams. He owns three organizations and uses you to find and apply for grants:
1. **Holigenix Healthcare LLC** — 508(c)(1)(a) faith-based nonprofit pediatric home health (Georgia, NPI 1770341067, UEI NNR7S596R4K9)
2. **K1 Management LLC** — MBE/MWBE government contractor (PA/NJ/DE)
3. **Owner Nonprofit** — Georgia nonprofit

Live project context (orgs, document vault status, top grants, deadlines) is loaded fresh into your system prompt every turn — read it before responding. Layer 3 notes (`agent_notes` you've recorded) are also injected.

## Your two modes

You operate in two modes within one agent. Pick the right mode based on the user's message — never ask which mode to use.

### Discovery mode
The user wants to find, evaluate, or track grants. Tools to use: `web_search`, `fetch_webpage`, `query_pipeline`, `save_grant`, `score_grant`, `check_documents`, `list_deadlines`.

Pattern:
1. Search the web for grants matching the org's profile (use the org's certifications, regions, NAICS codes, mission)
2. For each candidate, fetch the grant detail page
3. Score eligibility against the org profile (`score_grant`)
4. Save promising grants to the pipeline (`save_grant` with status='new')
5. Summarize top matches to the user with: name, agency, amount, deadline, match score, one-sentence rationale

### Drafting mode
The user wants to write or budget an application for a specific grant. Tools to use: `get_grant`, `get_org`, `get_document_vault`, `read_document`, `search_past_drafts`, `draft_narrative`, `generate_budget`, `save_draft`, `delegate_to_playwright`.

Pattern:
1. Pull grant + org + relevant past drafts (search by similar agency or topic)
2. Draft narrative sections (use Layer 3 notes for voice/tone)
3. Generate line-item budget
4. Save draft (`save_draft` with status='draft')
5. Tell user where to review and ask if they want to submit via Playwright

## Hard rules

- **Holigenix grants:** NEVER include patient names, ages, conditions, or any PHI. Lead with 508(c)(1)(a) status for foundation grants; SDVOSB for federal. Do not reference NEMT division or Sunrise Pediatric.
- **K1 grants:** Lead with COSTARS for PA grants (acceptance March 2026); Delaware OSD/SBF for DE grants; MWBE-NJ for NJ grants.
- **Never submit applications.** Always delegate to Playwright via `delegate_to_playwright` when the user is ready.
- **Never make commitment decisions.** You recommend; the user decides.
- **Never invent grants.** If `web_search` doesn't return real grants, say so — do not hallucinate.

## When to alert

Call `alert_user` with severity='high' when:
- A grant scoring ≥80% has a deadline within 21 days AND documents are ≥85% ready
- A draft is complete and ready for user review
- A Playwright session has reached a human gate

Call `alert_user` with severity='warning' when:
- A grant the user previously expressed interest in is approaching its deadline
- Documents are critically missing for a grant the user wants to apply to

## When to record a note

Call `record_note` when you discover:
- A non-obvious agency reviewer preference ("Delaware EDGE prefers narratives in plain language, not jargon")
- A specific grant rule ("PA DCED Keystone Communities rejects budgets with overhead >12%")
- A voice/tone insight from a winning past draft

Do NOT record:
- Facts already in the org profile
- Things trivially Google-able (deadlines, contact info)
- Speculation — only record verified, actionable knowledge

## Sign-offs

End decision-bearing messages with one of:
- `— Grants` (default)
- `— Grants (Discovery)` (when in Discovery mode)
- `— Grants (Drafting)` (when in Drafting mode)
```

- [ ] **Step 2: Commit**

```bash
git add workspace/grants.md
git commit -m "feat(grants): write Grants agent persona"
```

---

### Task 5.2: Compose the Grants agent module

**Files:**
- Create: `src/agents/grants/index.js`
- Create: `src/agents/grants/dispatch.js`

- [ ] **Step 1: Build the dispatch table**

`src/agents/grants/dispatch.js`:

```javascript
// Maps tool name → implementation function. Used by the Anthropic tool-use loop.

import * as g from '../../tools/grants/index.js';
import { makeRecordNote, makeAlertUser } from '../../tools/shared/index.js';

const recordNote = makeRecordNote('grants');
const alertUser = makeAlertUser('grants');

const TOOL_FUNCTIONS = {
  web_search: g.webSearch,
  fetch_webpage: g.fetchWebpage,
  query_pipeline: g.queryPipeline,
  save_grant: g.saveGrant,
  score_grant: g.scoreGrant,
  check_documents: g.checkDocuments,
  list_deadlines: g.listDeadlines,
  draft_narrative: g.draftNarrative,
  generate_budget: g.generateBudget,
  save_draft: g.saveDraft,
  search_past_drafts: g.searchPastDrafts,
  get_grant: g.getGrant,
  get_org: g.getOrg,
  get_document_vault: g.getDocumentVault,
  read_document: g.readDocument,
  get_draft: g.getDraft,
  delegate_to_playwright: g.delegateToPlaywright,
  record_note: recordNote,
  alert_user: alertUser,
};

export const GRANTS_TOOL_SCHEMAS = [
  g.webSearchSchema,
  g.fetchWebpageSchema,
  g.queryPipelineSchema,
  g.saveGrantSchema,
  g.scoreGrantSchema,
  g.checkDocumentsSchema,
  g.listDeadlinesSchema,
  g.draftNarrativeSchema,
  g.generateBudgetSchema,
  g.saveDraftSchema,
  g.searchPastDraftsSchema,
  g.getGrantSchema,
  g.getOrgSchema,
  g.getDocumentVaultSchema,
  g.readDocumentSchema,
  g.getDraftSchema,
  g.delegateToPlaywrightSchema,
  // shared
  (await import('../../tools/shared/record-note.js')).recordNoteSchema,
  (await import('../../tools/shared/alert-user.js')).alertUserSchema,
];

export async function dispatch(name, input) {
  const fn = TOOL_FUNCTIONS[name];
  if (!fn) throw new Error(`Unknown tool: ${name}`);
  return fn(input);
}
```

- [ ] **Step 2: Build the agent runner**

`src/agents/grants/index.js`:

```javascript
import { createGrantIQClient } from '../../lib/anthropic-client.js';
import { loadOrCreateConversation, persistTurn, appendUserText } from '../../lib/memory.js';
import { loadPersona } from '../../lib/workspace.js';
import { loadProjectContext } from '../../lib/agent-context.js';
import { logAgentActivity } from '../../lib/audit.js';
import { GRANTS_TOOL_SCHEMAS, dispatch } from './dispatch.js';

const AGENT_NAME = 'grants';

function extractKeywords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9_-]+/)
    .filter((w) => w.length >= 4)
    .slice(0, 10);
}

export async function runGrantsTurn({ userMessage, conversationId, userChatId }) {
  // Load or create conversation
  const { conversation, messages: priorMessages } =
    conversationId
      ? { conversation: { id: conversationId }, messages: await loadPriorMessages(conversationId) }
      : await loadOrCreateConversation({ agentName: AGENT_NAME, userChatId });

  // Build system prompt: persona + live project context
  const persona = loadPersona('grants');
  const keywords = extractKeywords(userMessage);
  const projectContext = await loadProjectContext({ agentName: AGENT_NAME, queryKeywords: keywords });

  const system = [
    { type: 'text', text: persona, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: projectContext },
  ];

  // Append user message
  const messagesIn = appendUserText(priorMessages, userMessage);
  const priorCount = messagesIn.length - 1;  // we just appended one

  // Run the loop
  const client = createGrantIQClient({ dispatch });
  const result = await client.run({
    system,
    messages: messagesIn,
    tools: GRANTS_TOOL_SCHEMAS,
  });

  // Persist all new turns (user message + assistant response + any tool turns)
  await persistTurn({
    agentName: AGENT_NAME,
    conversationId: conversation.id,
    priorMessageCount: priorCount,
    messages: result.messages,
  });

  // Telemetry
  await logAgentActivity({
    agentId: AGENT_NAME,
    action: 'chat_turn',
    detail: result.status,
    metadata: result.telemetry,
  });

  return {
    conversation_id: conversation.id,
    text: result.text,
    status: result.status,
    telemetry: result.telemetry,
  };
}

async function loadPriorMessages(conversationId) {
  // Re-implement loadMessages without changing memory.js exports surface.
  const { getSupabase } = await import('../../lib/supabase.js');
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('grants_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`[grants] loadPriorMessages: ${error.message}`);
  return (data || []).map((row) => ({ role: row.role, content: row.content }));
}
```

- [ ] **Step 3: Syntax + commit**

```bash
node --check src/agents/grants/dispatch.js
node --check src/agents/grants/index.js
git add src/agents/grants/
git commit -m "feat(grants): compose Grants agent (dispatch + runner with memory + context)"
```

---

### Task 5.3: Vercel function endpoints for Grants

**Files:**
- Create: `api/grants/chat.js`
- Create: `api/grants/conversations.js`
- Create: `api/health.js`

- [ ] **Step 1: Chat endpoint**

`api/grants/chat.js`:

```javascript
import { runGrantsTurn } from '../../src/agents/grants/index.js';
import { assertRequiredEnv } from '../../src/lib/constants.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  try {
    assertRequiredEnv();
  } catch (e) {
    return res.status(503).json({ error: e.message });
  }

  const { message, conversation_id, user_chat_id } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message (string) required' });
  }

  try {
    const result = await runGrantsTurn({
      userMessage: message,
      conversationId: conversation_id || null,
      userChatId: user_chat_id || 'rodney',
    });
    return res.status(200).json(result);
  } catch (e) {
    console.error('[api/grants/chat] error:', e);
    return res.status(500).json({ error: e.message });
  }
}
```

- [ ] **Step 2: Conversations list endpoint**

`api/grants/conversations.js`:

```javascript
import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const supabase = getSupabase();
  const userChatId = req.query.user_chat_id || 'rodney';
  const { data, error } = await supabase
    .from('grants_conversations')
    .select('id, started_at, last_message_at, channel')
    .eq('user_chat_id', userChatId)
    .order('last_message_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ conversations: data || [] });
}
```

- [ ] **Step 3: Health endpoint**

`api/health.js`:

```javascript
import { getSupabase } from '../src/lib/supabase.js';

export default async function handler(req, res) {
  const checks = { server: 'ok', supabase: 'unknown', anthropic: 'unknown' };
  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('orgs').select('id').limit(1);
    checks.supabase = error ? `err: ${error.message}` : 'ok';
  } catch (e) {
    checks.supabase = `err: ${e.message}`;
  }
  checks.anthropic = process.env.ANTHROPIC_API_KEY ? 'configured' : 'missing';
  const allOk = Object.values(checks).every((v) => v === 'ok' || v === 'configured');
  return res.status(allOk ? 200 : 503).json({ status: allOk ? 'ok' : 'degraded', checks, uptime_s: Math.floor(process.uptime()) });
}
```

- [ ] **Step 4: Commit**

```bash
node --check api/grants/chat.js && node --check api/grants/conversations.js && node --check api/health.js
git add api/grants/ api/health.js
git commit -m "feat(api): add Grants chat, conversations, and health endpoints"
```

---

### Task 5.4: End-to-end smoke test for Grants agent

**Files:**
- Create: `scripts/smoke-grants.mjs`

- [ ] **Step 1: Write smoke script**

`scripts/smoke-grants.mjs`:

```javascript
// Hits the Grants agent locally via vercel dev. Requires .env.local set up.
const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function smoke() {
  // Health
  const h = await fetch(`${BASE}/api/health`);
  console.log('Health:', h.status, await h.json());

  // Chat — discovery prompt
  const c1 = await fetch(`${BASE}/api/grants/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'List the top 3 K1 Management grants in our pipeline by match score.',
      user_chat_id: 'smoke-test',
    }),
  });
  if (!c1.ok) {
    console.error('Chat 1 failed:', c1.status, await c1.text());
    process.exit(1);
  }
  const r1 = await c1.json();
  console.log('Chat 1 status:', r1.status, 'iterations:', r1.telemetry?.iterations);
  console.log('Chat 1 text (first 300):', r1.text.slice(0, 300));

  if (r1.status !== 'success') {
    console.error('Chat 1 did not succeed');
    process.exit(1);
  }
  console.log('SMOKE PASSED');
}

smoke().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Run smoke locally**

In one terminal:
```bash
npx vercel dev --yes --listen 3000
```

In another:
```bash
node scripts/smoke-grants.mjs
```

Expected: Health status 200; Chat 1 returns "success" status with non-empty text mentioning K1 grants.

- [ ] **Step 3: Verify conversation persisted**

```bash
curl -s "http://localhost:3000/api/grants/conversations?user_chat_id=smoke-test" | python3 -m json.tool
```

Expected: at least 1 conversation row returned.

- [ ] **Step 4: Commit smoke script**

```bash
git add scripts/smoke-grants.mjs
git commit -m "test: add smoke test for Grants agent end-to-end"
```

**▶ PHASE 5 CHECKPOINT:** Grants agent works end-to-end. You can chat with it locally, it remembers conversations, and it can use all 19 tools. No UI yet, no Playwright yet. **Major milestone — first working SDK agent.**

---

## Phase 6 — Playwright agent

> **Note on Vercel Sandbox:** Vercel Sandbox is GA but still maturing. For R1, this plan uses Sandbox for browser execution. If during Task 6.2 implementation, Sandbox proves problematic (cold start >30s, browser version mismatch, etc.), fall back to Browserbase. The tool surface stays the same.

### Task 6.1: Browser abstraction layer

**Files:**
- Create: `src/lib/browser.js`

- [ ] **Step 1: Implement browser wrapper around Vercel Sandbox**

`src/lib/browser.js`:

```javascript
// Browser session abstraction — wraps Vercel Sandbox or Browserbase.
// Intent: every Playwright tool calls into this module; runtime swap is one place.

import { chromium } from 'playwright-core';

// In R1 we use a direct Playwright connection to a remote Chromium that Vercel Sandbox provides.
// VERCEL_SANDBOX_BROWSER_WS is the WebSocket endpoint exposed by the sandbox.
// If it's unset, fall back to launching a local Chromium (dev only).

const sessionRegistry = new Map();  // session_id -> { browser, context, page }

export async function startBrowser({ session_id, headless = true }) {
  if (sessionRegistry.has(session_id)) {
    return sessionRegistry.get(session_id);
  }

  let browser;
  const ws = process.env.VERCEL_SANDBOX_BROWSER_WS;
  if (ws) {
    browser = await chromium.connect(ws, { timeout: 30_000 });
  } else {
    browser = await chromium.launch({ headless });
  }
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: 'Mozilla/5.0 GrantIQ-Playwright/2.0',
  });
  const page = await context.newPage();
  const session = { browser, context, page, started_at: Date.now() };
  sessionRegistry.set(session_id, session);
  return session;
}

export function getSession(session_id) {
  return sessionRegistry.get(session_id) || null;
}

export async function endBrowser(session_id) {
  const s = sessionRegistry.get(session_id);
  if (!s) return;
  try { await s.browser.close(); } catch (_) {}
  sessionRegistry.delete(session_id);
}

export async function takeScreenshot({ session_id, name }) {
  const s = sessionRegistry.get(session_id);
  if (!s) throw new Error('session not found');
  const buf = await s.page.screenshot({ fullPage: false });
  return buf;  // Buffer; caller uploads to Supabase Storage
}

export async function snapshotAccessibilityTree({ session_id }) {
  const s = sessionRegistry.get(session_id);
  if (!s) throw new Error('session not found');
  return await s.page.accessibility.snapshot({ interestingOnly: true });
}
```

- [ ] **Step 2: Syntax + commit**

```bash
node --check src/lib/browser.js
git add src/lib/browser.js
git commit -m "feat(browser): add Playwright abstraction over Vercel Sandbox"
```

---

### Task 6.2: Playwright tools (start_session, navigate, screenshot, snapshot_page, fill_field, click, select_option, check_field, upload_file, save_progress, gate_for_human, submit_form)

**Files:**
- Create: `src/tools/playwright/session-control.js`
- Create: `src/tools/playwright/navigation.js`
- Create: `src/tools/playwright/interaction.js`
- Create: `src/tools/playwright/gates.js`
- Create: `src/tools/playwright/index.js`

- [ ] **Step 1: session-control.js (start_session, save_progress)**

`src/tools/playwright/session-control.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';
import { startBrowser, endBrowser } from '../../lib/browser.js';

export const startSessionSchema = {
  name: 'start_session',
  description: 'Spawn a browser session for form filling. Creates a playwright_sessions row.',
  input_schema: {
    type: 'object',
    properties: {
      application_url: { type: 'string' },
      org_id: { type: 'string' },
      grant_id: { type: 'string' },
      draft_id: { type: 'string' },
      form_type: { type: 'string' },
    },
    required: ['application_url', 'org_id'],
  },
};

export async function startSession(input) {
  const supabase = getSupabase();
  const { data: row, error } = await supabase
    .from('playwright_sessions')
    .insert({
      application_url: input.application_url,
      org_id: input.org_id,
      grant_id: input.grant_id || null,
      draft_id: input.draft_id || null,
      form_type: input.form_type || 'other',
      status: 'starting',
      state_json: {},
      screenshots: [],
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  try {
    await startBrowser({ session_id: row.id });
    await supabase
      .from('playwright_sessions')
      .update({ status: 'in_progress' })
      .eq('id', row.id);
    return { ok: true, session_id: row.id };
  } catch (e) {
    await supabase
      .from('playwright_sessions')
      .update({ status: 'failed', result: { error: e.message } })
      .eq('id', row.id);
    return { ok: false, error: e.message };
  }
}

export const saveProgressSchema = {
  name: 'save_progress',
  description: 'Checkpoint current session state. Call every 3 fields filled.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      current_step: { type: 'number' },
      state_update: { type: 'object', description: 'Fields filled so far this turn' },
    },
    required: ['session_id', 'current_step'],
  },
};

export async function saveProgress({ session_id, current_step, state_update }) {
  const supabase = getSupabase();
  const { data: row } = await supabase
    .from('playwright_sessions')
    .select('state_json')
    .eq('id', session_id)
    .single();
  const merged = { ...(row?.state_json || {}), ...(state_update || {}) };
  const { error } = await supabase
    .from('playwright_sessions')
    .update({ state_json: merged, current_step })
    .eq('id', session_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export const endSessionSchema = {
  name: 'end_session',
  description: 'Close the browser. Call after submit or cancel.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      status: { type: 'string', enum: ['completed', 'failed', 'cancelled'] },
      result: { type: 'object' },
    },
    required: ['session_id', 'status'],
  },
};

export async function endSession({ session_id, status, result }) {
  const supabase = getSupabase();
  await endBrowser(session_id);
  const { error } = await supabase
    .from('playwright_sessions')
    .update({ status, result: result || {}, ended_at: new Date().toISOString() })
    .eq('id', session_id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
```

- [ ] **Step 2: navigation.js + screenshots**

`src/tools/playwright/navigation.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';
import { getSession, takeScreenshot, snapshotAccessibilityTree } from '../../lib/browser.js';

async function uploadScreenshot(session_id, buf) {
  const supabase = getSupabase();
  const path = `${session_id}/${Date.now()}.png`;
  const { error: upErr } = await supabase
    .storage
    .from('playwright-screenshots')
    .upload(path, buf, { contentType: 'image/png', upsert: false });
  if (upErr) throw new Error(upErr.message);
  const { data } = supabase.storage.from('playwright-screenshots').getPublicUrl(path);
  return data.publicUrl;
}

export const navigateSchema = {
  name: 'navigate',
  description: 'Navigate to a URL in the current session.',
  input_schema: {
    type: 'object',
    properties: { session_id: { type: 'string' }, url: { type: 'string' } },
    required: ['session_id', 'url'],
  },
};

export async function navigate({ session_id, url }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  await s.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  return { ok: true, current_url: s.page.url() };
}

export const screenshotSchema = {
  name: 'screenshot',
  description: 'Capture the current page. Returns the public URL.',
  input_schema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] },
};

export async function screenshot({ session_id }) {
  const buf = await takeScreenshot({ session_id });
  const url = await uploadScreenshot(session_id, buf);

  const supabase = getSupabase();
  const { data: row } = await supabase
    .from('playwright_sessions')
    .select('screenshots')
    .eq('id', session_id)
    .single();
  const arr = Array.isArray(row?.screenshots) ? row.screenshots : [];
  arr.push({ url, taken_at: new Date().toISOString() });
  await supabase.from('playwright_sessions').update({ screenshots: arr }).eq('id', session_id);

  return { ok: true, screenshot_url: url };
}

export const snapshotPageSchema = {
  name: 'snapshot_page',
  description: 'Get the accessibility tree of the current page (DOM-as-text for reasoning).',
  input_schema: { type: 'object', properties: { session_id: { type: 'string' } }, required: ['session_id'] },
};

export async function snapshotPage({ session_id }) {
  const tree = await snapshotAccessibilityTree({ session_id });
  return { ok: true, tree };
}
```

- [ ] **Step 3: interaction.js (fill_field, click, select_option, check_field, upload_file)**

`src/tools/playwright/interaction.js`:

```javascript
import { getSession } from '../../lib/browser.js';
import { getSupabase } from '../../lib/supabase.js';

export const fillFieldSchema = {
  name: 'fill_field',
  description: 'Type a value into an input field.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      selector: { type: 'string', description: 'CSS or accessibility selector' },
      value: { type: 'string' },
    },
    required: ['session_id', 'selector', 'value'],
  },
};

export async function fillField({ session_id, selector, value }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  await s.page.fill(selector, value, { timeout: 10_000 });
  return { ok: true };
}

export const clickSchema = {
  name: 'click',
  description: 'Click an element.',
  input_schema: {
    type: 'object',
    properties: { session_id: { type: 'string' }, selector: { type: 'string' } },
    required: ['session_id', 'selector'],
  },
};

export async function click({ session_id, selector }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  await s.page.click(selector, { timeout: 10_000 });
  return { ok: true };
}

export const selectOptionSchema = {
  name: 'select_option',
  description: 'Choose an option from a select dropdown.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      selector: { type: 'string' },
      value: { type: 'string' },
    },
    required: ['session_id', 'selector', 'value'],
  },
};

export async function selectOption({ session_id, selector, value }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  await s.page.selectOption(selector, value);
  return { ok: true };
}

export const checkFieldSchema = {
  name: 'check_field',
  description: 'Verify a field\'s current value matches expected. Use after fill_field for critical fields.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      selector: { type: 'string' },
      expected_value: { type: 'string' },
    },
    required: ['session_id', 'selector', 'expected_value'],
  },
};

export async function checkField({ session_id, selector, expected_value }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  const actual = await s.page.inputValue(selector);
  return { ok: actual === expected_value, actual, expected: expected_value };
}

export const uploadFileSchema = {
  name: 'upload_file',
  description: 'Upload a document from the document_vault into a file input.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      selector: { type: 'string' },
      doc_id: { type: 'string' },
    },
    required: ['session_id', 'selector', 'doc_id'],
  },
};

export async function uploadFile({ session_id, selector, doc_id }) {
  const s = getSession(session_id);
  if (!s) return { ok: false, error: 'session not found' };
  const supabase = getSupabase();
  const { data: doc, error } = await supabase
    .from('document_vault')
    .select('doc_name, file_url')
    .eq('id', doc_id)
    .single();
  if (error || !doc?.file_url) return { ok: false, error: 'doc not found or no URL' };

  // Download to a temp buffer, then set on the input
  const fileRes = await fetch(doc.file_url);
  if (!fileRes.ok) return { ok: false, error: `download failed: ${fileRes.status}` };
  const buf = Buffer.from(await fileRes.arrayBuffer());
  await s.page.setInputFiles(selector, {
    name: doc.doc_name + '.pdf',
    mimeType: 'application/pdf',
    buffer: buf,
  });
  return { ok: true };
}
```

- [ ] **Step 4: gates.js (gate_for_human, submit_form)**

`src/tools/playwright/gates.js`:

```javascript
import { getSupabase } from '../../lib/supabase.js';
import { postAlert } from '../../lib/alerts.js';

export const gateForHumanSchema = {
  name: 'gate_for_human',
  description: 'STOP execution and wait for human intervention. Use for signatures, CAPTCHAs, certifications, unexpected fields, or anything you\'re uncertain about.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      reason: { type: 'string', description: 'Why human input is needed' },
      screenshot_url: { type: 'string' },
    },
    required: ['session_id', 'reason'],
  },
};

export async function gateForHuman({ session_id, reason, screenshot_url }) {
  const supabase = getSupabase();
  const alertId = await postAlert({
    agentId: 'playwright',
    severity: 'high',
    message: `Playwright session paused: ${reason}`,
    link: `/sessions.html?id=${session_id}`,
  });
  await supabase
    .from('playwright_sessions')
    .update({
      status: 'gated',
      gate_reason: reason,
      gate_screenshot_url: screenshot_url || null,
    })
    .eq('id', session_id);
  return { ok: true, gated: true, alert_id: alertId, message: 'Session gated. Awaiting user resume.' };
}

export const submitFormSchema = {
  name: 'submit_form',
  description: 'Final form submission. ALWAYS gates for human approval before clicking. Never auto-submits.',
  input_schema: {
    type: 'object',
    properties: {
      session_id: { type: 'string' },
      submit_selector: { type: 'string', description: 'CSS selector of submit button' },
      summary: { type: 'string', description: 'One-paragraph summary of what will be submitted' },
    },
    required: ['session_id', 'submit_selector', 'summary'],
  },
};

export async function submitForm({ session_id, submit_selector, summary }) {
  // submit_form ALWAYS gates per spec design decision Option A.
  return gateForHuman({
    session_id,
    reason: `READY TO SUBMIT. ${summary}\n\nReview screenshot. Click "Approve Submit" to fire selector: ${submit_selector}`,
  });
}
```

- [ ] **Step 5: index file**

`src/tools/playwright/index.js`:

```javascript
export * from './session-control.js';
export * from './navigation.js';
export * from './interaction.js';
export * from './gates.js';
```

- [ ] **Step 6: Syntax + commit**

```bash
for f in src/tools/playwright/*.js; do node --check "$f" || exit 1; done
git add src/tools/playwright/
git commit -m "feat(playwright): add browser automation tools (12 tools)"
```

---

### Task 6.3: Playwright persona

**Files:**
- Modify: `workspace/playwright.md`

- [ ] **Step 1: Replace placeholder**

`workspace/playwright.md`:

```markdown
# Playwright Agent

You are the GrantIQ Playwright Agent — a browser automation specialist. Your job is to fill out web forms autonomously up to defined human-approval gates.

## Scope

You handle ANY business form, not just grants:
- Grant applications (grants.gov, state portals, foundation portals)
- Vendor onboarding forms (COSTARS quarterly, SAM.gov updates, supplier portals)
- Certification renewals (MBE, WBE, SDB, etc.)
- RFP responses
- W-9 / tax forms
- LLC formation / annual reports

Claude's training covers most US business forms; when you're uncertain, gate for human.

## Operating model

You receive a task from `agent_tasks` with payload like:
```json
{
  "application_url": "https://...",
  "org_id": "k1_management",
  "draft_id": "uuid",        // optional — present for grant applications
  "grant_id": "uuid",         // optional
  "form_type": "grant|vendor_onboarding|cert_renewal|rfp|costars|sam_gov|other",
  "instructions": "..."       // optional
}
```

Standard flow:
1. `start_session` to spawn a browser
2. `navigate` to the application URL
3. `screenshot` + `snapshot_page` to read the form
4. Plan the fields you'll fill from the draft (if grant) or the org profile (if non-grant)
5. For each field: `fill_field` → `check_field` (for critical ones) → `save_progress` every 3 fields
6. Encounter a gate → `gate_for_human` (do NOT proceed)
7. On final submit → `submit_form` (always gates)
8. After user approves and you complete: `end_session` with status='completed'

## Hard gates (NEVER proceed without human approval)

You MUST call `gate_for_human` (and stop) when you encounter:
1. **Signature fields** — anything labeled "signature", "sign here", or with a canvas element
2. **CAPTCHAs** — visual, audio, reCAPTCHA, hCaptcha
3. **Certification language** — "certify", "attest", "swear under penalty of perjury", "under penalty of false claims"
4. **Final submit button** on any form — even if you've successfully submitted to this portal before, ALWAYS gate (use `submit_form` which auto-gates)
5. **Unexpected fields** — any field whose label or context wasn't present in your initial form snapshot
6. **Payment / credit card fields**
7. **Domain redirects mid-flow** — if the URL changes to an unexpected domain
8. **Anything you're uncertain about** — when in doubt, gate

## Hard rules

- **Never generate content.** For grant applications, copy verbatim from `draft_id`. For non-grant forms, use the org profile fields directly. If a field requires text not in the draft or profile, gate.
- **Never decide what to submit.** You only fill what's already in the source data.
- **Always `save_progress` every 3 fields** so we can resume on crash.
- **`screenshot` after every navigation and major step** — the user needs visual proof of what's happening.

## Knowledge expectations

You should know:
- SF-424 form structure (federal grants)
- W-9 fields (TIN, EIN, classification)
- COSTARS quarterly format (PA contractor reporting)
- SAM.gov registration update fields
- Common state procurement portal layouts (PA DGS, NJ Treasury, DE Procurement)

You should NOT pretend to know:
- Internal portal navigation patterns you haven't seen
- Field validation rules unique to a specific agency
- Whether a specific document format will be accepted

When you don't know — gate.

## When to record a note

Call `record_note` with tags like `['portal-name', 'form-type']` when you discover:
- A specific portal's quirk ("grants.gov requires EIN with no dashes")
- A useful selector pattern ("on COSTARS forms, the 'Next' button is `button[id*=next]`")
- A field requirement you discovered the hard way ("PA DCED requires WBE cert verbatim, not 'WBE-equivalent'")

These notes are loaded into your future sessions on the same portal.

## Sign-offs

End status updates with:
- `— Playwright (in progress)`
- `— Playwright (gated, awaiting human)`
- `— Playwright (completed, submitted)`
```

- [ ] **Step 2: Commit**

```bash
git add workspace/playwright.md
git commit -m "feat(playwright): write Playwright agent persona"
```

---

### Task 6.4: Compose Playwright agent module

**Files:**
- Create: `src/agents/playwright/dispatch.js`
- Create: `src/agents/playwright/index.js`

- [ ] **Step 1: Dispatch table**

`src/agents/playwright/dispatch.js`:

```javascript
import * as p from '../../tools/playwright/index.js';
import { makeRecordNote } from '../../tools/shared/record-note.js';

const recordNote = makeRecordNote('playwright');

const TOOL_FUNCTIONS = {
  start_session: p.startSession,
  save_progress: p.saveProgress,
  end_session: p.endSession,
  navigate: p.navigate,
  screenshot: p.screenshot,
  snapshot_page: p.snapshotPage,
  fill_field: p.fillField,
  click: p.click,
  select_option: p.selectOption,
  check_field: p.checkField,
  upload_file: p.uploadFile,
  gate_for_human: p.gateForHuman,
  submit_form: p.submitForm,
  record_note: recordNote,
};

export const PLAYWRIGHT_TOOL_SCHEMAS = [
  p.startSessionSchema,
  p.saveProgressSchema,
  p.endSessionSchema,
  p.navigateSchema,
  p.screenshotSchema,
  p.snapshotPageSchema,
  p.fillFieldSchema,
  p.clickSchema,
  p.selectOptionSchema,
  p.checkFieldSchema,
  p.uploadFileSchema,
  p.gateForHumanSchema,
  p.submitFormSchema,
  (await import('../../tools/shared/record-note.js')).recordNoteSchema,
];

export async function dispatch(name, input) {
  const fn = TOOL_FUNCTIONS[name];
  if (!fn) throw new Error(`Unknown Playwright tool: ${name}`);
  return fn(input);
}
```

- [ ] **Step 2: Agent runner**

`src/agents/playwright/index.js`:

```javascript
import { createGrantIQClient } from '../../lib/anthropic-client.js';
import { loadPersona } from '../../lib/workspace.js';
import { logAgentActivity } from '../../lib/audit.js';
import { getSupabase } from '../../lib/supabase.js';
import { PLAYWRIGHT_TOOL_SCHEMAS, dispatch } from './dispatch.js';

const AGENT_NAME = 'playwright';

export async function runPlaywrightTask({ task }) {
  const supabase = getSupabase();
  await supabase
    .from('agent_tasks')
    .update({ status: 'in_progress', claimed_at: new Date().toISOString() })
    .eq('id', task.id);

  const persona = loadPersona('playwright');

  // Load notes tagged with the form_type or portal domain
  const tags = [];
  if (task.payload.form_type) tags.push(task.payload.form_type);
  try {
    const u = new URL(task.payload.application_url);
    tags.push(u.hostname);
  } catch (_) {}

  const { data: notes } = await supabase
    .from('agent_notes')
    .select('note, tags, confidence')
    .or(tags.map((t) => `tags.cs.{${t}}`).join(','))
    .is('archived_at', null)
    .limit(20);

  const notesText = (notes || []).length
    ? '\n\n## Layer 3 notes (from past runs on this portal/form-type)\n' +
      notes.map((n) => `- [${n.confidence}] ${n.note}`).join('\n')
    : '';

  const system = [
    { type: 'text', text: persona, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: notesText },
  ];

  const taskPrompt = `New Playwright task:

Application URL: ${task.payload.application_url}
Org: ${task.payload.org_id}
${task.payload.grant_id ? `Grant ID: ${task.payload.grant_id}` : ''}
${task.payload.draft_id ? `Draft ID: ${task.payload.draft_id}` : ''}
Form type: ${task.payload.form_type || 'other'}
${task.payload.instructions ? `Instructions: ${task.payload.instructions}` : ''}

Begin: call start_session, then navigate, then snapshot_page. Plan fields. Fill. Gate for human at every gate per your persona rules.`;

  const client = createGrantIQClient({ dispatch });
  const result = await client.run({
    system,
    messages: [{ role: 'user', content: taskPrompt }],
    tools: PLAYWRIGHT_TOOL_SCHEMAS,
  });

  const finalStatus = result.status === 'success' ? 'done' : (result.status === 'partial' ? 'failed' : 'failed');
  await supabase
    .from('agent_tasks')
    .update({
      status: finalStatus,
      completed_at: new Date().toISOString(),
      result: { text: result.text, telemetry: result.telemetry },
    })
    .eq('id', task.id);

  await logAgentActivity({
    agentId: AGENT_NAME,
    action: 'task_run',
    detail: result.status,
    metadata: { task_id: task.id, ...result.telemetry },
  });

  return result;
}
```

- [ ] **Step 3: Syntax + commit**

```bash
node --check src/agents/playwright/dispatch.js
node --check src/agents/playwright/index.js
git add src/agents/playwright/
git commit -m "feat(playwright): compose Playwright agent (dispatch + task runner)"
```

---

### Task 6.5: Playwright HTTP endpoints + Supabase storage bucket

**Files:**
- Create: `api/playwright/start.js`
- Create: `api/playwright/resume.js`
- Create: `api/playwright/sessions.js`

- [ ] **Step 1: Create the screenshots storage bucket**

In Supabase dashboard → Storage → Create bucket:
- Name: `playwright-screenshots`
- Public: yes (read-only public URL)
- File size limit: 5 MB

OR via SQL (if bucket creation via SQL is enabled):

```sql
insert into storage.buckets (id, name, public) values ('playwright-screenshots', 'playwright-screenshots', true);
```

- [ ] **Step 2: start endpoint (manual session start)**

`api/playwright/start.js`:

```javascript
import { runPlaywrightTask } from '../../src/agents/playwright/index.js';
import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { application_url, org_id, grant_id, draft_id, form_type, instructions } = req.body || {};
  if (!application_url || !org_id) {
    return res.status(400).json({ error: 'application_url and org_id required' });
  }

  const supabase = getSupabase();
  const { data: task, error } = await supabase
    .from('agent_tasks')
    .insert({
      from_agent: 'user',
      to_agent: 'playwright',
      status: 'queued',
      payload: { application_url, org_id, grant_id, draft_id, form_type, instructions },
    })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Run inline (within 300s function budget). For longer sessions, the cron
  // /api/cron/process-tasks picks them up if they're still queued.
  res.status(202).json({ task_id: task.id, message: 'Playwright task queued; will start within 60s' });
  setTimeout(() => {
    runPlaywrightTask({ task }).catch((e) => console.error('[playwright/start] error:', e));
  }, 0);
}
```

- [ ] **Step 3: resume endpoint (after gate)**

`api/playwright/resume.js`:

```javascript
import { getSupabase } from '../../src/lib/supabase.js';
import { runPlaywrightTask } from '../../src/agents/playwright/index.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { session_id, user_action } = req.body || {};
  if (!session_id) return res.status(400).json({ error: 'session_id required' });

  const supabase = getSupabase();
  const { data: session, error: sErr } = await supabase
    .from('playwright_sessions')
    .select('*')
    .eq('id', session_id)
    .single();
  if (sErr || !session) return res.status(404).json({ error: 'session not found' });
  if (session.status !== 'gated') return res.status(409).json({ error: `session is ${session.status}, not gated` });

  await supabase
    .from('playwright_sessions')
    .update({ status: 'in_progress', gate_reason: null })
    .eq('id', session_id);

  // Find the originating task
  const { data: task } = await supabase
    .from('agent_tasks')
    .select('*')
    .contains('payload', { application_url: session.application_url })
    .eq('to_agent', 'playwright')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Re-invoke with a resume note in instructions
  const resumeTask = {
    ...task,
    payload: {
      ...task.payload,
      instructions: `${task.payload.instructions || ''}\n\nRESUMING from gate. User action: ${user_action || 'approved'}. Continue from where you stopped.`,
    },
  };

  res.status(202).json({ session_id, message: 'Resuming session' });
  setTimeout(() => {
    runPlaywrightTask({ task: resumeTask }).catch((e) => console.error('[playwright/resume] error:', e));
  }, 0);
}
```

- [ ] **Step 4: sessions list endpoint**

`api/playwright/sessions.js`:

```javascript
import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  const supabase = getSupabase();
  const { id } = req.query;

  if (id) {
    const { data, error } = await supabase
      .from('playwright_sessions')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  const { data, error } = await supabase
    .from('playwright_sessions')
    .select('id, application_url, form_type, status, current_step, started_at, gate_reason')
    .order('started_at', { ascending: false })
    .limit(50);
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ sessions: data || [] });
}
```

- [ ] **Step 5: Syntax + commit**

```bash
for f in api/playwright/*.js; do node --check "$f" || exit 1; done
git add api/playwright/
git commit -m "feat(api): add Playwright start, resume, sessions endpoints"
```

**▶ PHASE 6 CHECKPOINT:** Playwright agent complete. Browser sessions can spawn via Vercel Sandbox, fill forms, gate for human, resume. **Test against a sample form (e.g., a public NJ MWBE re-cert form) before proceeding to Phase 7.** Document any failures in `_archive/playwright-test-notes.md`.

---

## Phase 7 — UI updates (chat, sessions, alerts)

### Task 7.1: Chat panel HTML

**Files:**
- Create: `public/chat.html`

- [ ] **Step 1: Build chat UI**

`public/chat.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GrantIQ — Grants Agent Chat</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #0a0a0a; color: #e5e5e5; }
    header { padding: 1rem; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center; }
    header h1 { margin: 0; font-size: 1.2rem; color: #f59e0b; }
    main { max-width: 800px; margin: 0 auto; padding: 1rem; }
    .messages { min-height: 60vh; padding-bottom: 1rem; }
    .msg { padding: 0.75rem 1rem; margin-bottom: 0.5rem; border-radius: 8px; line-height: 1.5; white-space: pre-wrap; }
    .msg.user { background: #1e40af; }
    .msg.assistant { background: #1f1f1f; border: 1px solid #333; }
    .msg.tool { background: #422006; border: 1px solid #78350f; font-family: monospace; font-size: 0.85rem; }
    .composer { display: flex; gap: 0.5rem; padding: 1rem 0; position: sticky; bottom: 0; background: #0a0a0a; }
    textarea { flex: 1; background: #1f1f1f; color: #e5e5e5; border: 1px solid #333; padding: 0.75rem; border-radius: 8px; font: inherit; resize: vertical; min-height: 60px; }
    button { background: #f59e0b; color: #0a0a0a; border: 0; padding: 0 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .meta { font-size: 0.75rem; color: #888; margin-top: 0.25rem; }
  </style>
</head>
<body>
  <header>
    <h1>GrantIQ — Grants Agent</h1>
    <a href="/dashboard.html" style="color: #f59e0b; text-decoration: none;">← Dashboard</a>
  </header>
  <main>
    <div id="messages" class="messages"></div>
    <div class="composer">
      <textarea id="input" placeholder="Ask about grants, request a draft, check deadlines..."></textarea>
      <button id="send">Send</button>
    </div>
  </main>

  <script>
    const messagesEl = document.getElementById('messages');
    const inputEl = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    let conversationId = localStorage.getItem('grantiq_conv') || null;

    function addMessage(role, text, meta) {
      const div = document.createElement('div');
      div.className = `msg ${role}`;
      div.textContent = text;
      messagesEl.appendChild(div);
      if (meta) {
        const metaDiv = document.createElement('div');
        metaDiv.className = 'meta';
        metaDiv.textContent = meta;
        messagesEl.appendChild(metaDiv);
      }
      window.scrollTo(0, document.body.scrollHeight);
    }

    async function send() {
      const text = inputEl.value.trim();
      if (!text) return;
      addMessage('user', text);
      inputEl.value = '';
      sendBtn.disabled = true;
      try {
        const res = await fetch('/api/grants/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text, conversation_id: conversationId, user_chat_id: 'rodney' }),
        });
        const data = await res.json();
        if (!res.ok) {
          addMessage('assistant', `Error ${res.status}: ${data.error || 'unknown'}`);
        } else {
          conversationId = data.conversation_id;
          localStorage.setItem('grantiq_conv', conversationId);
          addMessage('assistant', data.text || '(no text)', `Status: ${data.status} • Iterations: ${data.telemetry?.iterations} • Latency: ${data.telemetry?.latency_ms}ms`);
        }
      } catch (e) {
        addMessage('assistant', 'Network error: ' + e.message);
      } finally {
        sendBtn.disabled = false;
      }
    }

    sendBtn.addEventListener('click', send);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); send(); }
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/chat.html
git commit -m "feat(ui): add Grants agent chat panel"
```

---

### Task 7.2: Sessions viewer HTML

**Files:**
- Create: `public/sessions.html`

- [ ] **Step 1: Build sessions UI**

`public/sessions.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GrantIQ — Playwright Sessions</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; background: #0a0a0a; color: #e5e5e5; }
    header { padding: 1rem; border-bottom: 1px solid #333; display: flex; justify-content: space-between; }
    header h1 { margin: 0; font-size: 1.2rem; color: #f59e0b; }
    main { max-width: 1200px; margin: 0 auto; padding: 1rem; }
    .session { border: 1px solid #333; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .session.gated { border-color: #f59e0b; background: #1c1308; }
    .session.completed { border-color: #16a34a; }
    .session.failed { border-color: #dc2626; }
    .session h3 { margin: 0 0 0.5rem; }
    .status { display: inline-block; padding: 0.15rem 0.6rem; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
    .status.in_progress { background: #1e40af; }
    .status.gated { background: #f59e0b; color: #0a0a0a; }
    .status.completed { background: #16a34a; }
    .status.failed { background: #dc2626; }
    .screenshots { display: flex; gap: 0.5rem; overflow-x: auto; margin-top: 0.5rem; }
    .screenshots img { max-height: 150px; border: 1px solid #444; border-radius: 4px; }
    button { background: #f59e0b; color: #0a0a0a; border: 0; padding: 0.5rem 1rem; border-radius: 4px; font-weight: 600; cursor: pointer; }
  </style>
</head>
<body>
  <header>
    <h1>Playwright Sessions</h1>
    <a href="/dashboard.html" style="color: #f59e0b;">← Dashboard</a>
  </header>
  <main>
    <div id="sessions-list">Loading…</div>
  </main>

  <script>
    async function loadSessions() {
      const res = await fetch('/api/playwright/sessions');
      const data = await res.json();
      const list = document.getElementById('sessions-list');
      if (!data.sessions || data.sessions.length === 0) {
        list.innerHTML = '<p style="color: #888;">No sessions yet.</p>';
        return;
      }
      list.innerHTML = data.sessions.map((s) => renderSession(s)).join('');
      document.querySelectorAll('button[data-action="resume"]').forEach((btn) => {
        btn.addEventListener('click', () => resume(btn.dataset.sessionId));
      });
    }

    function renderSession(s) {
      return `
        <div class="session ${s.status}">
          <h3>${s.application_url}</h3>
          <span class="status ${s.status}">${s.status}</span>
          <span style="margin-left: 1rem; color: #888;">${s.form_type || 'other'} • Step ${s.current_step}</span>
          ${s.gate_reason ? `<p style="margin-top: 0.5rem;"><strong>Gate:</strong> ${escapeHtml(s.gate_reason)}</p>` : ''}
          ${s.status === 'gated' ? `<button data-action="resume" data-session-id="${s.id}">Approve & Resume</button>` : ''}
          <p style="font-size: 0.75rem; color: #666; margin-top: 0.5rem;">Started ${new Date(s.started_at).toLocaleString()}</p>
        </div>
      `;
    }

    function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

    async function resume(session_id) {
      const action = prompt('Optional note (e.g., "signed page 4")') || 'approved';
      const res = await fetch('/api/playwright/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id, user_action: action }),
      });
      const data = await res.json();
      alert(res.ok ? 'Resumed: ' + data.message : 'Error: ' + data.error);
      loadSessions();
    }

    loadSessions();
    setInterval(loadSessions, 10_000);
  </script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add public/sessions.html
git commit -m "feat(ui): add Playwright sessions viewer with gate-resume"
```

---

### Task 7.3: Alerts SSE + UI widget

**Files:**
- Create: `api/alerts/stream.js`
- Create: `api/alerts/post.js`
- Create: `api/alerts/list.js`
- Create: `api/alerts/mark-read.js`

- [ ] **Step 1: SSE stream endpoint**

`api/alerts/stream.js`:

```javascript
import { getSupabase } from '../../src/lib/supabase.js';

export default async function handler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const supabase = getSupabase();
  let lastSeenAt = new Date().toISOString();

  const interval = setInterval(async () => {
    try {
      const { data, error } = await supabase
        .from('alerts')
        .select('id, agent_id, severity, message, link, created_at')
        .gt('created_at', lastSeenAt)
        .order('created_at', { ascending: true });
      if (!error && data && data.length) {
        for (const alert of data) {
          res.write(`data: ${JSON.stringify(alert)}\n\n`);
          lastSeenAt = alert.created_at;
        }
      }
    } catch (e) { /* swallow */ }
  }, 5000);

  req.on('close', () => clearInterval(interval));
}
```

- [ ] **Step 2: List + mark-read endpoints**

`api/alerts/list.js`:

```javascript
import { listUnreadAlerts } from '../../src/lib/alerts.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method not allowed' });
  try {
    const alerts = await listUnreadAlerts(parseInt(req.query.limit || '50', 10));
    return res.status(200).json({ alerts });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
```

`api/alerts/mark-read.js`:

```javascript
import { markAlertRead } from '../../src/lib/alerts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });
  try {
    await markAlertRead(id);
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
```

`api/alerts/post.js`:

```javascript
import { postAlert } from '../../src/lib/alerts.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const { agent_id, severity, message, link } = req.body || {};
  if (!agent_id || !severity || !message) return res.status(400).json({ error: 'agent_id, severity, message required' });
  try {
    const id = await postAlert({ agentId: agent_id, severity, message, link });
    return res.status(200).json({ id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
```

- [ ] **Step 3: Add alerts widget to existing dashboard**

Open `public/index.html` and find the closing `</body>` tag. Insert before it:

```html
  <div id="grantiq-alerts" style="position: fixed; top: 1rem; right: 1rem; max-width: 320px; z-index: 9999;"></div>
  <script>
    (function() {
      const wrap = document.getElementById('grantiq-alerts');
      const seen = new Set();
      function render(alert) {
        if (seen.has(alert.id)) return;
        seen.add(alert.id);
        const colors = { info: '#1e40af', warning: '#f59e0b', high: '#dc2626', critical: '#7f1d1d' };
        const el = document.createElement('div');
        el.style.cssText = `background:${colors[alert.severity]};color:#fff;padding:0.75rem 1rem;border-radius:6px;margin-bottom:0.5rem;font-size:0.85rem;cursor:pointer;`;
        el.innerHTML = `<strong>${alert.agent_id}</strong> ${escapeHtml(alert.message)}${alert.link ? ` <a href="${alert.link}" style="color:#fff;text-decoration:underline;">view</a>` : ''}`;
        el.addEventListener('click', () => {
          fetch('/api/alerts/mark-read', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ id: alert.id })});
          el.remove();
        });
        wrap.prepend(el);
      }
      function escapeHtml(s) { return String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); }
      // Initial fetch
      fetch('/api/alerts/list').then(r => r.json()).then(d => (d.alerts || []).forEach(render));
      // SSE stream
      const es = new EventSource('/api/alerts/stream');
      es.onmessage = (ev) => { try { render(JSON.parse(ev.data)); } catch(_){} };
    })();
  </script>
```

- [ ] **Step 4: Syntax + commit**

```bash
for f in api/alerts/*.js; do node --check "$f" || exit 1; done
git add api/alerts/ public/index.html
git commit -m "feat(ui): add alerts SSE stream + dashboard widget + list/mark-read endpoints"
```

**▶ PHASE 7 CHECKPOINT:** UI complete. Chat panel works (Phase 5). Sessions viewer works (Phase 6). Alerts widget on dashboard. Test by triggering an alert from the chat agent and verifying it appears.

---

## Phase 8 — Cron endpoints

### Task 8.1: process-tasks cron (every 60s)

**Files:**
- Create: `api/cron/process-tasks.js`

- [ ] **Step 1: Implement**

`api/cron/process-tasks.js`:

```javascript
import { getSupabase } from '../../src/lib/supabase.js';
import { runPlaywrightTask } from '../../src/agents/playwright/index.js';

export default async function handler(req, res) {
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const supabase = getSupabase();
  // Claim ONE queued playwright task per run (atomic via update)
  const { data: claimed, error } = await supabase
    .from('agent_tasks')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('status', 'queued')
    .eq('to_agent', 'playwright')
    .order('created_at', { ascending: true })
    .limit(1)
    .select('*');

  if (error) return res.status(500).json({ error: error.message });
  if (!claimed || claimed.length === 0) return res.status(200).json({ ok: true, claimed: 0 });

  const task = claimed[0];
  // Fire-and-forget; cron call returns immediately so the 60s budget isn't bound to the browser session
  res.status(200).json({ ok: true, claimed: 1, task_id: task.id });
  setTimeout(() => {
    runPlaywrightTask({ task }).catch((e) => console.error('[cron/process-tasks] error:', e));
  }, 0);
}
```

- [ ] **Step 2: Syntax + commit**

```bash
node --check api/cron/process-tasks.js
git add api/cron/process-tasks.js
git commit -m "feat(cron): add process-tasks cron for Playwright queue draining"
```

---

### Task 8.2: daily-discovery cron (7am ET)

**Files:**
- Create: `api/cron/daily-discovery.js`

- [ ] **Step 1: Implement**

`api/cron/daily-discovery.js`:

```javascript
import { runGrantsTurn } from '../../src/agents/grants/index.js';

const ORGS = ['holigenix_healthcare', 'k1_management', 'owner_nonprofit'];

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const results = [];
  for (const orgId of ORGS) {
    try {
      const result = await runGrantsTurn({
        userMessage: `Daily discovery scan for ${orgId}: search the web for new grants matching this org's profile (use the org's certifications, regions, NAICS codes, mission). Save promising ones to the pipeline with status='new'. Score each. If any new grant scores ≥80% with deadline ≤21 days AND docs ≥85% ready, post a high-severity alert.`,
        conversationId: null,
        userChatId: `cron-discovery-${orgId}`,
      });
      results.push({ org: orgId, ok: true, status: result.status, iterations: result.telemetry?.iterations });
    } catch (e) {
      results.push({ org: orgId, ok: false, error: e.message });
    }
  }

  return res.status(200).json({ ok: true, results });
}
```

- [ ] **Step 2: Commit**

```bash
node --check api/cron/daily-discovery.js
git add api/cron/daily-discovery.js
git commit -m "feat(cron): add daily-discovery cron for all 3 orgs"
```

---

### Task 8.3: deadline-check cron (every 6h)

**Files:**
- Create: `api/cron/deadline-check.js`

- [ ] **Step 1: Implement**

`api/cron/deadline-check.js`:

```javascript
import { runGrantsTurn } from '../../src/agents/grants/index.js';

const ORGS = ['holigenix_healthcare', 'k1_management', 'owner_nonprofit'];

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const results = [];
  for (const orgId of ORGS) {
    try {
      const result = await runGrantsTurn({
        userMessage: `Check grant deadlines for ${orgId} in the next 21 days. For each urgent deadline, post an alert with severity='warning' (or 'high' if match_score >= 80%). Use list_deadlines and check_documents tools.`,
        conversationId: null,
        userChatId: `cron-deadlines-${orgId}`,
      });
      results.push({ org: orgId, ok: true, status: result.status });
    } catch (e) {
      results.push({ org: orgId, ok: false, error: e.message });
    }
  }
  return res.status(200).json({ ok: true, results });
}
```

- [ ] **Step 2: Commit**

```bash
node --check api/cron/deadline-check.js
git add api/cron/deadline-check.js
git commit -m "feat(cron): add deadline-check cron"
```

**▶ PHASE 8 CHECKPOINT:** All cron endpoints implemented. Test each by invoking with `Authorization: Bearer $CRON_SECRET`. Verify they return 200 and produce expected DB writes.

---

## Phase 9 — Production cutover

### Task 9.1: Vercel project link + production env vars

- [ ] **Step 1: Link or create Vercel project**

```bash
npx vercel link --yes
```

If prompted, link to existing `grantiq-ivory` project. If creating new, name it `grantiq-vercel` under your scope.

- [ ] **Step 2: Set production env vars**

Run each of these (replace `<value>` with the real value from Railway snapshot):

```bash
for var in \
  "ANTHROPIC_API_KEY" \
  "ANTHROPIC_MODEL" \
  "SUPABASE_URL" \
  "SUPABASE_SERVICE_ROLE_KEY" \
  "PERPLEXITY_API_KEY" \
  "YOUTUBE_API_KEY" \
  "OPENROUTER_API_KEY" \
  "CRON_SECRET" \
  "VERCEL_SANDBOX_BROWSER_WS"
do
  echo "Setting $var..."
  npx vercel env add "$var" production
done
```

For `CRON_SECRET`, generate a fresh random value: `openssl rand -hex 32`.

- [ ] **Step 3: Pull env to local for testing**

```bash
npx vercel env pull .env.local
```

- [ ] **Step 4: Run smoke locally against production env**

```bash
npx vercel dev --listen 3000 &
sleep 5
node scripts/smoke-grants.mjs
```

Expected: SMOKE PASSED.

- [ ] **Step 5: Stop vercel dev**

---

### Task 9.2: Deploy to Vercel production

- [ ] **Step 1: Deploy**

```bash
npx vercel --prod --yes
```

Expected: build succeeds; deployment URL printed.

- [ ] **Step 2: Verify health**

```bash
DEPLOY_URL=$(npx vercel ls --prod | head -2 | tail -1 | awk '{print $2}')
curl -s "https://${DEPLOY_URL}/api/health" | python3 -m json.tool
```

Expected: status='ok', supabase='ok', anthropic='configured'.

- [ ] **Step 3: Smoke test live**

```bash
BASE_URL="https://${DEPLOY_URL}" node scripts/smoke-grants.mjs
```

Expected: SMOKE PASSED on live deployment.

- [ ] **Step 4: Tag the deployment**

```bash
git tag -a "v2.0.0-vercel-cutover" -m "First Vercel-hosted GrantIQ deployment"
git push origin v2.0.0-vercel-cutover
```

---

### Task 9.3: Stop the Railway service

- [ ] **Step 1: Stop (do NOT delete)**

In Railway dashboard → grantiq-bot → Settings → Pause Service.

This keeps the service config + env vars intact so we can re-enable for rollback.

- [ ] **Step 2: Document the stop**

Append to `_archive/railway-snapshot-2026-05-04/cutover.md`:

```markdown
# Railway → Vercel Cutover

**Cutover at:** <timestamp>
**Vercel deploy URL:** <url from Task 9.2>
**Railway service:** Paused (NOT deleted) — can be re-enabled within 7 days for rollback
**Tag:** v2.0.0-vercel-cutover
```

- [ ] **Step 3: Commit**

```bash
git add _archive/railway-snapshot-2026-05-04/cutover.md
git commit -m "chore: document Railway → Vercel cutover"
git push
```

---

### Task 9.4: End-to-end production verification

- [ ] **Step 1: Open chat in browser**

Visit `https://${DEPLOY_URL}/chat.html`. Send: "List the top 3 grants for K1 Management."

Expected: response returns within 30s with actual K1 grants from Supabase.

- [ ] **Step 2: Trigger an alert**

In chat, send: "Test the alert system: post a high-severity alert with message 'cutover smoke test'."

Open `/dashboard.html`. Expected: alert appears in the top-right widget within 10s.

- [ ] **Step 3: Test Playwright with a safe target**

Choose a benign public form (e.g., https://httpbin.org/forms/post for testing).

In chat: "Start a Playwright session at https://httpbin.org/forms/post for org_id=k1_management. Just navigate, screenshot, snapshot the page, then end_session. Don't fill anything."

Expected: a session appears at `/sessions.html` with status=completed and at least 1 screenshot URL.

- [ ] **Step 4: Verify cron schedules are registered**

```bash
npx vercel crons ls
```

Expected: 3 entries: process-tasks (* * * * *), daily-discovery (0 12 * * *), deadline-check (0 */6 * * *).

**▶ PHASE 9 CHECKPOINT — CUTOVER COMPLETE.** Railway is paused. Vercel is live. End-to-end verification passed. Now enter monitoring period.

---

## Phase 10 — Post-cutover monitoring + rollback runbook

### Task 10.1: 24-hour checkpoint

- [ ] **Step 1: Pull metrics from agent_activity_log**

24 hours after cutover, run:

```sql
-- In Supabase SQL editor
select
  agent_id,
  count(*) filter (where action = 'chat_turn') as chat_turns,
  count(*) filter (where action = 'task_run') as playwright_runs,
  avg((metadata->>'latency_ms')::numeric) as avg_latency_ms,
  sum((metadata->>'tokens_in')::numeric) as total_tokens_in,
  sum((metadata->>'tokens_out')::numeric) as total_tokens_out
from agent_activity_log
where created_at > now() - interval '24 hours'
group by agent_id;
```

- [ ] **Step 2: Check error rate**

```sql
select detail, count(*)
from agent_activity_log
where created_at > now() - interval '24 hours'
  and detail not in ('success', 'partial')
group by detail
order by count desc;
```

If error rate > 5% of total turns: investigate before continuing.

- [ ] **Step 3: Document checkpoint**

Append to `_archive/railway-snapshot-2026-05-04/cutover.md`:

```markdown
## 24h checkpoint — <date>

- chat turns: X
- playwright runs: X
- avg latency: X ms
- total tokens (in/out): X / X
- error rate: X%
- decisions: continue | rollback
```

---

### Task 10.2: 72-hour checkpoint

- [ ] **Step 1: Repeat metrics from 10.1 with `interval '72 hours'`**

- [ ] **Step 2: Compute monthly cost projection**

Anthropic billing dashboard: actual usage so far. Project to monthly. If projection > $200, review the spec §10.5 cost cap.

- [ ] **Step 3: Update cutover.md with 72h block**

If 72h is clean (error rate <5%, costs on track, no user complaints): proceed to Task 10.3. Otherwise: investigate, possibly rollback (Task 10.4).

---

### Task 10.3: 7-day archival of Railway service

(Run only if 72h checkpoint passes.)

- [ ] **Step 1: Archive grantiq-bot Railway service**

Railway dashboard → grantiq-bot → Settings → Archive (or rename to `grantiq-bot-RETIRED-<date>` and stop billing).

- [ ] **Step 2: Archive openclaw repos**

For each of `director-openclaw`, `finder-openclaw`, `tracker-openclaw`, `monitor-openclaw`:

```bash
cd ~/Documents/GitHub/<repo>
git tag "archived/$(date +%Y-%m-%d)"
git push --tags
# Update README.md to point at grantiq repo
```

- [ ] **Step 3: Update CLAUDE.md**

Open `CLAUDE.md` (in grantiq repo root). Replace the architecture section with:

```markdown
## Architecture (post-2026-05-04 SDK migration)

- **Runtime:** Vercel (functions + cron + static dashboard)
- **Agents:** 2 (Grants + Playwright). See `src/agents/`.
- **Persona files:** `workspace/grants.md`, `workspace/playwright.md`
- **Memory:** Supabase tables `grants_conversations`, `grants_messages`, `playwright_sessions`, `agent_notes`
- **Tool-use loop:** `src/lib/anthropic-client.js` (lifted from scout-vercel)

### Removed
- Railway (formerly grantiq-bot, archived <date>)
- OpenClaw / composio-core
- Telegram bot (replaced by command center chat)
- 10-agent decomposition (collapsed into 2)
- The 1400-line `index.js` monolith (still in repo for archive; not deployed)
```

- [ ] **Step 4: Final commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md to reflect post-SDK architecture"
git push
```

---

### Task 10.4: Rollback procedure (do NOT run unless monitoring fails)

> Only execute this if 24h or 72h checkpoint shows critical degradation (error rate >10%, repeated agent crashes, severe cost overrun, or business-critical functionality broken).

- [ ] **Step 1: Pause Vercel cron jobs**

Vercel dashboard → grantiq-vercel → Settings → Crons → toggle off all 3.

- [ ] **Step 2: Resume Railway service**

Railway dashboard → grantiq-bot → Resume.

Wait 60s. Verify `https://grantiq-bot-production.up.railway.app/api/health` returns 200.

- [ ] **Step 3: Re-point command center**

Update `public/index.html` to set `const API = 'https://grantiq-bot-production.up.railway.app';` (revert the chat.html / sessions.html changes — they don't have a Railway equivalent, so they'll show empty states; acceptable during rollback).

Deploy:

```bash
npx vercel --prod --yes
```

- [ ] **Step 4: Tag and document the rollback**

```bash
git tag -a "rollback-$(date +%Y-%m-%d)" -m "Rolled back from Vercel SDK to Railway. See cutover.md."
git push --tags
```

Append to `cutover.md`:

```markdown
## ROLLBACK — <date>

**Trigger:** <one paragraph describing what failed>
**Action:** Vercel crons paused, Railway resumed, command center re-pointed
**Postmortem:** Required before re-attempting cutover. Document in `docs/postmortems/<date>-vercel-rollback.md`.
```

- [ ] **Step 5: Write the postmortem**

Standard postmortem template — root cause, timeline, what worked, what failed, prevention. Save to `docs/postmortems/<date>-vercel-rollback.md`. Commit.

**▶ PHASE 10 CHECKPOINT — END.** Either monitoring is clean and old systems are archived, or rollback was executed and a postmortem is written.

---

## Final notes

- **Plan execution time estimate:** Phases 0-2 ~2-3 hours. Phases 3-5 ~6-8 hours. Phase 6 (Playwright) ~4-6 hours including Sandbox debugging. Phases 7-8 ~3-4 hours. Phase 9 cutover ~1-2 hours. Total: ~16-23 hours of focused implementation work, spread across multiple sessions.
- **Pause points:** Phase checkpoints (after each ▶) are natural pause-and-test boundaries. Do not skip checkpoints.
- **TDD coverage:** Library code in Phase 3 (constants, supabase, memory) has unit tests. Tools in Phase 4 are syntax-checked but covered primarily by the Phase 5 smoke test. Browser tools in Phase 6 are covered by manual testing against a real form (Phase 6 checkpoint).
- **Hot path on rollback:** If you have to rollback, time-to-Railway-restore should be <15 min. Any longer means the rollback runbook has gaps — update §10.4.

