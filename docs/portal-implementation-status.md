# GrantIQ Command Center — Implementation Status

**Date:** 2026-05-04
**Source:** Claude Design handoff bundle (`api.anthropic.com/v1/design/h/-Asjl12U265cnIjC7WnG1Q`)
**Branch:** `migration/claude-sdk-vercel`

---

## What just happened

The full Claude Design bundle was lifted into `public/` verbatim. The portal is now a **single-page React app** rendered in the browser via Babel-standalone (no build step — fits Vercel static hosting perfectly).

### Files added

| Path | Role |
|------|------|
| `public/index.html` | App shell — loads React 18, Babel, all `.jsx` modules |
| `public/styles.css` | Full design system — dark/light theme, dense layout, accent hue |
| `public/app.jsx` | Root component — sidebar, top bar, page router, theme/density tweaks |
| `public/data.jsx` | **Mock data shaped like Supabase tables** (orgs, grants, drafts, sessions, vault, etc.) |
| `public/helpers.jsx` | Icons, time formatters, org name lookups, tiny markdown |
| `public/tweaks-panel.jsx` | Top-right gear menu — theme, density, accent hue, right-rail toggle |
| `public/views-1.jsx` `views-2.jsx` `views-3.jsx` | Inbox · Pipeline · Drafts · Sessions · Vault · Chat · Notes views |
| `public/views-grant-detail.jsx` | Per-grant detail page — requirements checklist + audit trail |
| `public/views-discovery.jsx` | Sources · Watchlists · Dismissed |
| `public/views-relationships.jsx` | Funders · Submissions |

### Files preserved

- `public/k1-upload.html` — existing K1 doc upload portal (kept; tightly scoped flow)
- `public/holigenix-upload.html` — existing Holigenix doc upload portal (kept)
- `public/index-legacy.html` — old dashboard, archived for reference

---

## What works right now

Visit any of these locally (`bash scripts/dev.sh`) or in production after deploy:

| URL | What you'll see |
|-----|-----------------|
| `/` or `/index.html` | New Command Center SPA — full design |
| `/k1` or `/k1-upload` | K1 Management doc upload portal (unchanged) |
| `/holigenix` or `/holigenix-upload` | Holigenix doc upload portal (unchanged) |
| `/index-legacy.html` | Old dashboard, kept for reference |

In the new SPA, all 16 views render with mock data:
- Operate: **Inbox · Pipeline · Drafts · Sessions · Calendar**
- Documents: **Vault · Templates**
- Discovery: **Sources · Watchlists · Dismissed**
- Relationships: **Funders · Submissions**
- Per-grant detail: click any pipeline row → **Requirements + Audit trail**
- Intelligence: **Chat · Notes**
- System: **Settings**

The sidebar org switcher (Holigenix / K1 / Owner NP / All) filters every view. Theme toggle, density, accent hue all work. Layout is responsive down to ~920px.

---

## What's still mocked (next steps)

The design ships with hand-curated mock data in `public/data.jsx`. Wiring it to live Supabase is a separate task that mirrors the API endpoints already built in Phases 5–6.

### Wiring map (when ready)

| Mock array (`window.MOCK.*`) | Real source |
|------------------------------|-------------|
| `ORGS` | `GET` Supabase `orgs` table |
| `GRANTS` | `GET` Supabase `grant_opportunities` |
| `DRAFTS` | `GET` Supabase `application_drafts` |
| `SESSIONS` | `GET /api/playwright/sessions` |
| `VAULT` | `GET` Supabase `document_vault` |
| `ALERTS` | `GET /api/alerts/list` + SSE `/api/alerts/stream` |
| `AGENT_ACTIVITY` | `GET` Supabase `agent_activity_log` |
| `NOTES` | `GET` Supabase `agent_notes` |
| `FUNDERS` `WATCHLISTS` `DISMISSED` `TEMPLATES` `SUBMISSIONS` `SOURCES` | New tables — design surfaces them, but our schema doesn't have them yet. Defer to Phase 8+ if you want those features wired. |

Suggested replacement strategy in `data.jsx`:

```javascript
// Replace each mock with an async loader that hits the API.
// Use SWR-style caching since the page is React-based.

async function sbGet(table, query = '') {
  const r = await fetch(`/api/supabase/${table}${query}`);
  return r.ok ? r.json() : [];
}

window.MOCK = {
  ORGS:    await sbGet('orgs'),
  GRANTS:  await sbGet('grant_opportunities', '?order=match_score.desc.nullslast'),
  // ...
};
```

Or — preferred — replace each `window.MOCK.X` reference in views with React `useEffect` + `useState`, and eliminate the global mock layer entirely. That's a bigger refactor; the API-shim pattern above gets you parity faster.

### Chat wiring

The `Chat` view in `views-3.jsx` currently fakes the `/api/grants/chat` call. Replace the mock with:

```javascript
const r = await fetch('/api/grants/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ message, conversation_id, user_chat_id: 'rodney' }),
});
const { text, conversation_id: nextId, telemetry } = await r.json();
```

The endpoint is already deployed (Phase 5). Just point at it.

### Sessions wiring

Same pattern for `Sessions` view — `GET /api/playwright/sessions` returns the live list. The "Approve & Resume" CTA already has a corresponding endpoint at `POST /api/playwright/resume`.

---

## Production deployment notes

1. **Babel-standalone is dev-only-recommended.** Anthropic's design system uses it because it's the simplest way to ship a no-build-step React app. For production, consider one of:
   - **Keep it.** Babel-standalone + React 18 is ~600KB but gzips to ~150KB. Fine for a single-user tool.
   - **Pre-build.** Add a Vite step that compiles `.jsx` → `.js` and inlines into `index.html`. ~30 min of work; bundle size drops to ~40KB.

   For R1, **keep Babel-standalone.** Optimize later if perf actually matters.

2. **Vercel rewrites in `vercel.json` still work.** `/k1`, `/k1-upload`, `/holigenix`, `/holigenix-upload` continue to route correctly. The new SPA owns `/`.

3. **`outputDirectory: "public"` in `vercel.json` means everything in `public/` ships to the CDN.** No build step needed.

---

## Verification

Already smoke-tested locally:

```
/                       → 200 (new SPA)
/index.html             → 200 (new SPA)
/index-legacy.html      → 200 (old dashboard, archived)
/styles.css             → 200
/app.jsx                → 200 (Babel transpiles in browser)
/k1-upload.html         → 200 (preserved)
/holigenix-upload.html  → 200 (preserved)
/k1                     → 200 (rewrite to k1-upload.html)
/holigenix              → 200 (rewrite to holigenix-upload.html)
```

Title confirmed: `<title>GrantIQ — Command Center</title>`.

---

## What this leaves on the migration plan

Phase 7 in `docs/superpowers/plans/2026-05-04-grantiq-claude-sdk-migration.md` originally specified:
- Task 7.1: Chat panel HTML
- Task 7.2: Sessions viewer HTML
- Task 7.3: Alerts SSE + UI widget

**The design bundle covers all three** (Chat view + Sessions view + alerts in the right rail). Phase 7 collapses to a single follow-up task: **wire `data.jsx` mocks to the real API endpoints from Phases 5–6**, plus add the SSE alerts feed.

Phase 8 (cron endpoints) and Phase 9 (cutover) are unchanged.
