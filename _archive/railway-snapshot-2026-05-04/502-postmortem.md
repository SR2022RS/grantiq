# Railway 502 Postmortem

**Last successful deploy:** `0d1c4bd` — "Add error handlers to prevent Railway crash loops" — 2026-04-10 17:55:15 -0400  
**First failing deploy:** `b85cfeb` — "feat: View + Download buttons on uploaded K1 documents" — 2026-04-14 08:33:38 -0400  
**Attempted fix (did not fully resolve):** `c5faed6` — "fix: never let Railway 502 silently — bind HTTP port even on bad env / bot" — 2026-04-16 14:09:26 -0400

---

## Root Cause

**Two compounding bugs, with the primary cause documented verbatim in the `c5faed6` commit message:**

**Primary (startup crash before port bind):** In the pre-fix `index.js`, module-level env validation at line 62 called `process.exit(1)` if `TELEGRAM_TOKEN` was missing or falsy. Independently, `new TelegramBot(TELEGRAM_TOKEN, { polling: true })` was called synchronously at line 534 — before `app.listen()`. If the Telegram token was revoked, rate-limited, or already being polled by another Railway instance (e.g., a left-over deploy or a `railway up --detach` session), the constructor would throw. In either case, Express never bound the PORT, Railway's edge proxy received no response after the `restartPolicyMaxRetries = 3` backoff exhausted, and returned "Application failed to respond" (HTTP 502). The `railway.toml` confirms `restartPolicyType = "ON_FAILURE"` — after 3 retries the service stayed dead.

**Why `c5faed6` did not restore the service:** The fix was committed on April 16, but the `status.txt` snapshot (May 4) states the bot had been offline for ~24 days — putting the outage start at approximately April 10, which is exactly the date of the last log entries in `deploy-logs.txt`. This means the `c5faed6` fix deployed to Railway but the service remained in 502. The most likely explanation is that Railway's GitHub auto-deploy was not connected (no `.github/workflows` exists in the repo, and the Railway dashboard was not verified after the push). The fix lived in git but was never confirmed running in production. The `/api/health` diagnostic endpoint added by `c5faed6` was never successfully curl'd to confirm a clean deploy.

**Secondary (silent tool failure):** `deploy-logs.txt` (the last captured log window, 2026-04-10) shows `[WRITER] LLM error: anthropic/claude-sonnet-4-20250514 is not a valid model ID` at lines 1 and 28. This is an OpenRouter routing error (OpenRouter requires the full namespaced model ID, e.g. `anthropic/claude-sonnet-4-20250514` is valid on OpenRouter but the error suggests a model that was removed or renamed on the OpenRouter catalog). This caused Writer agent cycles to fail silently but did NOT crash the process — it was a logged error, not a fatal exception.

---

## Env Var Status (Railway, as of 2026-05-04)

All required vars are **present**. Verified from `env-keys.txt` (Task 0.1 snapshot):

| Variable | Status |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Present (Railway env uses `TELEGRAM_BOT_TOKEN`; code reads `TELEGRAM_TOKEN \|\| TELEGRAM_BOT_TOKEN` — correctly handled) |
| `OPENROUTER_API_KEY` | Present |
| `SUPABASE_URL` | Present |
| `SUPABASE_SERVICE_ROLE_KEY` | Present |
| `COMPOSIO_API_KEY` | Present (Railway uses `COMPOSIO_API_KEY`; code reads `OPEN_CLAW_COMPOSIO \|\| COMPOSIO_API_KEY` — correctly handled) |

**Note:** `ANTHROPIC_KEY` / `ANTHROPIC_API_KEY` are **not** present in Railway env. OpenRouter is the sole LLM gateway on Railway. Add `ANTHROPIC_API_KEY` when migrating to Claude SDK on Vercel.

**Note:** `OPEN_CLAW_COMPOSIO` (the env var mentioned in the spec task) is not in Railway env — Railway has `COMPOSIO_API_KEY` instead. The code handles this via fallback. No action needed.

---

## Confidence Assessment

- **High confidence:** The primary crash mechanism (process.exit on missing env / TelegramBot throw before app.listen) is documented verbatim in the `c5faed6` commit message, which was written by the developer at the moment of diagnosis.
- **Medium confidence:** The reason `c5faed6` didn't fix it (deploy not confirmed, or Railway auto-deploy not active) — inferred from the 24-day offline window and absence of any `.github/workflows` CI.
- **Low confidence:** The exact triggering event that killed the Apr 10 deploy (token conflict? transient Railway restart? something in commits pushed Apr 14?). The actual Railway deploy-period logs (Apr 10–May 4) were rotated and unavailable.

---

## Implication for Vercel Migration

1. **Verify every deploy goes green.** The Railway 502 persisted for 18+ days partly because no one curl'd `/api/health` after the fix commit. On Vercel, the migration plan must include a post-deploy smoke test step: `curl https://<vercel-url>/api/health` (or equivalent) and confirm `{ status: 'ok' }` before marking the task done.

2. **Never rely on Telegram bot polling on serverless.** The original crash path (TelegramBot polling throwing before Express binds) is eliminated by architecture: Vercel functions have no persistent process, so there is no Telegram polling. The new architecture must use Telegram webhooks or drop Telegram entirely in favor of the Claude SDK interface. This removes the entire crash class.

3. **No `process.exit()` in shared module scope.** The new Vercel function entry points must never call `process.exit()` at module load time. Missing env vars should return HTTP 500 with a diagnostic JSON body, not kill the process.

4. **Vercel GitHub auto-deploy IS reliable by default.** Unlike Railway (where auto-deploy requires explicit dashboard wiring and was apparently not confirmed active), Vercel auto-deploys on every push to the connected branch. Use Vercel deployment status checks in CI or the Vercel dashboard to confirm each deploy succeeds before proceeding to the next task.

5. **Add `ANTHROPIC_API_KEY` to Vercel env before first deploy.** It is absent from Railway but required for the Claude SDK migration. Set it in Vercel dashboard → Environment Variables → Production/Preview/Development.

6. **Model ID error (`anthropic/claude-sonnet-4-20250514 is not a valid model ID`)** was a pre-existing agent degradation (not a crash), and will be fully resolved by switching to direct Anthropic SDK calls (no OpenRouter intermediary for Claude models).
