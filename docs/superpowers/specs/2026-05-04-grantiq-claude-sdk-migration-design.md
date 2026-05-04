# GrantIQ — OpenClaw + Railway → Claude SDK + Vercel Migration Design

**Date:** 2026-05-04
**Owner:** Rodney Williams
**Status:** Approved design, pending implementation plan
**Reference PRD:** `~/Documents/GitHub/openclaw-to-claude-sdk-migration-prd.md`
**Reference implementation:** `~/Documents/GitHub/scout-vercel/` (STR PM Scout migrated to same pattern)

---

## 1. Executive summary

GrantIQ today runs as a single 1,400-line Node.js monolith on Railway with 10 named "agents" implemented as functions in `index.js`, using OpenClaw (via `composio-core`) for tool access and Telegram as the primary interface. The Railway deployment has been failing intermittently (most recently confirmed 502 on 2026-05-04 with last successful agent activity on 2026-04-10).

This migration retires Railway and OpenClaw entirely, replacing them with **two agents on Vercel** using the Anthropic SDK directly: a **Grants agent** (research + drafting) reachable through chat in the existing command center, and a **Playwright agent** (browser-based form filling) that operates as a separate session-based tool for any business form, not just grant applications.

Memory and learning come from a four-layer system: a static persona file per agent, live project facts from Supabase, accumulated agent notes (Layer 3, the actual "learning"), and full conversation history.

---

## 2. Goals

1. Eliminate Railway and OpenClaw from the GrantIQ stack. One runtime: Vercel.
2. Reduce 10 named agents to 2 functional agents (Grants + Playwright). The "10 agents" framing was an artifact of OpenClaw's per-agent-deployment pattern; Claude can hold all of those capabilities as tools in a single agent.
3. Move user interaction from Telegram to the existing command center (`grantiq-ivory.vercel.app`). One chat surface for the Grants agent, one session viewer for Playwright.
4. Give agents persistent memory of project details, with explicit support for "learning and growing" through agent-written notes.
5. Reduce manual application work: Playwright fills forms autonomously up to predefined human gates (signatures, CAPTCHAs, final submit, certifications).
6. Extend Playwright to handle any business form (grant applications, vendor onboarding, certification renewals, RFPs, COSTARS quarterly forms, etc.), not grants only.

## 3. Non-goals

- Multi-tenant or multi-user — GrantIQ has one user (Rodney).
- Replacing Supabase. The DB layer stays unchanged; we add tables.
- Migrating away from OpenRouter as a fallback provider. (R1 uses Anthropic direct; OpenRouter fallback is deferred.)
- Migrating the rest of the OpenClaw fleet (STR PM, others). This spec covers GrantIQ only; the migration PRD is reusable per-agent for the rest.
- Re-platforming the dashboard. The Vercel command center stays where it is; we add chat and session-viewer routes to it.

---

## 4. Architecture

### 4.1 Runtime

```
┌─────────────────── Vercel project: grantiq-vercel ───────────────────┐
│                                                                       │
│  Static dashboard (existing command center)                           │
│  ├─ /dashboard.html                                                   │
│  ├─ /k1-upload.html                                                   │
│  ├─ /holigenix-upload.html                                            │
│  └─ /chat.html  (NEW — Grants agent chat surface)                     │
│  └─ /sessions.html  (NEW — Playwright session viewer)                 │
│                                                                       │
│  Vercel Functions                                                     │
│  ├─ /api/grants/chat              POST  Grants agent turn handler     │
│  ├─ /api/grants/conversations     GET   List user's conversations     │
│  ├─ /api/playwright/start         POST  Start a form-fill session     │
│  ├─ /api/playwright/resume        POST  Resume from a gate            │
│  ├─ /api/playwright/sessions      GET   List + status of sessions     │
│  ├─ /api/alerts/stream            SSE   Push alerts to UI             │
│  ├─ /api/alerts/post              POST  Agents post alerts            │
│  ├─ /api/cron/process-tasks       POST  Vercel cron, every 60s        │
│  ├─ /api/cron/daily-discovery     POST  Vercel cron, 7am ET           │
│  ├─ /api/cron/deadline-check      POST  Vercel cron, every 6h         │
│  └─ /api/health                   GET   Liveness                      │
│                                                                       │
│  Vercel Sandbox (separate runtime, invoked from /api/playwright/*)    │
│  └─ Playwright browser sessions (long-running, isolated)              │
└────────────────────────────────────────────────────────────────────────┘

┌─────────────────── External services ───────────────────┐
│  Anthropic API           — LLM calls (claude-sonnet-4)  │
│  Supabase                — DB + Storage (unchanged)     │
│  Perplexity              — web_search tool              │
│  YouTube Data API v3     — youtube_search tool          │
│  Gmail (via OAuth)       — send_email tool              │
└──────────────────────────────────────────────────────────┘
```

### 4.2 What's removed

| Component | Replacement |
|-----------|-------------|
| Railway service `grantiq-bot` | Vercel functions in same project as dashboard |
| `index.js` 1400-line monolith | `src/agents/grants/`, `src/agents/playwright/`, `src/lib/` |
| `composio-core` dependency | Direct fetch calls to provider APIs (Perplexity, Gmail, etc.) |
| OpenClaw gateway / wrapper | None — Anthropic SDK called directly from Vercel function |
| Telegram bot polling | Command center chat UI |
| `node-cron` in-process | Vercel cron HTTP triggers |
| Per-agent OpenClaw repos (`director-openclaw`, `finder-openclaw`, etc.) | Archived — work consolidates into `grantiq-vercel` |
| 10 named agents | 2 functional agents |
| 11 workspace persona files per agent (SOUL, IDENTITY, PLAYBOOK, etc.) | 1 short persona file per agent |

### 4.3 What stays unchanged

- **Supabase project** (`zamokpkpneedvluthsem.supabase.co`) — same DB, new tables added (see §6).
- **Document Vault** (Supabase Storage bucket `grant-documents`) — same upload portals (`k1-upload.html`, `holigenix-upload.html`) read/write directly to Supabase.
- **Org profiles** for Holigenix, K1 Management, Owner Nonprofit — migrated from `index.js` constants into a Supabase `orgs` table (one-time data move).
- **Existing tables:** `grant_opportunities`, `application_drafts`, `document_vault`, `agent_activity_log`. Same shape, same data.

---

## 5. Agents

### 5.1 Grants agent (research + drafting)

**Purpose:** Find grants the user qualifies for, score them, track deadlines, draft narratives, and generate budgets. Operates in two modes (discovery / drafting) within a single agent.

**Surface:** Chat panel in command center (`/chat.html`). One conversation per user-initiated thread.

**Persona file:** `workspace/grants.md` (~500 tokens). Replaces the 11-file persona pattern. Contents:
- Identity and voice (one paragraph)
- Hard rules (PHI exclusion for Holigenix, faith-based positioning for foundations, SDVOSB lead for federal)
- Mode-switching instructions (discovery vs drafting)
- When to call `record_note`, `alert_user`, `delegate_to_playwright`

**Tools:**

| Tool | Purpose | Side effect |
|------|---------|-------------|
| `web_search(query)` | Perplexity-backed grant discovery | None |
| `fetch_webpage(url)` | Read grant detail pages | None |
| `query_pipeline(filters)` | Read `grant_opportunities` | None |
| `save_grant(data)` | Write `grant_opportunities` row | DB write |
| `score_grant(grant_id, org_id)` | LLM scoring against org profile | DB write to `grant_opportunities.match_score` |
| `check_documents(org_id, grant_id)` | Readiness check vs `document_vault` | None |
| `list_deadlines(org_id, days)` | Deadlines in next N days | None |
| `get_grant(grant_id)` | Fetch full grant detail | None |
| `get_org(org_id)` | Fetch org profile | None |
| `get_document_vault(org_id)` | List available documents | None |
| `read_document(doc_id)` | Fetch a single doc's content | None |
| `draft_narrative(grant_id, org_id, sections, prior_draft_id?)` | Generate application narrative | DB write to `application_drafts` |
| `generate_budget(grant_id, org_id, amount, line_items)` | Generate line-item budget | DB write to `application_drafts` |
| `save_draft(grant_id, narrative, budget, status)` | Persist a draft | DB write |
| `search_past_drafts(query)` | RAG over Grants agent's history | None |
| `get_draft(draft_id)` | Fetch a draft | None |
| `delegate_to_playwright(grant_id, draft_id, application_url)` | Hand off to Playwright | Insert into `agent_tasks` |
| `record_note(note, tags, confidence, supersedes?)` | Layer 3 learning | DB write to `agent_notes` |
| `alert_user(message, severity, link?)` | Push alert to UI | DB write + SSE broadcast |

**Boundaries (system prompt enforces):**
- Never submits anything (delegates to Playwright)
- Never makes commitment decisions on user's behalf — recommends, user approves
- Never includes PHI in narratives for Holigenix
- When grant scores ≥80%, deadline ≤21 days, docs ≥85% ready: alert user with severity=high

### 5.2 Playwright agent (form filling)

**Purpose:** Fill out web forms autonomously up to defined human-approval gates. Scope: any business form (grant applications, vendor onboarding, certification renewals, RFPs, COSTARS quarterly forms, SAM.gov updates, etc.).

**Surface:** Session viewer in command center (`/sessions.html`). One session per form-filling run. Real-time screenshots, current step, gate-approval buttons.

**Runtime:** Vercel Sandbox. Required because:
- Browser sessions can take 5+ minutes (regular Vercel functions cap at 300s)
- Browser state must persist across HTTP requests during gate-and-resume
- Sandbox isolates browser process from chat agent's runtime

**Persona file:** `workspace/playwright.md` (~600 tokens). Contents:
- Identity: form-filling specialist for any business form
- Hard rules: never submit without explicit human approval, never bypass CAPTCHAs, never type into signature fields
- Failure protocol: on any unexpected field, gate for human
- Knowledge expectations: Claude's general training covers most US business forms (SF-424, W-9, COSTARS forms, SAM.gov, common LLC formations); fall back to gate-for-human when uncertain

**Tools:**

| Tool | Purpose |
|------|---------|
| `start_session(grant_id?, application_url, draft_id?)` | Spawn Vercel Sandbox browser. `grant_id` and `draft_id` optional — non-grant forms have neither. |
| `navigate(url)` | Navigate to URL |
| `screenshot()` | Capture page; stores in Supabase Storage; returns URL |
| `snapshot_page()` | Accessibility tree of current page (DOM-as-text for LLM reasoning) |
| `fill_field(selector, value)` | Type into input |
| `upload_file(selector, doc_id)` | Upload from `document_vault` by ID |
| `click(selector)` | Click element |
| `select_option(selector, value)` | Choose from dropdown |
| `check_field(selector, expected_value)` | Verify a field's current value (used after fill_field for critical fields) |
| `save_progress()` | Checkpoint state to `playwright_sessions` |
| `gate_for_human(reason, screenshot_url)` | STOP, alert user, await resume |
| `submit_form()` | ALWAYS gates — never proceeds without explicit user "Approve Submit" click |
| `record_note(note, tags, confidence, supersedes?)` | Layer 3 learning |

**Hard gates (no exceptions):**
1. Signature fields (any field labeled "signature", "sign here", or with a canvas element)
2. CAPTCHAs (visual, audio, reCAPTCHA, hCaptcha)
3. Certification language ("certify", "attest", "swear under penalty of perjury")
4. Final submit button on any form
5. Any field whose label or context wasn't present in the initial form snapshot
6. Payment/credit card fields
7. Any redirect to a different domain mid-flow

**Boundaries (system prompt enforces):**
- Never generates content — uses provided draft (if grant) or asks user (if non-grant)
- Never decides what to submit — fills only what's in the source data
- Never auto-submits even after N successful runs on the same portal (per design decision: Option A, conservative)

### 5.3 What's NOT a separate agent (and why)

The original "10 agents" decomposition (Director, Finder, Writer, Analyst, Tracker, Monitor, Reporter, Vault, BudgetGen, Applicator) all collapse into the Grants agent's tool surface:

| Original agent | Becomes |
|----------------|---------|
| Director | The Grants agent itself (orchestrates its own work via tool selection) |
| Finder | `web_search`, `fetch_webpage`, `save_grant` tools |
| Writer | `draft_narrative`, `search_past_drafts` tools |
| Analyst | `score_grant`, `check_documents` tools |
| Tracker | `list_deadlines` tool + `alert_user` for urgent deadlines |
| Monitor | The cron `/api/cron/deadline-check` that calls the Grants agent with a "scan for changes" prompt |
| Reporter | A cron-triggered Grants agent run that emails or alerts a digest |
| Vault | `get_document_vault`, `read_document` tools (Vault is data, not an agent) |
| BudgetGen | `generate_budget` tool |
| Applicator | The Grants→Playwright handoff path |

This is YAGNI applied: each "agent" was really a tool the orchestrator (Director) called. We just call them directly from one agent now.

---

## 6. Data model

### 6.1 New tables

```sql
-- Per-agent conversation memory (scout-vercel pattern)
create table grants_conversations (
  id uuid primary key default gen_random_uuid(),
  channel text not null default 'web',
  user_chat_id text,
  started_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  metadata jsonb default '{}'::jsonb
);

create table grants_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references grants_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content jsonb not null,  -- Anthropic SDK message.content (string OR content-block array)
  tool_use_id text,
  created_at timestamptz not null default now()
);

create index on grants_messages (conversation_id, created_at);

-- Playwright sessions (different shape than chat — these are form-fill runs)
create table playwright_sessions (
  id uuid primary key default gen_random_uuid(),
  grant_id uuid references grant_opportunities(id),  -- null for non-grant forms
  draft_id uuid references application_drafts(id),    -- null for non-grant forms
  org_id text not null,
  application_url text not null,
  form_type text,  -- 'grant', 'vendor_onboarding', 'cert_renewal', 'rfp', 'costars', 'sam_gov', 'other'
  status text not null check (status in ('starting', 'in_progress', 'gated', 'awaiting_resume', 'completed', 'failed', 'cancelled')),
  current_step int default 0,
  total_steps int,
  state_json jsonb default '{}'::jsonb,  -- form fields filled so far
  screenshots jsonb default '[]'::jsonb, -- array of {step, url, taken_at}
  gate_reason text,
  gate_screenshot_url text,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  result jsonb
);

create index on playwright_sessions (status);
create index on playwright_sessions (grant_id);

-- Cross-agent learning (Layer 3)
create table agent_notes (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null check (agent_id in ('grants', 'playwright')),
  note text not null,
  tags text[] not null default '{}',
  confidence text not null check (confidence in ('low', 'medium', 'high')) default 'medium',
  source text,  -- conversation_id, session_id, or free-text
  supersedes uuid references agent_notes(id),
  archived_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index on agent_notes using gin (tags);
create index on agent_notes (agent_id, created_at desc) where archived_at is null;

-- Cross-agent task queue (Grants → Playwright handoff)
-- Cross-agent + cron task queue
-- to_agent='grants' is used by cron jobs (daily-discovery, deadline-check) that
--   queue work for the Grants agent rather than calling it inline.
-- to_agent='playwright' is used by the Grants agent's delegate_to_playwright tool.
create table agent_tasks (
  id uuid primary key default gen_random_uuid(),
  from_agent text not null,  -- 'grants', 'playwright', 'cron', or 'user'
  to_agent text not null check (to_agent in ('grants', 'playwright')),
  status text not null check (status in ('queued', 'claimed', 'in_progress', 'done', 'failed', 'gated')) default 'queued',
  payload jsonb not null,
  result jsonb,
  alert_id uuid,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  completed_at timestamptz
);

create index on agent_tasks (to_agent, status, created_at);

-- User-facing alerts (replaces Telegram messages)
create table alerts (
  id uuid primary key default gen_random_uuid(),
  agent_id text not null,
  severity text not null check (severity in ('info', 'warning', 'high', 'critical')),
  message text not null,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index on alerts (read_at, created_at desc);

-- Org profiles (migrated from index.js constants)
create table orgs (
  id text primary key,  -- 'holigenix_healthcare', 'k1_management', 'owner_nonprofit'
  name text not null,
  data jsonb not null,  -- full profile blob: legal structure, address, UEI, CAGE, NPI, certifications, regions, etc.
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

### 6.2 Existing tables — no schema change

- `grant_opportunities` — same
- `application_drafts` — same
- `document_vault` — same
- `agent_activity_log` — repurposed for telemetry only (per-turn latency, tokens, tool counts). Existing rows untouched.

### 6.3 Tables retired

None. The Telegram-related fields in existing tables (e.g., `agents.last_run_at`) become unused but harmless; cleanup deferred.

---

## 7. Memory model — the four layers in detail

### Layer 1: Persona (static)

Two short markdown files, source-controlled in the repo:
- `workspace/grants.md` — Grants agent identity + rules (~500 tokens)
- `workspace/playwright.md` — Playwright agent identity + rules (~600 tokens)

Loaded once at server startup, included in every system prompt.

### Layer 2: Project facts (live)

A single SQL view `agent_context_v` joins:
- All rows from `orgs`
- Aggregate counts from `document_vault` (per org: uploaded count / required count, missing list)
- Top 5 grants from `grant_opportunities` per org (by match_score desc)
- Upcoming deadlines from `grant_opportunities` (next 30 days)

Loaded fresh on every chat turn. ~50-100ms query. Rendered into the system prompt as a Markdown context block.

### Layer 3: Agent notes (learned)

`agent_notes` table. The "growing" mechanism. Loaded on every turn:
- Top 20 notes by relevance (tag-match against current message keywords) + recency (created_at desc)
- Filtered to `archived_at is null` and `expires_at > now()`
- Cross-agent: Grants reads Playwright's notes and vice versa

Written via the `record_note` tool. Each agent's persona prompts it on when to record:

> *"Record a note when you discover a non-obvious fact that would help future work — agency reviewer preferences, form quirks, eligibility nuances, voice/tone wins. Do not record what's in the org profile or trivially Google-able."*

### Layer 4: Conversation history (per-thread)

- Grants agent: `grants_conversations` + `grants_messages`
- Playwright agent: `playwright_sessions` (different shape — sessions, not chats)

Full message replay across turns via the scout-vercel `loadOrCreateConversation` + `persistTurn` pattern. When a Grants conversation exceeds 100K tokens, the oldest messages get LLM-summarized into a single `system: <summary>` injected at the front. Pattern matches Claude Code's internal compaction.

---

## 8. Implementation decisions (PRD §7 answers)

### 8.1 SDK language: TypeScript / JavaScript

**Decision:** JavaScript (ESM, matching `scout-vercel`).

Rationale:
- Reuses `scout-vercel/src/agent/client.js` verbatim (160 lines of tested tool-use loop)
- Existing dashboard is HTML+JS, no need to introduce Python
- All other Vercel-hosted agents in the fleet are JS

### 8.2 Tool layer: Hand-rolled tool loop (no MCP, no Agent SDK framework)

**Decision:** Lift `client.js` from `scout-vercel`. Tools are plain async functions registered in a `dispatch(name, input)` callback.

Rationale:
- `claude-agent-sdk` package adds abstraction we don't need; we already have a working loop
- MCP-direct would mean running MCP servers in serverless (awkward); we don't have stable MCP servers for Perplexity, Gmail, etc.
- Plain functions are easier to test and debug
- Matches the proven pattern in the fleet

### 8.3 Scheduler: Vercel cron (HTTP-triggered)

**Decision:** Vercel cron triggers HTTP endpoints. No in-process scheduler.

Rationale:
- Vercel functions are stateless and short-lived; in-process cron requires always-on hosting (which is what we're moving away from)
- `scout-vercel` uses this exact pattern (`/api/cron/daily-scan`)
- Vercel cron is configured in `vercel.json`, easy to inspect and modify
- Cron auth via `CRON_SECRET` env var, checked in handler

Schedules:
- `/api/cron/daily-discovery` — 7am ET daily (Grants agent runs scan for new opportunities)
- `/api/cron/deadline-check` — every 6 hours (Grants agent checks for urgent deadlines)
- `/api/cron/process-tasks` — every 60 seconds (drains `agent_tasks` queue)

---

## 9. Migration strategy (per PRD §6, hard cutover)

### 9.1 Stage out (safe to do anytime)
1. Snapshot Railway state and env vars to local disk
2. Export current Supabase data (`pg_dump` of all GrantIQ tables)
3. Create new Vercel project (or new directory in existing project) for agent code
4. Build out `src/`, persona files, tools, smoke tests
5. Run smoke tests against either (a) a separate Supabase staging project, or (b) the same project with table suffix `_test`. Choice deferred to implementation plan based on Supabase plan tier.

### 9.2 Cutover (single deploy window)
1. Run new table migrations on production Supabase (additive — no destructive changes)
2. Migrate org profile data from `index.js` constants into `orgs` table (one-shot script)
3. Deploy agent functions to Vercel
4. Verify `/api/health` returns 200 and a smoke test completes end-to-end
5. Update command center static HTML to point to new chat/session endpoints
6. Stop the Railway `grantiq-bot` service (do not delete — keep for 7 days as rollback target)
7. Smoke-test live: chat with Grants agent, kick off a non-production Playwright session

### 9.3 Post-cutover
- 72h monitoring: error rates, LLM latency, tool failure rates (`agent_activity_log`)
- After 7 clean days: archive Railway service and `*-openclaw` repos with `archived/2026-05-XX` tag
- Update CLAUDE.md to reflect new architecture

### 9.4 Rollback procedure (if 72h monitoring shows degradation)
1. Stop Vercel cron jobs
2. Re-enable Railway `grantiq-bot` service
3. Telegram users (none in production now — moot)
4. Tag the failed Vercel deployment for postmortem
5. Document the failure in this spec under §10 gotchas

---

## 10. Risks and open questions

### 10.1 Vercel Sandbox runtime maturity

Vercel Sandbox is GA as of 2026-01 but still relatively new. Risks:
- Cold start times for spawning a browser session
- Pricing surprises on long sessions (should test with a 10-minute session before committing)
- Browser version drift vs. Playwright library version

**Mitigation:** Build a thin abstraction layer (`src/lib/browser.js`) so we can swap to Browserbase if Sandbox proves problematic. The `start_session` / `navigate` / `fill_field` tool surface stays the same.

### 10.2 Form-filling correctness for varied form schemas

Claude has broad training on US business forms but won't perfectly handle every state-specific quirk (e.g., NJ procurement forms, specific COSTARS templates).

**Mitigation:** Conservative gating (Option A) is the primary mitigation. Layer 3 notes accumulate per-portal knowledge over time, retrieved by tag (e.g., `tags=['grants-gov', 'sf-424']`) at the start of each Playwright session. First few runs on any new portal will be slow (lots of gates); subsequent runs faster as notes accumulate.

### 10.3 Data migration from `index.js` to `orgs` table

Org profiles in `index.js` are ~200 lines of nested objects with computed fields (e.g., `regions`, `certifications` derived from other fields). Direct copy may miss derived data.

**Mitigation:** One-shot migration script that runs `node -e "console.log(JSON.stringify(orgs))"` against the existing `index.js`, dumps to JSON, transforms, inserts into `orgs` table. Verify with diff.

### 10.4 Conversation summarization quality at 100K threshold

Auto-summarizing old turns can lose important context (a fact mentioned 50 turns ago that's still relevant).

**Mitigation:** Layer 3 notes are the primary mechanism for persisting facts that *should* survive summarization. The summary is best-effort; the notes are durable.

### 10.5 Cost discipline

Anthropic API + Vercel + Supabase + Perplexity could run higher than the previous Railway+OpenRouter setup if not metered. R1 estimate: $50-150/month at GrantIQ's expected volume (low double-digit chat turns/day, daily cron runs, occasional Playwright sessions).

**Mitigation:**
- Prompt caching enabled on Anthropic SDK calls (system prompt is mostly static — Layer 1 + Layer 2 + Layer 3 digest cache cleanly)
- Monthly cost dashboard via `agent_activity_log` (already tracks per-turn token counts)
- Hard cap: if monthly Anthropic spend exceeds $200, alert user and degrade to less aggressive cron schedule

### 10.6 The 502 problem isn't fully diagnosed

We don't actually know why Railway has been returning 502. This migration sidesteps the problem rather than solving it. If the root cause was an env var or token issue (not a runtime issue), the same problem could recur on Vercel.

**Mitigation:** During §9.1 stage-out, attempt to bring Railway back online with the existing `c5faed6` fix and capture logs. Even if we don't fix it long-term, knowing the cause prevents repeating the mistake on Vercel.

---

## 11. Success criteria

The migration is successful when:

1. Railway service `grantiq-bot` is offline (stopped or deleted)
2. All current grants in `grant_opportunities` (14 K1 + 8 Holigenix as of 2026-05-04, may differ at cutover) are accessible via the Grants agent's `query_pipeline` tool with no data loss
3. A new grant search initiated via chat returns ≥5 new grants per org within 5 minutes (matching previous Finder agent's typical run)
4. A Grants agent chat conversation persists across page refreshes and the agent recalls prior turns
5. A Playwright session can fill a sample form (e.g., NJ MWBE re-cert form) up to the signature gate without errors, and resume after user signs
6. `agent_notes` table contains ≥10 notes after 1 week of use, demonstrating Layer 3 learning
7. Monthly cost is under $200
8. No PHI appears in any agent output for Holigenix-related grants (manual audit of first 20 outputs)

---

## 12. What this spec does NOT cover

- Implementation order and time estimates → see implementation plan (next document)
- Specific TypeScript types / Zod schemas → defined during implementation
- Exact persona file contents → drafted during implementation
- Vercel project linking and env var setup → standard, covered in implementation plan
- Test strategy beyond smoke tests → covered in implementation plan

---

## 13. Sign-off

This design supersedes the original "10 agents on OpenClaw + Railway" architecture. Sections 1-3 approved by Rodney via brainstorming dialogue 2026-05-04. **Full written spec pending Rodney's review before proceeding to implementation plan.**

Reference materials:
- Migration PRD: `~/Documents/GitHub/openclaw-to-claude-sdk-migration-prd.md`
- Reference implementation: `~/Documents/GitHub/scout-vercel/`
- Old monolith (to retire): `~/Documents/GitHub/grantiq/index.js`
- OpenClaw repos to archive: `director-openclaw`, `finder-openclaw`, `tracker-openclaw`, `monitor-openclaw`
