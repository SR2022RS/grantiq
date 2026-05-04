// One-shot migration: extract orgs from legacy index.js and insert into orgs table.
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function main() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const legacyPath = resolve(__dirname, '..', 'index.js');
  const legacy = readFileSync(legacyPath, 'utf8');

  const startMatch = legacy.match(/const\s+ORGS\s*=\s*\[/);
  if (!startMatch) {
    console.error('Could not locate ORGS array in index.js');
    process.exit(1);
  }
  const startIdx = startMatch.index + startMatch[0].length - 1;

  let depth = 0;
  let endIdx = -1;
  for (let i = startIdx; i < legacy.length; i++) {
    const ch = legacy[i];
    if (ch === '[') depth++;
    else if (ch === ']') {
      depth--;
      if (depth === 0) { endIdx = i + 1; break; }
    }
  }
  if (endIdx === -1) {
    console.error('Could not find end of ORGS array');
    process.exit(1);
  }

  const orgsLiteral = legacy.slice(startIdx, endIdx);
  // eslint-disable-next-line no-eval
  const ORGS = eval(`(${orgsLiteral})`);
  console.log(`Extracted ${ORGS.length} orgs:`, ORGS.map((o) => o.id));

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  for (const org of ORGS) {
    const row = {
      id: org.id,
      name: org.name,
      data: org,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('orgs').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error(`Failed to upsert org ${org.id}:`, error.message);
      process.exit(1);
    }
    console.log(`✓ Upserted ${org.id}`);
  }
  console.log('Done.');
}

main().catch((e) => { console.error(e); process.exit(1); });
