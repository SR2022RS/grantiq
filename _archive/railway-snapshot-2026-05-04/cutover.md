
# Railway → Vercel Cutover

**Cutover at:** 2026-05-05
**Vercel deploy URL:** https://grantiq-ivory.vercel.app
**Vercel deploy ID:** grantiq-qp17h778d-sr2022rs-projects.vercel.app
**Railway service:** Removed via `railway down --yes` (env vars + service config retained for rollback)
**Production CRON_SECRET:** 0abed932d5103bc65a9e3d6509742df3571ca1f50d942d095c2075e777c5dd92
  (stored in Vercel env, also recorded here for emergency cron triggering)

## End-to-end production verification (passed at cutover time)
- Static assets: / → 200, /styles.css → 200, /app.jsx → 200, /live-data.jsx → 200
- Pretty URLs: /k1 → 200, /holigenix → 200
- /api/health: { server: ok, supabase: ok, anthropic: configured }
- /api/grants/chat: agent invoked query_pipeline, returned PHFA Healthy Homes (90% K1 match) in 2 iterations
- /api/orgs/readiness-pack?org_id=holigenix_healthcare: 13KB ZIP with 9 templates

## Production env vars on Vercel
- ANTHROPIC_API_KEY (encrypted)
- SUPABASE_URL (encrypted)
- SUPABASE_SERVICE_ROLE_KEY (encrypted)
- PERPLEXITY_API_KEY (encrypted)
- CRON_SECRET (encrypted)

## Cron schedules (in vercel.json)
- /api/cron/process-tasks   — every minute
- /api/cron/daily-discovery — daily 12:00 UTC (7am ET)
- /api/cron/deadline-check  — every 6 hours

## Rollback procedure (if 24/72h monitoring fails)
1. Disable Vercel crons in dashboard or vercel.json
2. Restart Railway: redeploy the last known-good commit on grantiq-bot
   (env vars are intact)
3. Update DNS / dashboard to point at Railway URL
4. Tag the failed Vercel deploy + write postmortem
