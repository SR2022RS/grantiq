# GrantIQ — Product Requirements Document

**For:** Grant writer redesign review
**Prepared by:** Rodney Williams (sr2022rs@github)
**Last updated:** 2026-05-06
**Status:** Production — running at `grantiq-ivory.vercel.app`
**Format:** This document is a Markdown file. You can edit it directly. Sections marked **[YOUR INPUT]** are intentionally blank for you to fill in. The bottom of the doc has a prompt block you can paste into Claude Chat to get a structured review.

---

## 0. HOW TO USE THIS DOCUMENT

You have two roles to play with this PRD:

1. **Grant writer reviewer.** Read sections 1-9 to understand what GrantIQ does today. Then go to section 10 and fill in **[YOUR INPUT]** blocks with what's missing, broken, or what would make your daily grant writing 10× faster.
2. **AI collaborator.** Paste the entire PRD into Claude Chat (claude.ai). Use the prompt at the bottom (section 12) to ask Claude to find gaps, propose features, and pressure-test the design.

When you've marked it up, send it back to Rodney. He'll triage your feedback into the next development cycle.

**Don't worry about breaking anything in this doc.** It's a working artifact. Strike-through sections that are wrong. Add comments. Rewrite paragraphs. The messier this gets, the more useful your feedback.

---

## 1. EXECUTIVE SUMMARY

**GrantIQ is an AI-powered grant operations platform** that helps a small operator manage grant discovery, application drafting, document readiness, and submission across multiple businesses simultaneously. It is built for someone who runs 2-5 small businesses and needs grant capital but cannot afford to hire a full-time grant writer or pay subscription tools like Instrumentl ($299-$999/mo) or HelloSkip.

Today GrantIQ tracks **4 businesses** for one operator (Rodney):

| Business | Type | Geography | Primary grant categories |
|---|---|---|---|
| **Holigenix Healthcare LLC** | 508(c)(1)(a) Faith-Based Nonprofit, Pediatric Home Health | Georgia | HRSA, foundation, Medicaid, healthcare equity |
| **K1 Management LLC** | MBE/MWBE/SDB Government Contractor | Pennsylvania, New Jersey, Delaware | State procurement, federal contracts, MBDA, COSTARS |
| **Owner Nonprofit** | Faith-based community organization | Georgia | Foundation, community development |
| **AI Junkies University** | Online workforce development institution | Georgia (Online) | DOL/WIOA, STEM education, economic mobility |

The platform uses **two AI agents** (Grants agent + Playwright agent) to automate the most tedious parts of grant operations:

- Discovering grants the operator qualifies for
- Drafting application narratives
- Generating supporting documents (capability statements, letters of support, W-9s, org charts)
- Filling out grant application forms in browsers (with human approval gates)
- Tracking deadlines, document expiry, and submission status

**Why this exists:** Every small business owner who applies for grants knows the truth — 80% of the work is administrative repetition (different versions of the same narrative, the same docs in 12 file formats, deadline tracking across 50 funders). GrantIQ turns that 80% into AI work, leaving the human (the operator + the grant writer) to focus on the strategy and voice that actually wins applications.

---

## 2. WHO IT SERVES

### 2.1 Primary user: the small-business operator

A single person (or 2-3 person team) running multiple small businesses, all of which qualify for some form of grant capital but none of which can justify a $10K-$30K/year grant writer retainer. They are technically capable enough to type and paste, but they're not coders. They want a single dashboard that covers all their entities.

**Daily questions this user has:**
- "What's coming due this week?"
- "What grants did the agent discover overnight that I should look at?"
- "I found this grant on LinkedIn — can you research it?"
- "Draft me an application for this opportunity."
- "Which of my businesses is missing a board list?"
- "Can you fill out this form for me while I do something else?"

### 2.2 Secondary user: the professional grant writer (YOU)

A grant writer the operator brings in to:
- Review agent-drafted narratives before submission
- Polish voice / tone / fundraising frame
- Identify grants the agent missed
- Flag eligibility concerns the agent overlooked
- Coach the operator on funder relationships

You are paid by the hour or per-application. Your time is valuable. The platform should give you maximum context in minimum clicks. You should be able to land on a grant and immediately understand: who the funder is, what they want, what we've drafted, what's missing, and where to focus your edits.

### 2.3 Future user: the partnered operator

The operator wants to onboard their partner businesses into GrantIQ — meaning the partner gets their own login, their own org space, and the agent works on their grants too. The "Add business" feature already supports this; auth scoping does not yet (currently a single shared password gates the whole portal).

### 2.4 Excluded users

This is **not** a SaaS product for thousands of nonprofits. It is not a competitor to Instrumentl. It is a **personal operations dashboard** for one operator who happens to run multiple businesses. If we ever multi-tenant it, that's a different product.

---

## 3. CORE ARCHITECTURE (one page)

```
                  ┌────────────────────────────────────┐
                  │   Vercel Edge / Routing Middleware │
                  │   • HTTP Basic Auth gate           │
                  │   • Cron triggers (3 schedules)    │
                  └──────────────┬─────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────────┐
        │                        │                            │
        ▼                        ▼                            ▼
┌───────────────┐      ┌──────────────────┐       ┌─────────────────────┐
│  Static SPA   │      │ Vercel Functions │       │ Vercel Cron Workers │
│  React 18 +   │      │ (Node.js 24)     │       │ • daily-discovery   │
│  Babel        │      │ • /api/grants/*  │       │ • deadline-check    │
│  standalone   │      │ • /api/orgs/*    │       │ • process-tasks     │
│  No build     │      │ • /api/cron/*    │       │                     │
│  step         │      │ • /api/playwright│       └──────────┬──────────┘
└───────┬───────┘      └────────┬─────────┘                  │
        │                       │                            │
        │ fetch                 │ Anthropic SDK              │ Anthropic SDK
        │                       ▼                            ▼
        │              ┌─────────────────────────────────────────┐
        └─────────────►│  Anthropic API (Claude Sonnet 4.5/4.6)   │
                       └────────────────┬────────────────────────┘
                                        │
                                        ▼
                              ┌──────────────────────┐
                              │ 2 agents:            │
                              │ • Grants agent       │
                              │ • Playwright agent   │
                              └──────────┬───────────┘
                                         │
                                         ▼
        ┌─────────────────────────────────────────────────┐
        │ Supabase (Postgres 17 + Storage)                │
        │ • orgs (JSONB profiles)                         │
        │ • grant_opportunities                           │
        │ • application_drafts                            │
        │ • document_vault                                │
        │ • org_kb, org_kb_files, org_templates           │
        │ • agent_notes, agent_tasks, alerts              │
        │ • Storage bucket: org-kb (PDFs, images)         │
        └─────────────────────────────────────────────────┘
```

### Stack details
- **Frontend:** React 18 + Babel-standalone (no build step; entire app runs in the browser, parses JSX at load). Single-page app with client-side routing via state, not React Router.
- **Backend:** Vercel Functions (Node.js 24) on Fluid Compute. Default timeout 300s. Long-running calls (drafting, research) hold the function open via fire-and-forget patterns.
- **Database:** Supabase Postgres 17. Most schema lives in `supabase/migrations/`. JSONB columns are used heavily on `orgs.data` for flexible org profiles.
- **Storage:** Supabase Storage bucket `org-kb` (private, 25MB file limit, signed URLs with 1-hour TTL). PDFs, images, markdown.
- **LLM:** Direct Anthropic SDK (`@anthropic-ai/sdk@^0.90.0`) — not via Vercel AI SDK. Uses Claude Sonnet 4.5 / 4.6 (currently `claude-sonnet-4-6`).
- **Agents:** Hand-rolled tool-use loop (~160 lines, no framework). Up to 8-15 tool iterations per turn. Persistent memory per agent via per-agent `<agent>_conversations` + `<agent>_messages` tables.
- **Cron:** Vercel cron jobs hit `/api/cron/*` endpoints on a schedule:
  - `*/1 * * * *` (every minute) — process-tasks (drains agent_tasks queue)
  - `0 12 * * *` (daily at noon UTC) — daily-discovery (finds new grants)
  - `0 */6 * * *` (every 6 hours) — deadline-check (flags upcoming deadlines)
- **Auth:** Vercel Routing Middleware doing HTTP Basic Auth with a single shared password (`PORTAL_PASSWORD` env var). Gates everything except `/api/cron/*` (which uses signed Vercel cron headers).

---

## 4. NAVIGATION TREE (every page)

The portal has the following navigation structure on the left rail:

```
GrantIQ
COMMAND CENTER
─────────────────────
VIEWING (org switcher)
 · All businesses        (default — combined view)
 · Holigenix             (org-specific filter)
 · K1 Mgmt
 · Owner NP
 · AI Junkies
 + Add business          (opens onboarding modal)

OPERATE
 · Inbox                 (priority queue — what needs attention NOW)
 · Pipeline              (every active grant, filterable)
 · Drafts                (every saved draft, ready/reviewing/submitted)
 · Sessions              (Playwright browser sessions, gated/running)
 · Calendar              (90-day deadline timeline + TBD bucket)

DOCUMENTS
 · Brief                 (per-org structured profile — pitch deck data)
 · Knowledge             (per-org KB: notes, links, PDF/image uploads)
 · Vault                 (per-org documents: uploaded, missing, drafted)
 · Templates             (reusable narrative blocks across orgs)

DISCOVERY
 · Sources               (which feeds the agent monitors, last scrape times)
 · Watchlists            (saved searches that alert on new matches)
 · Dismissed             (rejected grants log + reason for rejection)

RELATIONSHIPS
 · Funders               (per-funder relationship history, win rate)
 · Submissions           (every past submission + outcome + ROI)

INTELLIGENCE
 · Chat                  (Grants agent chat — persistent history)
 · Notes                 (Layer-3 agent learnings, filterable by tag)

SYSTEM
 · Settings              (integrations, cron schedule, telemetry)
```

### Right rail (visible on certain pages)

When the right rail is on, two sections show:
- **Alerts** — agent-emitted alerts (e.g., "Document expiring in 30 days," "Grant deadline in 3 days")
- **Agent activity** — live feed of agent tool calls and chat turns

### Top bar

Persistent across all pages:
- GrantIQ logo + "COMMAND CENTER" subtitle
- Page title
- Theme toggle (light / dark)
- Data status pill (live / loading / mock / error) — shows whether the portal is reading from Supabase or mock data
- Agent pulse indicator (idle / N agent tasks live)

---

## 5. PER-VIEW FEATURE INVENTORY

### 5.1 OPERATE views

#### Inbox
**Purpose:** Default landing page. Shows what needs the operator's attention right now, ordered by priority.

**Stacks (top to bottom):**
1. **Gated Playwright sessions** — agent paused on a form, needs human approval to continue
2. **Drafts ready for review** — agent finished drafting, operator hasn't reviewed
3. **Today's high-match grants** — newly-discovered grants with match score ≥85%
4. **Urgent deadlines** — anything due within 7 days

**Each row** shows: org swatch, grant/draft name, source, recommended next action ("Approve & Resume," "Review," "Open").

**Status:** Reads live from Supabase via `window.MOCK.SESSIONS / DRAFTS / GRANTS`.

#### Pipeline
**Purpose:** Master list of every active grant. The operator's primary surface for triage and bulk decisions.

**Filters available:**
- Status chips: Active / New / Drafting / Submitted / Rejected / All
- Sort: Match score / Deadline
- Min match slider (0-100)
- Free-text search by grant name or funder

**Columns:** Match (with progress bar), Grant name + funder + source, Org, Amount, Deadline, Docs ready (X/Y), Status pill, Open (toggles inline expand).

**Inline-expanded row** shows: Description, Eligibility, Certification advantage, Source URL, and three buttons: **Draft application** (one-click — runs Grants agent's draftNarrative tool, persists to application_drafts, navigates to Drafts), **Mark reviewing**, **Skip**.

**CTA at top-right:** **+ Add grant** — opens modal to manually inject a grant the user found in the wild (LinkedIn, conference, email tip). Optional URL triggers async research workflow.

**Status:** Functional. Draft application works. Manual grant injection works.

#### Drafts
**Purpose:** Every saved application narrative + budget pair. Operator/grant-writer reviews here before submission.

**Each draft card** shows: grant name, org, status (drafting / ready_for_review / submitted), narrative section count, budget total, last edited.

**Status:** Mostly read-only viewer today. Editing inside GrantIQ is **NOT yet built** — drafts are read-only; user has to copy/paste to edit elsewhere then re-save manually. **[GAP — see section 11]**

#### Sessions
**Purpose:** Playwright browser sessions where the agent is filling out a grant application form in a real browser.

**Master/detail layout:** session list on left, detail panel on right with screenshot timeline + gate-reason banner + "Approve & Resume" CTA.

**Gate types** (when the agent pauses for human approval):
- Signature required
- CAPTCHA
- Certification attestation (e.g., "I certify under penalty of perjury…")
- Final submit button

**Status:** Architecturally complete. Heavy usage hasn't happened yet because the operator is still in discovery phase.

#### Calendar
**Purpose:** 90-day deadline timeline + TBD bucket for grants without parsed deadlines.

**KPIs:** Next 7 days, Next 30 days, Next 90 days, Total opportunity ($).

**Timeline:** Each grant shows as a band (recommended 2-week prep window) ending in a dot (the deadline). Color-coded by urgency.

**TBD bucket:** Grants with no parsed deadline list separately. Click any row to see grant detail and add a deadline manually.

**Status:** Functional. Data quality issue: most discovered grants have null deadlines because the agent isn't reliably extracting them. Persona has been updated to require deadline extraction; old grants are still in TBD.

### 5.2 DOCUMENTS views

#### Brief (NEW — Phase 11)
**Purpose:** Per-org structured profile. The "pitch deck of the org" in data form. The Grants agent reads this when reasoning about grant fit.

**Sections** (all optional — render only if present in the brief JSONB):
- Tagline + subtitle + founded year chip
- Key metrics grid (4 cards — e.g., 178 Trained / 180 Members / 11 Staff / 10+ Apps Built)
- Who we are (narrative)
- The problem (single narrative OR 4-card breakdown)
- Our solution (narrative)
- Three pillars (color-coded grid — e.g., LEARN/BUILD/ELEVATE)
- Who we serve (population cards with sub-headlines + benefit lists)
- Students have built / outputs (tag cloud)
- Why this organization (6 reasons)
- Funding alignment (3 grant-category cards with bullet points)
- Use of funds (5-row breakdown with percentages)
- Roadmap (Phase 1 complete / Phase 2 in progress / Phase 3 with funding)
- Grant funding request (narrative)
- Closing pitch (banner)

**Edit mode:** Every field becomes a textarea. Persists via `PUT /api/orgs/brief`.

**Status:** Built and shipped. AI Junkies' brief is fully populated from a real pitch deck. Other orgs have basic briefs only.

#### Knowledge (NEW — Phase 11)
**Purpose:** Per-org reference material the Grants agent reads when reasoning. Three entry types:
- **Note** — markdown body
- **Link** — URL with optional notes
- **File** — PDF/image upload (private Supabase Storage with signed URL)

**File types accepted:** PDF, PNG, JPEG, WebP, GIF, Markdown, plain text. 25MB limit per file.

**Status:** Built and shipped. Agents read from `org_kb` via `agent_context_v` view.

#### Vault
**Purpose:** Per-org document tracker. Shows every required document, its status (uploaded / drafted / missing), and any expiry dates.

**Filters:** All / federal / state / mission-specific.

**Per-document row** shows: status badge, doc name, description, uploaded date OR draft status OR "missing" CTA.

**Actions per row:**
- For uploaded docs: View / Replace
- For draftable missing docs: **Draft with AI** button (uses on-disk template if exists, else falls back to DB-stored `org_templates`)
- For request docs: **Get email template** (shows email to send to the issuing party)
- For gather docs: shows hint of where to find it

**Bulk action:** **Download readiness pack** — generates a ZIP of every available document for the active org.

**Status:** Functional. Heavy usage is on K1 (most certifications) and Holigenix.

#### Templates
**Purpose:** Reusable narrative blocks across orgs. Generic blurbs that get pulled into drafts (mission statements, program descriptions, impact metrics).

**Status:** Read-only display today. Editing not yet built. **[GAP]**

### 5.3 DISCOVERY views

#### Sources
**Purpose:** Status of every grant feed the agent monitors.

**Each source shows:** name, type (Federal portal / Agency / Foundation / etc.), coverage description, last scrape time, items in last 24h, items kept, health (ok / warn / stale), cron schedule, which orgs it's relevant for.

**Status:** Functional but mostly mock data — only a few sources are actually scraped today. Most discovery happens via Claude's `web_search` tool dynamically.

#### Watchlists
**Purpose:** Saved searches that fire alerts when new matches appear. E.g., "Alert me on any new grant in Texas Medicaid HCBS."

**Status:** Mock data only. No real watchlist execution yet. **[GAP]**

#### Dismissed
**Purpose:** Rejected grants log with reasons, so agents don't keep re-surfacing the same disqualified opportunity.

**Status:** Functional read display. Dismissal action via UI not fully wired.

### 5.4 RELATIONSHIPS views

#### Funders
**Purpose:** Per-funder relationship tracking. Shows past interactions, win rate, contact person, total awarded.

**Status:** Mock data only. **[GAP — high-priority for grant writer use case]**

#### Submissions
**Purpose:** Historical submission log with outcomes (awarded / declined / pending) + dollar amounts.

**Status:** Mock data only. **[GAP]**

### 5.5 INTELLIGENCE views

#### Chat
**Purpose:** Persistent chat with the Grants agent. The operator's primary way to ask the agent open-ended questions.

**Features:**
- Conversation list on left rail (active + earlier)
- Stream pane with collapsible tool blocks (so you can see what the agent did)
- Iteration indicator (how many tool turns the agent took)
- ⌘↵ to send
- Markdown rendering in agent replies (NEW — was broken until 2026-05-06)

**Memory model (4 layers):**
1. **Persona** (static `workspace/grants.md`) — the agent's role, rules, communication style
2. **Project facts** (live Supabase view `agent_context_v`) — orgs, document vault, top grants, KB, deadlines — refreshed every turn
3. **Agent notes** (Layer 3 — `agent_notes` table) — observations the agent records about the user, voice preferences, prior wins
4. **Conversation history** — all prior turns persisted in `grants_conversations` + `grants_messages`

**Status:** Working. Markdown rendering fixed today.

#### Notes
**Purpose:** Display layer-3 agent notes (the agent's persistent memory). Filterable by agent + tag.

**Status:** Read-only display. Functional.

### 5.6 SYSTEM view

#### Settings
**Purpose:** Integrations status, cron schedule, telemetry.

**Status:** Read-only.

---

## 6. AGENT CAPABILITIES

GrantIQ runs **2 AI agents** — that's it. Both use Claude Sonnet 4.6 via direct Anthropic SDK.

### 6.1 Grants Agent

**Persona file:** `workspace/grants.md`

**Tools available** (each is a real Vercel function under `src/tools/grants/`):

| Tool | Purpose |
|---|---|
| `web_search` | Perplexity-style web search for grants matching org profile |
| `fetch_webpage` | Fetch and parse a specific URL (grant detail pages) |
| `query_pipeline` | Read current grants from `grant_opportunities` |
| `get_grant` | Read one grant's full details |
| `get_org` | Read one org's profile (name, certs, EIN, brief, KB) |
| `get_document_vault` | What docs the org has uploaded / missing / drafted |
| `read_document` | Read a single document's content |
| `score_grant` | Compute a 0-100 match score against org profile |
| `save_grant` | Insert/update a grant in `grant_opportunities` |
| `check_documents` | Compute readiness % for a specific grant |
| `list_deadlines` | Pull upcoming deadlines from `grant_opportunities` |
| `draft_narrative` | Generate 6 application sections (executive summary, capacity, needs, approach, outcomes, sustainability) |
| `generate_budget` | Auto-generate line-item budget from org billing rates |
| `save_draft` | Persist narrative + budget to `application_drafts` |
| `get_draft` | Read a saved draft |
| `search_past_drafts` | Search prior drafts for similar funder/topic to reuse voice |
| `generate_document` | Render a starter document (capability statement, board list, W-9, letters of support) |
| `delegate_to_playwright` | Hand off form-filling to the Playwright agent with a task spec |

**Geographic guardrails** (in persona):
- Holigenix: Georgia-only. NEVER suggest Delaware/PA/NJ grants.
- K1 Management: PA / NJ / DE only. NEVER suggest Georgia/national-only grants that require state residency elsewhere.
- AI Junkies: Georgia-based, but online model serves nationally. Acceptable for federal + GA + multi-state online programs.

**Other persona rules:**
- Never include patient names or PHI for Holigenix.
- Lead with **508(c)(1)(a)** for Holigenix foundation grants.
- Lead with **SDVOSB** for Holigenix federal grants.
- Lead with **COSTARS** (March 2026) for K1 PA grants.
- Lead with **Delaware OSD/SBF** for K1 DE grants.
- Lead with **MWBE-NJ** for K1 NJ grants.
- **Deadline extraction is mandatory** before saving a grant. `null` only if rolling.

### 6.2 Playwright Agent

**Persona file:** `workspace/playwright.md`

**Purpose:** Drives a real browser to fill out grant application forms. Pauses (gates) on actions that require human judgment.

**Hard gates** (agent ALWAYS pauses for human approval before):
- Signing anything (initials, signatures, certification statements)
- Solving CAPTCHAs
- Clicking final submit
- Anything labeled "I certify…" / "I attest…"

**Where it runs:** Vercel Sandbox (Firecracker microVM) in production. Local Chromium in dev.

**Output:** Screenshot timeline + structured action log per session, persisted to `playwright_sessions`.

**Status:** Architecturally complete; production usage is light because the operator is still upstream in discovery/drafting.

### 6.3 What the agents DO NOT do today

- ❌ Generate visual assets (no images, no PDFs of finished applications)
- ❌ Submit grants without a human review (always gated)
- ❌ Negotiate with funders directly
- ❌ Track money received (no payment integration)
- ❌ Multi-tenant scoping (one operator's data is visible to anyone with the password)
- ❌ Read attachments uploaded to KB beyond filename + size (PDFs are not parsed for text yet) **[GAP]**
- ❌ Call funders on the phone

---

## 7. DATA MODEL

### Core tables (Supabase Postgres)

```sql
-- Each business onboarded into GrantIQ
orgs (
  id text primary key,           -- 'holigenix_healthcare', 'k1_management', etc.
  name text not null,
  data jsonb not null,           -- flexible profile: certs, EIN, UEI, mission,
                                 --                   address, contact, brief
  created_at, updated_at timestamptz
)

-- Every grant the system knows about
grant_opportunities (
  id uuid primary key,
  org_id text references orgs(id),
  name, funder, amount text,
  deadline date,
  status text,                   -- new / reviewing / drafting / submitted / awarded / declined / expired / rejected / skipped
  match_score int,               -- 0-100
  description, eligibility text,
  source text,                   -- 'agent' / 'manual' / 'manual_curation_<batch>'
  research_status text,          -- pending / running / complete / failed (for manually-added grants with URLs)
  research_report jsonb,
  submitted_url text,
  created_at, updated_at timestamptz
)

-- Documents per org (uploaded, missing, drafted)
document_vault (
  id uuid primary key,
  org_id text references orgs(id),
  doc_type text,                 -- canonical key: 'capability_statement', 'w9', 'board_list', etc.
  doc_name text,                 -- human-friendly title
  description text,
  status text,                   -- uploaded / drafted / missing
  template_kind text,            -- draftable / request / gather / external_auth
  file_url text,                 -- if uploaded
  draft_content text,            -- if drafted by agent
  drafted_at, uploaded_at, expiry_date timestamptz
)

-- DB-stored templates (for orgs onboarded via UI — Vercel filesystem is RO)
org_templates (
  org_id text references orgs(id),
  doc_type text,
  title text,
  body text not null,            -- Markdown with {{TOKEN}} placeholders
  primary key (org_id, doc_type)
)

-- Per-org knowledge base entries
org_kb (
  id uuid primary key,
  org_id text references orgs(id),
  kind text,                     -- note / link / file_summary
  title, body, url text,
  tags text[],
  file_id uuid,                  -- if linked to org_kb_files row
  created_at timestamptz
)

org_kb_files (
  id uuid primary key,
  org_id text references orgs(id),
  filename, mime_type, storage_path text,
  size_bytes bigint,
  uploaded_at timestamptz
)

-- Saved application drafts
application_drafts (
  id uuid primary key,
  grant_id uuid references grant_opportunities(id),
  org_id text references orgs(id),
  narrative jsonb,               -- { sections: { executive_summary: "...", ... } }
  budget jsonb,
  status text,                   -- draft / ready / submitted
  created_at, updated_at timestamptz
)

-- Agent persistent state
grants_conversations, grants_messages       -- chat history
playwright_sessions                          -- browser sessions
agent_notes                                  -- Layer 3 learned facts
agent_tasks                                  -- queue for cross-agent dispatch
alerts                                       -- agent-emitted notifications
```

### Composite view (read by every agent on every turn)

```sql
agent_context_v
  - org_id, org_name, org_profile (full)
  - documents (total / uploaded / missing_list)
  - top_grants (top 5 by match_score)
  - upcoming_deadlines (next 30 days)
  - knowledge_base (all org_kb entries)
```

This view is what makes the agents' system prompts grounded in the latest org state.

---

## 8. KEY WORKFLOWS

### 8.1 Onboarding a new business
1. Operator clicks **+ Add business** in sidebar
2. Modal collects: name, short name, org type, state, mission, EIN, UEI, address, contact email, operations lead, certs (comma-separated)
3. POST to `/api/orgs/create`:
   - Slugifies name → org_id
   - Inserts row into `orgs` with the data as JSONB
   - Scaffolds 4 generic templates into `org_templates`: capability_statement, org_chart, board_list, w9
4. Frontend refreshes live data → new org appears in sidebar with auto-generated color swatch
5. Operator clicks the new org → can immediately use Draft with AI for the 4 scaffolded docs (with `[BRACKETED PLACEHOLDERS]` to fill in)

### 8.2 Discovering grants (cron-driven)
1. Cron fires daily at 12:00 UTC: `/api/cron/daily-discovery`
2. Iterates over all 4 orgs
3. For each org, runs Grants agent with prompt: "Find new grants matching {org}'s profile. Use web_search + fetch_webpage. Score, save promising ones."
4. Agent saves new grants to `grant_opportunities` with `status='new'`, `match_score` populated, deadline extracted
5. Agent emits an alert if any high-match (≥85%) grant is found
6. Operator sees new grants in Inbox + Pipeline next time they open the portal

### 8.3 Manually adding a grant (operator-initiated)
1. Operator finds a grant on LinkedIn / conference / email
2. Opens **Pipeline** → clicks **+ Add grant**
3. Fills in: org, name, funder, amount, deadline, URL, notes
4. POST to `/api/grants/add` — inserts row with `source='manual'`, `research_status='pending'`
5. If URL provided, fires `researchGrant({grant_id})` async (fire-and-forget on Vercel)
6. Researcher runs Grants agent with focused prompt: "Research this URL → eligibility match / required docs / risks / match score / recommendation"
7. Agent writes structured Markdown report back to `grant_opportunities.research_report`
8. Status transitions: pending → running → complete (~20-60s)
9. Frontend's 30-second data refresh pulls in the updated row

### 8.4 Drafting an application
1. Operator opens **Pipeline**, expands a grant row, clicks **Draft application**
2. POST to `/api/grants/draft` runs:
   - `draftNarrative({grant_id, org_id})` — Claude Sonnet drafts 6 sections at 200-500 words each
   - `saveDraft(...)` — persists to `application_drafts`
   - Bumps grant to `status='drafting'`
3. Frontend navigates to **Drafts** tab with the new draft focused
4. Operator (or grant writer) reviews, edits if needed
5. When ready, status changes to `ready_for_review` → `submitted`

### 8.5 Filling out a real form (Playwright)
1. Operator (in Chat) asks: "Apply for grant X for K1"
2. Grants agent uses `delegate_to_playwright` tool — creates an `agent_tasks` row with `to_agent='playwright'` and full task spec (URL, narrative content, doc paths)
3. Cron `/api/cron/process-tasks` fires every minute, claims one queued playwright task
4. Playwright agent spins up a sandboxed browser, navigates to the form, fills sections from the saved draft + vault docs
5. On hitting a hard gate (signature, CAPTCHA, attestation, submit), agent pauses — emits alert to operator
6. Operator opens **Sessions** → reviews screenshot + gate reason → clicks **Approve & Resume** OR makes manual edit + resumes
7. Agent continues until next gate or completion
8. On submission, agent records confirmation # in `application_drafts.status='submitted'` and writes a Note to `agent_notes`

### 8.6 Generating a missing document
1. Operator opens **Vault** for an org
2. Sees a missing document with **Draft with AI** button (e.g., "Capability Statement — DRAFTABLE")
3. Click → POST `/api/orgs/draft-doc` → calls `generateDocument({org_id, doc_type})`
4. Tool resolves canonical doc_type → reads template (filesystem first, falls back to `org_templates` table)
5. Renders `{{TOKENS}}` (ORG_NAME, EIN, UEI, ADDRESS, etc.) using the org's data
6. Persists to `document_vault` with `status='drafted'`, `template_kind='draftable'`
7. Modal opens with the rendered Markdown — user fills in `[BRACKETED PLACEHOLDERS]`, downloads as .md, converts to PDF

---

## 9. PHASE HISTORY (what's been built)

### Phase 0-9: Original build (Q1 2026)
- Migration from Railway / OpenClaw / Telegram bot architecture to Vercel / Anthropic SDK / web portal
- 10 phases of agent + tool migration
- Document Vault, BudgetGen, SF-424 form-filling
- Production cutover on 2026-05-04

### Phase 10: Polish (2026-05-05)
- Fixed Holigenix Georgia-only enforcement
- Added Playwright agent
- Live data wiring (Supabase REST + APIs)
- Auth gate (HTTP Basic Auth via Routing Middleware)
- Pipeline data-status indicator
- K1 Management 8 templates added

### Phase 11: Self-service operations (2026-05-06)
- "+ Add business" sidebar entry → onboarding modal → API + DB scaffold
- 4-template scaffold for new orgs (capability_statement, org_chart, board_list, w9)
- DB-fallback for templates (orgs onboarded via UI work without filesystem writes)
- **Brief tab** — per-org structured profile with 11 section types (metrics, pillars, populations, why us, funding alignment, use of funds, roadmap, etc.)
- **Knowledge tab** — per-org KB with PDF/image uploads via Supabase Storage, signed-URL downloads
- **Manual grant injection** — Pipeline + Add grant modal → API → fire-and-forget research workflow → structured eligibility report
- AI Junkies University onboarded as 4th business with full pitch-deck content seeded into brief

### Phase 12 (2026-05-06 — same day fixes)
- Markdown rendering in chat (was broken — agent replies showed raw `**bold**` and `|tables|`)
- Open button on Pipeline rows now toggles expansion (was wrongly navigating to Drafts)
- Calendar uses real "today" instead of hardcoded 2026-05-04
- Calendar adds "Deadline TBD" bucket so null-deadline grants don't disappear
- Grants persona updated: deadline extraction now mandatory before save_grant

---

## 10. **[YOUR INPUT]** — GRANT WRITER FEEDBACK SECTIONS

This is where you, the grant writer, do most of your work. Fill in each block. The more specific, the better. If a question doesn't apply, say so — don't skip silently.

### 10.1 What's your daily grant-writing workflow today (without GrantIQ)?

[YOUR INPUT — describe the typical day: tools used, hours spent, where time is wasted]

### 10.2 Looking at section 5 (per-view feature inventory), which views would you actually USE daily?

[YOUR INPUT — list views you'd live in vs. views that are noise to you]

### 10.3 Which views are MISSING that you need?

For example:
- A "Funder research" page where I dump foundation 990s and have the agent extract giving patterns?
- A "Voice library" where I save my best-performing narrative paragraphs?
- A "Question bank" that maps every common application question to a stock answer + tone variations?

[YOUR INPUT — list missing views with one-paragraph rationale each]

### 10.4 Which existing features are CLUNKY, broken, or wrong?

For each, describe (a) what's wrong, (b) what you'd expect instead.

[YOUR INPUT — be specific. "The Vault is hard to use because…" not "the design is bad"]

### 10.5 What about the AI agent itself? When does it produce GOOD output? When does it FAIL?

This is the most important section for the operator.

[YOUR INPUT — examples of good agent output, examples of bad output, what tells you the agent doesn't understand grants vs. when it does]

### 10.6 What document types should we be drafting that we're not?

Today the agent can draft: capability statement, org chart, board list, W-9, letters of support (3 variants), and CVs. We don't draft:
- Logic models
- Theories of change
- Project narratives in funder-specific formats (NIH, NSF, foundation-specific RFPs)
- Budget justifications
- Sustainability plans
- Memorandums of understanding
- IRB-style protocols
- Evaluation plans

[YOUR INPUT — which of the above would 10× our effectiveness? Other doc types we're missing?]

### 10.7 Funders & relationships — currently mock data. What should we track per funder?

Brainstorm fields:
- Name, type (private foundation / government / corporate / community)
- Total deployed (last 5 years)
- Median grant size
- Their published priorities
- Past contacts at the org
- Application submission portal preferences
- Reporting cadence after award
- Decision timeline (how long from submit → decision)
- Win rate for OUR org (if applied multiple times)

[YOUR INPUT — what else? Which fields would you actually use?]

### 10.8 What KILLS time for grant writers that AI should fix?

Examples (you tell us if these are right):
- Reformatting one narrative for 8 different funder character limits
- Extracting required documents from PDF RFPs
- Comparing two grants' alignment scores
- Drafting cover letters with funder-specific personalization
- Writing letters of inquiry (LOIs) at scale
- Tracking which version of which doc went to which funder

[YOUR INPUT]

### 10.9 Visual / UX changes you'd recommend

Without rebuilding from scratch, what specific UI changes would help? E.g.:
- "Make the right rail collapse more cleanly"
- "Add inline draft editing (no separate page)"
- "Show the agent's reasoning steps for every action so I trust it"
- "Per-funder color coding"
- "Submit-button status indicators (yellow → green) when an application is ready to send"

[YOUR INPUT]

### 10.10 What features would you ADD if you had unlimited dev time?

Brainstorm — no constraints. The operator will triage.

[YOUR INPUT — list as many as come to mind, with a 1-line rationale each]

### 10.11 Anything else?

Notes, complaints, half-formed ideas, things you've seen on competitor tools (Instrumentl, Submittable, GrantHub, Foundation Directory, Candid, GrantWatch, HelloSkip).

[YOUR INPUT]

---

## 11. KNOWN GAPS / TECH DEBT (operator's view)

For honesty's sake, these are the gaps the operator already knows about:

1. **Funders + Submissions views are mock data only.** No real funder relationship tracking or submission history yet.
2. **Watchlists don't actually fire.** UI exists; no scheduled execution.
3. **Drafts can't be edited inside the portal.** Read-only viewer; user copies to external editor.
4. **Templates view is read-only.** No editing of reusable narrative blocks.
5. **No PDF text extraction.** Uploaded PDFs in Knowledge can be downloaded but the agent doesn't read them. (Need OCR / PDF parsing pipeline.)
6. **Deadline data is mostly null** for the 23 grants currently in pipeline. Persona was updated to enforce extraction; existing grants need backfill.
7. **No per-user auth scoping.** Single shared password = whoever has it sees all 4 orgs. Multi-tenant requires Supabase Auth + RLS.
8. **No payment / award tracking.** Once awarded, dollars are not recorded in GrantIQ.
9. **Sources are mostly mock.** Real grant feeds (Grants.gov, SAM.gov, foundation RSS) not all wired.
10. **Phone/SMS integration is gone.** Original Telegram bot was removed in migration; no new SMS interface yet.
11. **Mobile UI is unverified.** Designed for desktop. Tablet probably works, phone likely cramped.
12. **No collaborative editing.** Two people editing the same draft would collide silently.

---

## 12. PROMPT FOR CLAUDE CHAT (PASTE THIS FIRST, THEN ATTACH THIS PRD)

Copy everything between the lines below into a fresh Claude Chat conversation, then paste this entire PRD document right after.

```
You are reviewing a Product Requirements Document for "GrantIQ" — an AI-powered grant operations platform built by Rodney Williams. He runs 4 small businesses and uses GrantIQ to discover, draft, and submit grant applications. He has hired me (his grant writer) to redesign and improve the platform.

I am sending you the full PRD next. Please read it in full before responding.

When you respond, I want you to do FIVE things in order:

1. **Sanity check.** In one paragraph, summarize back to me what GrantIQ is, who uses it, and what its biggest strength is. If anything in the PRD is unclear or contradicts itself, flag it.

2. **Gap analysis.** List the top 10 features or workflows MISSING from this platform that a professional grant writer would expect. Rank them by impact to a grant writer's daily work (highest first). For each, give a one-sentence rationale.

3. **What's broken or smells wrong.** Looking at the per-view feature inventory (section 5) and known gaps (section 11), pick the 3 most damaging issues — the ones that would make me as a grant writer NOT trust this tool. Explain each in one paragraph.

4. **What I should ADD.** Propose 5 net-new features that aren't in the PRD anywhere. Be ambitious. For each: one-sentence description + why it matters for grant writing specifically (not generic SaaS features).

5. **Redesign principles.** Suggest 3 design principles for the next phase of redesign. Examples: "every view must answer ONE question in 5 seconds," or "the agent's reasoning must always be auditable." Make them strong opinions.

After you respond, I will give you the operator's answers to section 10 of the PRD ([YOUR INPUT] blocks), and we'll iterate from there.

Length target: aim for thoroughness over brevity. This is a working document.
```

---

## 13. APPENDIX

### 13.1 Code repository
GitHub: `https://github.com/SR2022RS/grantiq` (private)
Production: `https://grantiq-ivory.vercel.app` (password-gated)

### 13.2 Tech stack one-liner
React 18 SPA (Babel-standalone, no build) + Vercel Functions (Node 24 / Fluid Compute) + Supabase Postgres 17 + Anthropic SDK direct (Claude Sonnet 4.6) + 2 hand-rolled agents.

### 13.3 Document conventions
- Tokens like `{{ORG_NAME}}` get auto-substituted from the org's profile.
- Brackets like `[ADDRESS]` are user-fillable placeholders that stay visible until the user replaces them.
- Filesystem templates live at `workspace/templates/<org_id>/<doc_type>.md`.
- DB-stored templates live in `org_templates` (org_id, doc_type) → body.

### 13.4 Glossary

| Term | Meaning |
|---|---|
| Org / business | A single legal entity (e.g., Holigenix Healthcare LLC) |
| Vault | Per-org document tracker |
| KB | Knowledge base — reference material the agent reads |
| Brief | Per-org structured profile (the "pitch deck data") |
| Draft | A saved application narrative + budget pair |
| Session | A live Playwright browser window driven by the agent |
| Gate | A point where the Playwright agent pauses for human approval |
| Match score | 0-100 relevance of a grant to an org's profile |
| Layer 3 note | A persistent fact the agent learns about the user/work |
| Tool turn | One iteration of the agent's tool-use loop |

---

*End of PRD. Edit freely. Send back marked up.*
