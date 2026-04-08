// ============================================
// REPORTER — Reporting, Email & Drive Agent
// ============================================
// Reporter generates daily grant reports, sends HTML emails
// per org, uploads NotebookLM workspace files to Google Drive,
// and maintains dashboard data.
//
// Tools: query_database, send_email, draft_email, upload_to_drive
// Model: OpenRouter/Gemini Flash (report formatting)

const { runAgent, quickAgent } = require('../tools/agent-loop');

const REPORTER_SYSTEM_PROMPT = `You are Reporter, the Reporting, Email & Drive agent for GrantIQ.

You transform grant research into actionable reports, emails, and organized workspaces.

═══ REPORT TYPES ═══

1. DAILY BRIEFING: Grant pipeline summary, new opportunities, deadlines, action items
2. GRANT REPORT: Detailed per-org report with all opportunities and application drafts
3. EMAIL REPORT: Formatted HTML email per organization
4. NOTEBOOKLM WORKSPACE: Upload 6 structured files to Google Drive per org

═══ DAILY EMAIL REPORT STRUCTURE ═══

Subject: "GrantIQ Daily Briefing — [Org Name] — [Date]"

HTML email with:
- Header with org name and date
- Certification badges (visual)
- Top 5 grants table: Name | Funder | Amount | Deadline | Match Score
- New opportunities section
- Upcoming deadlines section
- Action items (numbered)
- YouTube intel summary (if available)
- Footer with "Powered by GrantIQ"

═══ NOTEBOOKLM FILES (6 per org) ═══

1. MASTER_BRIEFING.md — Daily overview + suggested NotebookLM queries at bottom
2. GRANT_OPPORTUNITIES.md — All grants with full details
3. APPLICATION_DRAFTS.md — Ready-to-submit narratives
4. YOUTUBE_INTEL.md — YouTube research findings
5. ELIGIBILITY_CHECKLIST.md — Requirements tracker per grant
6. README_NOTEBOOKLM_SETUP.md — Setup instructions for NotebookLM

═══ DATABASE ═══
Table: grant_opportunities — Read all grants per org
Table: application_drafts — Read all drafts per org
Table: youtube_intel — Read YouTube research per org
Table: grant_runs — Log each reporting run
  Columns: org_id, run_date, grants_found, grants_emailed, drive_uploaded, youtube_videos, status, created_by ('reporter')

═══ EMAIL RULES ═══
- NEVER cross-send — each org gets ONLY their own data
- Always include org-specific certifications as visual badges
- HTML must be clean, mobile-responsive
- Include match score as colored bar (green >80, yellow 60-80, red <60)

═══ DRIVE RULES ═══
- Use upsert pattern (update if file exists, create if not)
- Each org gets its own subfolder: "[Org Name] — GrantIQ"
- MASTER_BRIEFING.md includes 5 suggested NotebookLM queries at the bottom

═══ RULES ═══
- Every email must have a clear "What To Do Next" section
- Reports are NEVER generic — they reference specific grants by name
- Include timestamps on all reports
- Log every reporting run to grant_runs table`;

async function dispatchDailyReport(context) {
  return runAgent({
    agentName: 'reporter',
    modelRole: 'reporter',
    systemPrompt: REPORTER_SYSTEM_PROMPT,
    task: `Generate the daily grant report for ${context.orgName || 'the organization'} (${context.orgId}).

1. Query grant_opportunities for org_id: ${context.orgId} — sorted by match_score desc
2. Query application_drafts for org_id: ${context.orgId} — latest versions
3. Query youtube_intel for org_id: ${context.orgId} — recent entries
4. Generate the daily briefing for Telegram (max 30 lines, use emojis)
5. ${context.emailTo ? `Send HTML email report to ${context.emailTo}` : 'Skip email (no recipient configured)'}
6. ${context.driveFolderId ? `Upload 6 NotebookLM workspace files to Drive folder: ${context.driveFolderId}` : 'Skip Drive upload (no folder configured)'}
7. Log the run to grant_runs table

Org certifications for badges: ${JSON.stringify(context.certifications || [])}`,
    context,
  });
}

async function dispatchEmailReport(context) {
  return runAgent({
    agentName: 'reporter',
    modelRole: 'reporter',
    systemPrompt: REPORTER_SYSTEM_PROMPT,
    task: `Generate and send an HTML email report for ${context.orgName} (${context.orgId}).

1. Query all grant data for this org
2. Build a professional HTML email with:
   - Certification badges
   - Top grants table with match scores
   - Action items
   - YouTube intel summary
3. Send to: ${context.emailTo}
Subject: "GrantIQ Daily Briefing — ${context.orgName} — ${new Date().toISOString().split('T')[0]}"`,
    context,
  });
}

async function dispatchDriveUpload(context) {
  return runAgent({
    agentName: 'reporter',
    modelRole: 'reporter',
    systemPrompt: REPORTER_SYSTEM_PROMPT,
    task: `Upload NotebookLM workspace files to Google Drive for ${context.orgName} (${context.orgId}).

Drive folder ID: ${context.driveFolderId}
Org name for subfolder: ${context.orgName}

1. Query all grant data, drafts, and YouTube intel for this org
2. Generate 6 markdown files:
   - MASTER_BRIEFING.md (overview + 5 NotebookLM queries)
   - GRANT_OPPORTUNITIES.md (all grants with details)
   - APPLICATION_DRAFTS.md (all narratives)
   - YOUTUBE_INTEL.md (video research)
   - ELIGIBILITY_CHECKLIST.md (requirements per grant)
   - README_NOTEBOOKLM_SETUP.md (setup instructions)
3. Upload each file using upload_to_drive tool`,
    context,
  });
}

async function quickStats(orgId) {
  return quickAgent({
    agentName: 'reporter',
    modelRole: 'reporter',
    systemPrompt: REPORTER_SYSTEM_PROMPT,
    task: `Quick stats for org ${orgId || 'all orgs'}. Query the database and give me: total grants found, avg match score, applications drafted, deadlines this month, last run date. 5 lines.`,
  });
}

module.exports = { dispatchDailyReport, dispatchEmailReport, dispatchDriveUpload, quickStats };
