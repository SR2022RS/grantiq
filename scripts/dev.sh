#!/usr/bin/env bash
# Start `vercel dev` with .env.local exported into the function process.
#
# Why this script exists:
# `vercel dev` does NOT auto-load .env.local for serverless functions in the
# same way Next.js does. It expects env vars to be configured in the Vercel
# project (set via `vercel env add ... development`). For local dev where we
# don't want to push every secret to Vercel, we source .env.local into the
# parent shell and pass it through.
#
# Usage:  bash scripts/dev.sh
# Or:     ./scripts/dev.sh   (if executable)

set -euo pipefail

if [ ! -f .env.local ]; then
  echo "ERROR: .env.local not found. Add it with required keys before running dev." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.local
set +a

echo "Starting vercel dev with .env.local loaded into shell env..."
exec npx vercel dev --yes --listen "${PORT:-3000}"
