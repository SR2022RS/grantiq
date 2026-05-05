# Post-Cutover Monitoring — GrantIQ Vercel SDK Migration

**Cutover date:** 2026-05-05
**Production URL:** https://grantiq-ivory.vercel.app
**Old service:** Railway `grantiq-bot` (deployment removed, service shell + env retained for rollback)
**Tag:** `v2.0.0-vercel-cutover`

---

## Immediate post-cutover checks (do these now)

Once you have a few minutes after deploy:

1. **Open the portal** — https://grantiq-ivory.vercel.app
   - Switch sidebar to Holigenix → Pipeline shows real GA + national grants (no Delaware)
   - Switch to K1 → Pipeline shows top K1 matches; Vault shows 22/27 ready
   - Try Chat: ask *"List my top 3 K1 grants"* — agent should respond in <30s

2. **Test the readiness pack** — Vault → click "Generate Readiness Pack" → ZIP downloads with 9 Holigenix templates

3. **Verify cron registration** — Vercel dashboard → grantiq → Settings → Cron Jobs. Should show 3 crons:
   - `/api/cron/process-tasks` — `* * * * *`
   - `/api/cron/daily-discovery` — `0 12 * * *`
   - `/api/cron/deadline-check` — `0 */6 * * *`

---

## 24-hour checkpoint

Run this SQL in Supabase SQL editor, then read the metrics below:

```sql
-- 24h activity summary
select
  agent_id,
  count(*) filter (where action = 'chat_turn')        as chat_turns,
  count(*) filter (where action = 'task_run')          as playwright_runs,
  count(*) filter (where detail = 'success')           as successes,
  count(*) filter (where detail in ('error','partial','failed')) as failures,
  round(avg((metadata->>'latency_ms')::numeric)::numeric, 0) as avg_latency_ms,
  sum((metadata->>'tokens_in')::int)  as total_tokens_in,
  sum((metadata->>'tokens_out')::int) as total_tokens_out
from agent_activity_log
where created_at > now() - interval '24 hours'
group by agent_id
order by agent_id;

-- Cron firings
select
  user_chat_id,
  count(*) as runs,
  max(last_message_at) as last_run
from grants_conversations
where user_chat_id like 'cron-%'
  and started_at > now() - interval '24 hours'
group by user_chat_id;

-- Errors (if any)
select detail, count(*)
from agent_activity_log
where created_at > now() - interval '24 hours'
  and detail not in ('success', 'partial', 'chat_turn', 'task_run')
group by detail
order by count desc;
```

**Healthy thresholds:**
- Error rate < 5% of total turns
- Avg latency < 15,000 ms per chat turn
- ≥ 1 daily-discovery run completed (1 per org × 1 day = 3 total)
- ≥ 4 deadline-check runs (every 6 hours × 24h = 4)
- Total tokens < 200K in 24h (cost ~$3-6)

**If any of these fail:** see Rollback procedure below before continuing.

Document the checkpoint result in `_archive/railway-snapshot-2026-05-04/cutover.md` under a new `## 24h checkpoint` heading.

---

## 72-hour checkpoint

Repeat the SQL with `interval '72 hours'`. Additional checks at 72h:

1. **Anthropic billing dashboard** — confirm 72h spend is < $30. If projected monthly > $200, see spec §10.5 cost cap. Lower cron frequency or reduce MAX_TOOL_ITERATIONS in `src/lib/constants.js`.

2. **Vercel function invocation counts** — dashboard → grantiq → Functions tab. Look for runaway invocations (any function called >10K times in 72h is a red flag).

3. **Supabase row growth** — `select count(*) from grants_messages, alerts, agent_activity_log` — confirm growth is linear, not exponential (exponential = a loop).

4. **User-reported issues** — anything weird in chat responses? Drafts containing wrong org's data? Alerts for grants that don't apply? File these under `## Issues` in cutover.md.

If 72h is clean (error rate <5%, costs on track, no critical issues): proceed to **7-day archive** below. Otherwise: investigate, possibly rollback.

---

## 7-day archive (only run if 24h + 72h passed)

```bash
# 1. Archive the Railway service so we stop paying for the dormant config
#    (env vars stay; service is renamed and disabled)
railway logout                                # session-level cleanup
# Then in Railway dashboard:
#   - Project: grantiq-bot → Settings → Rename to "grantiq-bot-RETIRED-2026-05-12"
#   - Then either Delete Project or leave it for cold storage

# 2. Tag the archived state
git checkout main
git pull origin main
git merge --no-ff migration/claude-sdk-vercel -m "Merge: Railway → Vercel SDK migration"
git tag -a "archived/railway-2026-05-12" -m "Railway grantiq-bot retired"
git push origin main --tags

# 3. Update CLAUDE.md to reflect new architecture
```

---

## Rollback procedure (if 24h or 72h checkpoint fails critically)

> Trigger criteria: error rate >10%, repeated agent crashes, monthly cost projection >$500, or business-critical functionality broken.

1. **Disable Vercel crons immediately** to stop bleeding:
   - Vercel dashboard → grantiq → Settings → Cron Jobs → toggle off all 3, OR
   - Edit `vercel.json` to remove the `crons` block, push to main

2. **Bring Railway back up** (env vars are still there):
   ```bash
   cd ~/Documents/GitHub/grantiq
   git checkout cea4100   # last commit before SDK migration
   railway up --detach    # redeploys old bot to existing service
   ```

3. **Re-point users** — anyone using the new portal links should be told to use the old `grantiq-bot-production.up.railway.app` until rollback is investigated.

4. **Tag the failed deploy + write postmortem**:
   ```bash
   git tag -a "rollback-2026-05-XX" -m "Rolled back from Vercel SDK to Railway"
   git push --tags
   ```
   Postmortem template: `docs/postmortems/2026-05-XX-vercel-rollback.md` —
   root cause, timeline, what worked, what failed, prevention.

**If rollback takes >15 min: this runbook is incomplete. Update it.**

---

## Production CRON_SECRET (one-shot recovery)

If you need to manually fire a cron from the command line for debugging:

```bash
PROD_CRON_SECRET="0abed932d5103bc65a9e3d6509742df3571ca1f50d942d095c2075e777c5dd92"
curl -H "Authorization: Bearer $PROD_CRON_SECRET" \
  https://grantiq-ivory.vercel.app/api/cron/daily-discovery
```

(This secret is also stored in Vercel's encrypted env. It's recorded here so you don't have to retrieve it from Vercel dashboard if you need it urgently.)

---

## Closeout — when 7 days pass clean

1. Update `CLAUDE.md` to remove all Railway / OpenClaw references (they're already gone from the working architecture; this is just polish)
2. Archive `_archive/railway-snapshot-2026-05-04/` and the `*-openclaw` repos by tagging each with `archived/2026-05-12`
3. Delete the local `migration/claude-sdk-vercel` branch after merge to main
4. Celebrate.
