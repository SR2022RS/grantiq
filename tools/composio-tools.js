// ============================================
// COMPOSIO TOOL EXECUTOR — Grant-specific tools
// ============================================
// Wraps Composio actions as Claude-compatible tools.
// Each sub-agent declares which tools it needs.

const { Composio } = require('composio-core');

const COMPOSIO_API_KEY = process.env.OPEN_CLAW_COMPOSIO || process.env.COMPOSIO_API_KEY || '';
let composioClient = null;

function getComposio() {
  if (!composioClient && COMPOSIO_API_KEY) {
    composioClient = new Composio({ apiKey: COMPOSIO_API_KEY });
  }
  return composioClient;
}

// ── TOOL DEFINITIONS (Anthropic tool_use format) ──

const TOOL_DEFINITIONS = {
  // === EMAIL (Gmail) ===
  send_email: {
    name: 'send_email',
    description: 'Send an email via Gmail. Use for sending grant reports, application drafts, and deadline alerts to org stakeholders.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body (HTML supported)' },
      },
      required: ['to', 'subject', 'body'],
    },
    composio_action: 'GMAIL_SEND_EMAIL',
    map_params: (input) => ({ to: input.to, subject: input.subject, body: input.body, isHtml: true }),
  },

  draft_email: {
    name: 'draft_email',
    description: 'Create an email draft for owner review before sending. Use for application submissions and formal communications.',
    input_schema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Recipient email address' },
        subject: { type: 'string', description: 'Email subject line' },
        body: { type: 'string', description: 'Email body' },
      },
      required: ['to', 'subject', 'body'],
    },
    composio_action: 'GMAIL_CREATE_EMAIL_DRAFT',
    map_params: (input) => ({ to: input.to, subject: input.subject, body: input.body, isHtml: true }),
  },

  // === WEB SEARCH (for Finder research) ===
  web_search: {
    name: 'web_search',
    description: 'Search the web for grant opportunities, funding announcements, foundation directories, government grant portals, and eligibility requirements. Returns search results with URLs.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query — be specific about grant type, region, and org type' },
      },
      required: ['query'],
    },
    custom_executor: true,
  },

  // === WEB BROWSE (for Finder deep research) ===
  fetch_webpage: {
    name: 'fetch_webpage',
    description: 'Fetch and read the content of a specific webpage. Use to analyze grant portal pages, RFP details, eligibility requirements, and application instructions.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch' },
      },
      required: ['url'],
    },
    custom_executor: true,
  },

  // === SUPABASE (for all agents) ===
  query_database: {
    name: 'query_database',
    description: 'Query or insert data into the GrantIQ Supabase database. Tables: orgs, grant_opportunities, application_drafts, grant_runs, youtube_intel, deadline_alerts, agent_activity_log, agents.',
    input_schema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Table name' },
        method: { type: 'string', enum: ['GET', 'POST', 'PATCH'], description: 'HTTP method' },
        params: { type: 'string', description: 'Query params for GET (e.g. "org_id=eq.holigenix_healthcare&limit=10") or filter for PATCH' },
        body: { type: 'object', description: 'Data for POST/PATCH' },
      },
      required: ['table', 'method'],
    },
    custom_executor: true,
  },

  // === YOUTUBE SEARCH (for Finder video research) ===
  youtube_search: {
    name: 'youtube_search',
    description: 'Search YouTube for grant-related videos, tutorials, and announcements. Returns video IDs, titles, and descriptions.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'YouTube search query — include grant type, region, year' },
        maxResults: { type: 'number', description: 'Max results (1-8, default 5)' },
      },
      required: ['query'],
    },
    custom_executor: true,
  },

  // === GOOGLE DRIVE (for Reporter document management) ===
  upload_to_drive: {
    name: 'upload_to_drive',
    description: 'Upload a markdown document to Google Drive for NotebookLM workspace. Creates or updates files in the org-specific GrantIQ folder.',
    input_schema: {
      type: 'object',
      properties: {
        fileName: { type: 'string', description: 'File name (e.g. MASTER_BRIEFING.md)' },
        content: { type: 'string', description: 'File content (markdown)' },
        folderId: { type: 'string', description: 'Google Drive folder ID' },
        orgName: { type: 'string', description: 'Organization name for subfolder' },
      },
      required: ['fileName', 'content', 'folderId'],
    },
    custom_executor: true,
  },

  // === YOUTUBE TRANSCRIPT (for Finder deep analysis) ===
  youtube_transcript: {
    name: 'youtube_transcript',
    description: 'Extract the transcript/captions from a YouTube video for analysis. Use after youtube_search to get detailed content from promising grant videos.',
    input_schema: {
      type: 'object',
      properties: {
        videoId: { type: 'string', description: 'YouTube video ID (e.g. dQw4w9WgXcQ)' },
      },
      required: ['videoId'],
    },
    custom_executor: true,
  },
};

// ── AGENT → TOOL MAPPING ──
const AGENT_TOOLS = {
  director:  ['query_database', 'send_email', 'web_search'],
  finder:    ['web_search', 'fetch_webpage', 'query_database', 'youtube_search', 'youtube_transcript'],
  writer:    ['query_database', 'web_search'],
  analyst:   ['query_database', 'web_search', 'fetch_webpage'],
  tracker:   ['query_database'],
  monitor:   ['query_database', 'web_search'],
  reporter:  ['query_database', 'send_email', 'draft_email', 'upload_to_drive'],
};

function getToolsForAgent(agentName) {
  const toolNames = AGENT_TOOLS[agentName] || ['query_database'];
  return toolNames.map(name => {
    const def = TOOL_DEFINITIONS[name];
    if (!def) return null;
    return { name: def.name, description: def.description, input_schema: def.input_schema };
  }).filter(Boolean);
}

// ── TOOL EXECUTOR ──

async function executeTool(toolName, input) {
  const def = TOOL_DEFINITIONS[toolName];
  if (!def) return { error: `Unknown tool: ${toolName}` };

  // Custom executors (non-Composio)
  if (def.custom_executor) {
    return executeCustomTool(toolName, input);
  }

  // Email tools: try Composio first, fall back to Nodemailer
  if (toolName === 'send_email' || toolName === 'draft_email') {
    const composio = getComposio();
    if (composio) {
      try {
        const entity = composio.getEntity('grantiq-bot');
        const params = def.map_params ? def.map_params(input) : input;
        const result = await entity.execute({ actionName: def.composio_action, params });
        return result;
      } catch (e) {
        console.log(`[Composio] ${toolName} failed, trying Nodemailer:`, e.message);
      }
    }

    // Nodemailer fallback
    const EMAIL_USER = process.env.EMAIL_USER;
    const EMAIL_PASS = process.env.EMAIL_PASS;
    if (EMAIL_USER && EMAIL_PASS) {
      try {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: { user: EMAIL_USER, pass: EMAIL_PASS },
        });
        if (toolName === 'draft_email') {
          return { status: 'draft_saved', note: 'Nodemailer does not support drafts. Email ready to send.', to: input.to, subject: input.subject };
        }
        await transporter.sendMail({
          from: EMAIL_USER,
          to: input.to,
          subject: input.subject,
          html: input.body,
        });
        return { status: 'sent', to: input.to, subject: input.subject };
      } catch (e) {
        return { error: `Nodemailer error: ${e.message}` };
      }
    }

    return { error: 'No email service configured. Set COMPOSIO_API_KEY or EMAIL_USER + EMAIL_PASS.' };
  }

  // Other Composio tools
  const composio = getComposio();
  if (!composio) return { error: 'Composio not configured. Set COMPOSIO_API_KEY.' };

  try {
    const entity = composio.getEntity('grantiq-bot');
    const params = def.map_params ? def.map_params(input) : input;
    const result = await entity.execute({ actionName: def.composio_action, params });
    return result;
  } catch (e) {
    console.error(`[Composio] ${toolName} error:`, e.message);
    return { error: e.message };
  }
}

async function executeCustomTool(toolName, input) {
  const SUPABASE_URL = process.env.SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;
  const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  const GOOGLE_SERVICE_ACCOUNT = process.env.GOOGLE_SERVICE_ACCOUNT;

  switch (toolName) {
    case 'web_search': {
      if (!PERPLEXITY_API_KEY) return { error: 'PERPLEXITY_API_KEY not set' };
      try {
        const res = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${PERPLEXITY_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'sonar',
            messages: [
              { role: 'system', content: 'You are a grant research analyst. Find specific grant opportunities, funding sources, RFPs, and eligibility details. Provide concise, actionable intelligence with specific data points, deadlines, amounts, and source URLs. Focus on currently open or upcoming grants.' },
              { role: 'user', content: input.query },
            ],
            max_tokens: 2000,
          }),
        });
        const data = await res.json();
        return { answer: data.choices?.[0]?.message?.content || '', sources: data.citations || [] };
      } catch (e) { return { error: e.message }; }
    }

    case 'fetch_webpage': {
      try {
        const res = await fetch(input.url, { headers: { 'User-Agent': 'GrantIQ-Bot/1.0' } });
        const html = await res.text();
        const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 4000);
        return { url: input.url, text };
      } catch (e) { return { error: e.message }; }
    }

    case 'query_database': {
      if (!SUPABASE_URL || !SUPABASE_KEY) return { error: 'SUPABASE_URL/KEY not set' };
      try {
        const url = `${SUPABASE_URL}/rest/v1/${input.table}${input.params ? '?' + input.params : ''}`;
        const opts = {
          method: input.method || 'GET',
          headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
        };
        if (input.method === 'POST') { opts.headers['Prefer'] = 'return=representation'; opts.body = JSON.stringify(input.body); }
        if (input.method === 'PATCH') { opts.headers['Prefer'] = 'return=minimal'; opts.body = JSON.stringify(input.body); }
        const res = await fetch(url, opts);
        const data = await res.json();
        return data;
      } catch (e) { return { error: e.message }; }
    }

    case 'youtube_search': {
      const maxResults = Math.min(input.maxResults || 5, 8);

      // Try Composio YouTube connection first (YOUTUBE_AUTH_KEY via Composio OAuth)
      if (process.env.YOUTUBE_AUTH_KEY || COMPOSIO_API_KEY) {
        const composio = getComposio();
        if (composio) {
          try {
            const entity = composio.getEntity('grantiq-bot');
            const result = await entity.execute({
              actionName: 'YOUTUBE_SEARCH_LIST',
              params: { part: 'snippet', q: input.query, type: 'video', maxResults, order: 'relevance' },
            });
            const items = result?.items || result?.data?.items || [];
            if (items.length > 0) {
              const videos = items.map(item => ({
                videoId: item.id?.videoId || item.videoId,
                title: item.snippet?.title || item.title || '',
                description: item.snippet?.description || item.description || '',
                channelTitle: item.snippet?.channelTitle || item.channelTitle || '',
                publishedAt: item.snippet?.publishedAt || item.publishedAt || '',
                url: `https://www.youtube.com/watch?v=${item.id?.videoId || item.videoId}`,
              }));
              return { videos, totalResults: videos.length, source: 'composio' };
            }
          } catch (e) {
            console.log('[YouTube] Composio search failed, trying direct API:', e.message);
          }
        }
      }

      // Fallback to direct YouTube Data API v3 key
      if (!YOUTUBE_API_KEY) return { error: 'No YouTube access — set YOUTUBE_API_KEY or connect YouTube via Composio' };
      try {
        const query = encodeURIComponent(input.query);
        const res = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&maxResults=${maxResults}&order=relevance&key=${YOUTUBE_API_KEY}`
        );
        const data = await res.json();
        if (data.error) return { error: data.error.message };
        const videos = (data.items || []).map(item => ({
          videoId: item.id.videoId,
          title: item.snippet.title,
          description: item.snippet.description,
          channelTitle: item.snippet.channelTitle,
          publishedAt: item.snippet.publishedAt,
          url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        }));
        return { videos, totalResults: data.pageInfo?.totalResults || 0, source: 'direct_api' };
      } catch (e) { return { error: e.message }; }
    }

    case 'youtube_transcript': {
      try {
        const { YoutubeTranscript } = require('youtube-transcript');
        const transcript = await YoutubeTranscript.fetchTranscript(input.videoId);
        const text = transcript.map(t => t.text).join(' ').substring(0, 5000);
        return { videoId: input.videoId, transcript: text, segments: transcript.length };
      } catch (e) {
        return { error: `Transcript unavailable: ${e.message}`, videoId: input.videoId };
      }
    }

    case 'upload_to_drive': {
      if (!GOOGLE_SERVICE_ACCOUNT) return { error: 'GOOGLE_SERVICE_ACCOUNT not set — skipping Drive upload' };
      try {
        // Parse service account JSON
        const sa = JSON.parse(GOOGLE_SERVICE_ACCOUNT);
        // Get access token via JWT
        const jwt = await getGoogleAccessToken(sa);
        if (!jwt) return { error: 'Failed to get Google access token' };

        // Search for existing file
        const searchRes = await fetch(
          `https://www.googleapis.com/drive/v3/files?q=name='${input.fileName}' and '${input.folderId}' in parents and trashed=false&fields=files(id,name)`,
          { headers: { 'Authorization': `Bearer ${jwt}` } }
        );
        const searchData = await searchRes.json();
        const existingFile = searchData.files?.[0];

        if (existingFile) {
          // Update existing file
          await fetch(`https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': 'text/markdown' },
            body: input.content,
          });
          return { action: 'updated', fileId: existingFile.id, fileName: input.fileName };
        } else {
          // Create new file
          const metadata = { name: input.fileName, parents: [input.folderId], mimeType: 'text/markdown' };
          const boundary = '===grantiq_boundary===';
          const body = `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: text/markdown\r\n\r\n${input.content}\r\n--${boundary}--`;
          const createRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${jwt}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
            body,
          });
          const createData = await createRes.json();
          return { action: 'created', fileId: createData.id, fileName: input.fileName };
        }
      } catch (e) { return { error: e.message }; }
    }

    default:
      return { error: `No custom executor for ${toolName}` };
  }
}

// ── Google Service Account JWT auth ──
async function getGoogleAccessToken(serviceAccount) {
  try {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: 'https://www.googleapis.com/auth/drive',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })).toString('base64url');

    const crypto = require('crypto');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(`${header}.${payload}`);
    const signature = sign.sign(serviceAccount.private_key, 'base64url');

    const jwt = `${header}.${payload}.${signature}`;
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });
    const data = await res.json();
    return data.access_token;
  } catch (e) {
    console.error('[Google Auth] Error:', e.message);
    return null;
  }
}

module.exports = { getToolsForAgent, executeTool, getComposio, TOOL_DEFINITIONS };
