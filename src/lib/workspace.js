import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE_DIR = resolve(__dirname, '..', '..', 'workspace');

const cache = new Map();

export function loadPersona(agentName) {
  if (cache.has(agentName)) return cache.get(agentName);
  const path = resolve(WORKSPACE_DIR, `${agentName}.md`);
  const content = readFileSync(path, 'utf8');
  cache.set(agentName, content);
  return content;
}

export function clearPersonaCache() { cache.clear(); }
