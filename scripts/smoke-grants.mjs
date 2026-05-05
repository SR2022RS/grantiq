// Hits the Grants agent locally via vercel dev. Requires .env.local set up.
const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function smoke() {
  // Health
  const h = await fetch(`${BASE}/api/health`);
  console.log('Health:', h.status, await h.json());

  // Chat — discovery prompt
  const c1 = await fetch(`${BASE}/api/grants/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'List the top 3 K1 Management grants in our pipeline by match score.',
      user_chat_id: 'smoke-test',
    }),
  });
  if (!c1.ok) {
    console.error('Chat 1 failed:', c1.status, await c1.text());
    process.exit(1);
  }
  const r1 = await c1.json();
  console.log('Chat 1 status:', r1.status, 'iterations:', r1.telemetry?.iterations);
  console.log('Chat 1 text (first 300):', r1.text.slice(0, 300));

  if (r1.status !== 'success') {
    console.error('Chat 1 did not succeed');
    process.exit(1);
  }
  console.log('SMOKE PASSED');
}

smoke().catch((e) => { console.error(e); process.exit(1); });
