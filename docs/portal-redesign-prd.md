# GrantIQ Command Center — Portal Redesign PRD

**Audience:** Claude design / UX designer
**Date:** 2026-05-04
**Owner:** Rodney Williams
**Current portal:** https://grantiq-ivory.vercel.app
**Stack:** Static HTML + JS on Vercel, Supabase data layer, no framework (intentional — keeps deployment trivial). Design is free to introduce one if it improves the experience, but vanilla HTML/JS works fine.

---

## 1. Context

GrantIQ is a single-user grant operations system. Rodney runs three organizations (Holigenix Healthcare, K1 Management, Owner Nonprofit) and uses GrantIQ to find grants they qualify for, draft applications, and submit them.

The system uses two AI agents:
- **Grants Agent** — research, scoring, narrative drafting, budget generation. User-facing via chat.
- **Playwright Agent** — fills out web forms (grant applications, vendor onboarding, certification renewals). Long-running browser sessions with human-approval gates.

The **Command Center** (this portal) is where Rodney sees everything the agents are doing and operates the system. It is the *only* user surface — Telegram bot is being retired.

**The current portal** (`/dashboard.html`, plus separate `/k1-upload.html` and `/holigenix-upload.html`) was built incrementally over a single-developer sprint. It works but feels like three separate apps glued together. Rodney's exact words: *"I need to be able to see and operate everything a lot better."*

---

## 2. The user we're designing for

One person — Rodney. He's the owner of all three organizations, the operator of GrantIQ, and the only user. He's busy, mobile-friendly, and decision-driven. He wants to walk up to the portal, see what needs his attention in 5 seconds, and act on it in 2 clicks.

**He is NOT a designer or developer.** He needs the system to surface what's important without him having to dig.

**Operational moments he has multiple times per day:**
1. *"What needs my attention?"* — alerts, gated Playwright sessions, drafts ready for review
2. *"What's the agent doing right now?"* — live agent activity, in-flight tasks, recent runs
3. *"What grants are in my pipeline?"* — by org, sortable by deadline / match score
4. *"What docs are missing?"* — document vault status per org, with one-click upload
5. *"Talk to the agent"* — chat with the Grants agent
6. *"Resume a Playwright session"* — review screenshots, approve gates, sign off submits

---

## 3. What the data layer gives us

The portal reads from these Supabase tables (all live, no mirror lag):

| Table | What it holds | Cardinality |
|-------|---------------|-------------|
| `orgs` | 3 organization profiles (Holigenix, K1, Owner Nonprofit) | 3 |
| `grant_opportunities` | Discovered grants with match scores | ~20-100, growing daily |
| `application_drafts` | Generated narratives + budgets | ~10-30 |
| `document_vault` | Per-org doc readiness (uploaded vs missing) | ~50 per org |
| `grants_conversations` + `grants_messages` | Chat history with Grants agent | unlimited |
| `playwright_sessions` | Browser-fill sessions (state, screenshots, gate reasons) | ~10-50 |
| `agent_notes` | What the agents have learned | ~50-500 over time |
| `agent_tasks` | Cross-agent task queue (Grants → Playwright handoffs) | ephemeral |
| `alerts` | User-facing notifications | unlimited, mostly read |
| `agent_activity_log` | Telemetry (latency, tokens, tool calls per turn) | high volume |

The portal also calls these API endpoints:

| Endpoint | Purpose |
|----------|---------|
| `POST /api/grants/chat` | Send a message to the Grants agent |
| `POST /api/playwright/start` | Spawn a Playwright session for a form |
| `POST /api/playwright/resume` | Resume after a human gate |
| `GET /api/playwright/sessions` | List sessions |
| `GET /api/alerts/stream` | Server-sent events for real-time alerts |
| `POST /api/alerts/mark-read` | Acknowledge an alert |

---

## 4. What's wrong with the current portal

**Honest critique of `/dashboard.html` today:**

1. **Three separate pages, no global nav.** `/dashboard`, `/k1-upload`, `/holigenix-upload` are unconnected. To check Holigenix docs, then K1 docs, requires page navigation and losing context.
2. **Org switching is implicit.** The user doesn't always know which org they're looking at. K1 and Holigenix data should be visible side-by-side or in a clear org selector that persists across views.
3. **No "what needs my attention" view.** Alerts, gated sessions, urgent deadlines, and ready-to-review drafts are scattered. The user has to know where to look.
4. **No sense of agent activity.** When the Grants agent is running a daily discovery cron, the user has no live indicator. "Is it working?" is unanswerable.
5. **Document upload is the only thing that works well** — the K1 portal at 81% complete with the "Download All ZIP" button is the gold standard the rest should match. Visual progress bar, clear missing-vs-uploaded states, real download buttons.
6. **No chat surface.** The Grants agent has no UI yet — it's API-only. The new portal needs a first-class chat panel.
7. **No Playwright session viewer.** Same issue — sessions are about to start happening; there's no place to see screenshots and approve gates.

---

## 5. The information architecture we want

Single-page application feel, even if it's multi-page underneath. Persistent global elements:

```
┌─────────────────────────────────────────────────────────┐
│  GrantIQ           [org switcher: Holigenix / K1 / All] │  ← always visible
├─────────────────────────────────────────────────────────┤
│  Sidebar    │   Main work area                          │
│  ─────      │                                           │
│  ⚡ Inbox   │   (whatever section the user picked)      │
│  📊 Pipeline│                                           │
│  ✍️ Drafts  │                                           │
│  🌐 Sessions│                                           │
│  📁 Vault   │                                           │
│  💬 Chat    │                                           │
│  📋 Notes   │                                           │
│  ⚙ Settings│                                           │
└─────────────────────────────────────────────────────────┘

Persistent overlay:
  - Real-time alerts (top-right toast or inline ribbon)
  - Active agent indicator (shows when agent is running a turn or cron)
```

### Section purposes

**⚡ Inbox** — the first screen. A unified "what needs my attention" feed:
- Unread alerts
- Gated Playwright sessions (with thumbnail of last screenshot + reason)
- Drafts ready for review
- High-match grants discovered today
- Urgent deadlines (next 7 days)

This should be the default landing page. Empty state: *"All caught up. Last agent run: 7:00am EST."*

**📊 Pipeline** — grant opportunities table. Filterable by org, status, match score, deadline. Sortable. Each row expandable to show: agency, amount, deadline, description, current status, and a "Start Application" button that delegates to Playwright if the user has approved a draft.

**✍️ Drafts** — application drafts. Each draft shows: grant name, org, sections (narrative + budget), and a "Submit via Playwright" button. The narrative renders as readable Markdown, not raw JSON. Edit-in-place would be nice but not required for v1.

**🌐 Sessions** — Playwright session viewer. List of sessions on the left, detail view on the right with:
- Live status (in_progress, gated, completed, failed)
- Screenshot timeline (the agent takes screenshots as it works — show all of them in chronological order)
- Current step counter
- If gated: prominent "Approve & Resume" button, large screenshot, gate reason
- If completed: confirmation summary, tracking number if captured

**📁 Vault** — document management. Currently the strongest part of the existing portal — keep its DNA but unify across orgs. Org switcher determines which org's docs are shown. Visual readiness bar at top. Missing docs vs uploaded docs visually separated. Each doc shows: name, description, status, expiry date if applicable, View / Download / Replace buttons.

**💬 Chat** — Grants agent chat panel. Looks like Claude or ChatGPT. User types, agent responds. Conversation persists across page loads (localStorage holds the active conversation_id, or the agent's `loadOrCreateConversation` lookup by `user_chat_id='rodney'` finds the most recent thread). Tool-use blocks shown as collapsed expandable cards inline (e.g., "🔍 Searched the web for 'Delaware EDGE grants'" with the actual results expandable below).

**📋 Notes** — Layer 3 agent learnings. What the agents have figured out across all sessions. Read-only for now (the user might want to manually add notes later, but not v1). Filter by tag, by agent, by confidence. This is the "what does my team know" view — a knowledge base that grows over time.

**⚙ Settings** — env config visibility (which integrations are connected), cron schedule view, org profile editing (currently org data lives in the `orgs.data` jsonb blob — settings page exposes it as form fields).

---

## 6. Key views — detailed shot list

For each, design needs to deliver: layout, primary action, empty state, loading state, error state.

### View 1 — Inbox (default landing)

**Visual feel:** scannable, dense, action-oriented. Think Linear or Superhuman. Each row is one item with a clear "what to do."

**Sections (in order of priority):**
1. **Gated Playwright sessions** (red/amber, top of list) — "Playwright paused at signature gate on Delaware EDGE application. [Approve & Resume]"
2. **Unread alerts** — agent-generated, severity-coded
3. **Drafts ready for review** — "Holigenix HRSA Primary Care draft ready (5 min ago). [Review]"
4. **Today's high-match discoveries** — "3 new grants matching K1 (avg 87% match). [View Pipeline]"
5. **Urgent deadlines** — "Delaware EDGE Grant due in 8 days, 90% match, 22/27 docs ready. [Start Application]"

Empty state: *"All caught up. Next discovery cron: 7:00 AM EST tomorrow."*

### View 2 — Pipeline

**Layout:** dense table, ~30 rows visible.

**Columns:** match %, name, agency, amount, deadline, status, org, last action.

**Filters (top bar):** org chips (Holigenix / K1 / Owner Nonprofit / All), status chips (new / reviewing / drafting / submitted / awarded / rejected), deadline picker, min match score slider.

**Row actions:** click to expand inline detail (description + tools to act). Primary actions: Review, Draft Application, Skip, Mark Awarded.

**Empty state:** *"No grants match these filters. Lower the match threshold or expand the date range."*

### View 3 — Sessions (Playwright viewer)

**Layout:** master-detail. Left rail is session list (status icon + URL + age). Right is selected session detail.

**Detail panel:**
- Top: status banner (color-coded), URL, org, started/ended timestamps
- Screenshot timeline: horizontal scroll of thumbnails, click to enlarge
- Current state: which fields filled, total/remaining steps
- If gated: large screenshot, gate reason in plain English, two big buttons — "Approve & Resume" / "Cancel Session"
- Telemetry footer: tokens used, model calls, latency

### View 4 — Chat

**Layout:** conversation list left rail (last 10 conversations), active conversation center.

**Message rendering:**
- User: right-aligned, blue bubble
- Assistant text: left-aligned, neutral bubble, Markdown rendered
- Tool use: inline collapsed card (`🔍 web_search { query: "Delaware grants" }`) — click to expand and see the result
- Final answer: rendered as styled Markdown (tables, links, bullet lists)

**Composer:** textarea at bottom, ⌘+Enter to send, Send button. Disabled state while agent is responding (with animated indicator).

**Status indicators:** show current iteration number ("Iteration 3 of 8") and which tools are firing while the agent is running. This is a live view of the agent's reasoning, not a black box.

### View 5 — Vault (per org)

This view should be the existing K1 upload portal pattern, generalized. Don't redesign it — refine it.

**Top of page:**
- Org name + readiness % (big number, animated progress bar)
- Cert badges (MBE, MWBE, COSTARS, etc.) — visible compliance signal
- "Download All (ZIP)" button if any docs uploaded

**Body:**
- "Required for All Grants" section first (most universal)
- Then "Federal-only" (tax returns, letters of support)
- Then "State-only" (state-specific certs)
- Each doc: name, 1-line description, status icon, expiry date, View / Download / Replace buttons (or Upload if missing)

**Multi-org awareness:** the org switcher at top of the portal applies here. Default to "K1" because that's most active. Holigenix view should look identical, just with that org's docs.

---

## 7. Design principles

1. **Action-first.** Every screen answers "what can I do here?" Don't hide actions in menus.
2. **Live state, not static.** Show when agents are working. Use SSE for alerts. Update timestamps in real-time.
3. **Density over chrome.** Rodney needs to see a lot at once. Think Linear, Superhuman, or Vercel's dashboard — not Stripe's marketing site.
4. **Org-aware throughout.** The org switcher persists. Every screen knows which org is active. Pipeline / Vault / Drafts all filter by it.
5. **Mobile-respectful.** Rodney sometimes checks the portal from his phone. The Inbox view in particular should be readable and actionable on mobile. Other views can degrade gracefully (e.g., Sessions viewer is desktop-primary).
6. **Markdown-rendered AI output.** Anytime an agent produces text, render it as Markdown — tables, links, bullets, code blocks. Don't show raw JSON or strings.
7. **Trust the agent, but verify.** Every tool call should be visible (collapsed by default in chat). Every Playwright action should be screenshotted. Rodney can audit, but doesn't have to.
8. **Single voice.** The brand is GrantIQ. Match the existing dark-theme palette (deep blacks, amber accent #f59e0b, green for success #16a34a, red for errors #dc2626). The current portal already has this; preserve it.

---

## 8. Out of scope for v1

These are explicit non-goals — don't design for them:

- **Multi-tenant / multi-user.** One user (Rodney). No login flow. The existing Supabase anon key in client JS is intentional — there's no user data to protect at this layer.
- **Mobile-first.** Desktop is primary. Mobile-respectful for Inbox + Vault, but Sessions viewer and Chat are desktop-optimized.
- **Theme toggle.** Dark theme only. Matches the brand and Rodney's preference.
- **Editable Layer 3 notes from UI.** Read-only viewer for v1. Agents write; user reads.
- **Editable org profiles from UI.** Settings v1 is read-only display of `orgs.data`. Editing comes later.
- **Custom agent personas from UI.** Persona files are committed to the repo (`workspace/grants.md`, `workspace/playwright.md`). Not user-editable.

---

## 9. Acceptance criteria

The redesigned portal is successful when:

1. Rodney opens the portal and within 5 seconds knows what needs his attention.
2. Switching between Holigenix and K1 contexts is one click and applies everywhere.
3. Approving a Playwright gate takes ≤2 clicks from the Inbox view.
4. Chatting with the Grants agent feels as good as Claude.ai (Markdown rendering, tool-use visibility, persistent history).
5. Document Vault parity with the current K1 upload portal — but unified across orgs, with the org switcher.
6. Mobile-readable Inbox: Rodney can triage from his phone in line at coffee.
7. Real-time alert delivery — when an agent calls `alert_user`, it appears in the portal within 10 seconds without a page refresh.

---

## 10. References for visual direction

Sites that capture the operational density + clarity Rodney wants:

- **Linear** (linear.app) — issue tracking, dense lists, mature dark theme
- **Superhuman** (superhuman.com) — keyboard-driven, every action 1-2 keys away
- **Vercel dashboard** (vercel.com/dashboard) — deployment status, log streams, calm dark UI
- **Anthropic console** (console.anthropic.com) — chat UI with structured tool-use display

Sites to AVOID as references:

- Marketing-style SaaS dashboards (Notion, Stripe homepage, etc.) — too much whitespace, not dense enough
- Light-theme productivity apps (Linear had a phase, but the dark version is what we want)
- Anything with a left rail >80% of the screen height — Rodney needs the work area dominant

---

## 11. Hand-off

The current portal lives at:
- Repo: https://github.com/SR2022RS/grantiq
- Live URL: https://grantiq-ivory.vercel.app
- HTML files: `public/index.html`, `public/k1-upload.html`, `public/holigenix-upload.html`

The redesigned portal will replace those three files (plus add `chat.html` and `sessions.html`, which are scoped in the migration plan but can be folded into the redesign).

Vercel auto-deploys from the GitHub `main` branch. Working branch for the SDK migration is `migration/claude-sdk-vercel` — when this redesign is ready, it goes through PR review and merges to main.

Designer can deliver as: HTML/CSS/JS files directly committed to the repo (preferred), or Figma mocks if needed for review first. Rodney will pick whichever path moves faster.
