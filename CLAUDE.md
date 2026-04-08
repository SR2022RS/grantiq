# GrantIQ — AI Grant Research & Application Agent

## Architecture

GrantIQ follows the **AdWhisperer pattern**: flat Node.js project with `index.js` as the entry point, `agents/` for sub-agents, and `tools/` for shared infrastructure.

**7 Agents:**
- **Director** (in index.js) — Orchestrator, Telegram bot, intent routing, cron scheduling
- **Finder** — Grant discovery via Perplexity web search, YouTube Data API, webpage fetching
- **Writer** — Application narrative drafting (uses Claude Sonnet for quality)
- **Analyst** — Eligibility analysis, match scoring (0-100), certification advantage mapping
- **Tracker** — Deadline tracking, pipeline management, status transitions
- **Monitor** — Grant monitoring, new opportunity alerts, status checks
- **Reporter** — Email reports (Nodemailer/Composio), Google Drive uploads, dashboard data

**Tools layer:**
- `tools/llm.js` — Multi-provider: Anthropic direct + OpenRouter fallback
- `tools/agent-loop.js` — Agentic tool-use loop (max 15 iterations)
- `tools/composio-tools.js` — 7 tools: web_search, fetch_webpage, query_database, youtube_search, youtube_transcript, upload_to_drive, send_email/draft_email

## Organizations Served

1. **Holigenix Healthcare LLC** — 508(c)(1)(a) Faith-Based Nonprofit, Pediatric Home Health, Georgia
2. **K1 Management LLC** — MBE/MWBE Government Contractor, PA/NJ/DE
3. **Owner Nonprofit** — Georgia (env-var configured)

## Important Rules

- NEVER include patient names or PHI (especially Holigenix)
- Do NOT reference NEMT division or Sunrise Pediatric for Holigenix
- Use Holigenix mission statement VERBATIM
- Lead with 508(c)(1)(a) for foundation grants, SDVOSB for federal grants (Holigenix)
- Lead with COSTARS (March 2026) for PA grants, Delaware OSD/SBF for DE grants (K1)
- Org profiles are embedded in index.js (not separate files)

## Stack

- Runtime: Node.js 20 on Railway
- LLM: **OpenRouter (primary)** — routes Claude Sonnet, GPT-4o-mini, Gemini Flash. Anthropic direct as fallback.
- Database: Supabase (schema in `supabase-setup.sql`)
- Telegram: node-telegram-bot-api (polling mode)
- Email: Nodemailer (Gmail) with Composio fallback
- Dashboard: Static HTML on Vercel (`dashboard/index.html`)
- Tools: Composio (OpenClaw), Perplexity, YouTube Data API v3, Google Drive

## Model Routing (via OpenRouter)

| Agent | Model | Purpose |
|-------|-------|---------|
| Director, Writer | `anthropic/claude-sonnet-4-20250514` | Premium — orchestration, grant writing |
| Finder, Analyst, Tracker, Monitor | `openai/gpt-4o-mini` | Standard — research, analysis |
| Reporter | `google/gemini-2.0-flash-001` | Budget — report formatting |

## Commands

```bash
npm start              # Start the bot
node index.js          # Same thing
```

## Env Vars

Required: `TELEGRAM_TOKEN` (or `TELEGRAM_BOT_TOKEN`) + `OPENROUTER_API_KEY` (or `ANTHROPIC_KEY`)
Optional but recommended: `SUPABASE_URL`, `SUPABASE_KEY`, `PERPLEXITY_API_KEY`

See `.env.example` for full list. The bot loads `.env.local` first, then `.env` via dotenv.

## Database

Run `supabase-setup.sql` in Supabase SQL Editor. Tables: orgs, agents, grant_opportunities, application_drafts, grant_runs, youtube_intel, deadline_alerts, agent_activity_log.

## Deployment

- Backend: Push to GitHub -> Railway (auto-deploy)
- Dashboard: `vercel --prod` from project root
