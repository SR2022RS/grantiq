export const fetchWebpageSchema = {
  name: 'fetch_webpage',
  description: 'Fetch a webpage and return its text content (HTML stripped). Use to read grant detail pages, agency announcements, deadlines.',
  input_schema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      max_chars: { type: 'number', description: 'Default 8000' },
    },
    required: ['url'],
  },
};

export async function fetchWebpage({ url, max_chars = 8000 }) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 GrantIQ/2.0' },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const html = await res.text();
    const text = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max_chars);
    return { ok: true, url, text };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
