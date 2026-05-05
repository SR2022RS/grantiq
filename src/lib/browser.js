// Browser session abstraction — wraps Vercel Sandbox or Browserbase.
// Intent: every Playwright tool calls into this module; runtime swap is one place.

import { chromium } from 'playwright-core';

// In R1 we use a direct Playwright connection to a remote Chromium that Vercel Sandbox provides.
// VERCEL_SANDBOX_BROWSER_WS is the WebSocket endpoint exposed by the sandbox.
// If it's unset, fall back to launching a local Chromium (dev only — requires `npx playwright install chromium`).

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

export async function takeScreenshot({ session_id }) {
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
