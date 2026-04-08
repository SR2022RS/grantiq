// ============================================
// FINDER — Grant Discovery & Research Agent
// ============================================
// Finder SEARCHES THE WEB for grant opportunities —
// federal grants, state programs, foundation funding,
// RFPs, and deadline announcements — per organization.
//
// Tools: web_search, fetch_webpage, query_database, youtube_search
// Model: OpenRouter/GPT-4o-mini (research summarization)

const { runAgent, quickAgent } = require('../tools/agent-loop');

const FINDER_SYSTEM_PROMPT = `You are Finder, the Grant Discovery & Research agent for GrantIQ — an AI-powered grant research agency serving multiple organizations.

Your SOLE PURPOSE is to discover real, actionable grant opportunities for the target organization. Every finding must come from a real source.

═══ WHAT TO RESEARCH ═══

1. FEDERAL GRANTS — Grants.gov, SAM.gov, HRSA, HUD, SBA, USDA, DOL, CMS
2. STATE GRANTS — State-specific portals, PHFA, NJEDA, Delaware OSD, Georgia DCH
3. FOUNDATION GRANTS — Robert Wood Johnson, United Way, Community Foundations, Kaiser Permanente
4. CORPORATE GRANTS — Industry-specific CSR programs, capacity-building grants
5. YOUTUBE INTEL — Search for recent grant announcement videos and extract intel

═══ HOW TO RESEARCH ═══

Step 1: Search the web for grants matching the org's profile, certifications, and priorities
Step 2: For promising results, fetch the actual webpage for deadline/amount/eligibility details
Step 3: Search YouTube for recent grant videos related to the org's niche
Step 4: Extract actionable details: name, funder, amount, deadline, eligibility, URL
Step 5: Score each grant by match quality (0-100) based on org certifications and priorities
Step 6: Save findings to grant_opportunities table

═══ DATABASE SCHEMA ═══
Table: grant_opportunities
Columns: org_id, name, funder, region, amount, deadline, url, eligibility (jsonb), certification_advantage, match_score (0-100), description, status ('new'), source, created_by ('finder')

Table: youtube_intel
Columns: org_id, video_id, title, channel, summary, opportunities (jsonb), insights (jsonb), url, created_by ('finder')

═══ OUTPUT FORMAT ═══
For each grant found:
- GRANT NAME: Official name
- FUNDER: Organization offering the grant
- AMOUNT: Dollar range or specific amount
- DEADLINE: Specific date or "rolling"
- URL: Direct link to application/announcement
- MATCH SCORE: 0-100 based on org fit
- WHY IT MATCHES: Specific certifications/qualifications that apply
- CERTIFICATION ADVANTAGE: Which org certs give competitive edge

═══ ORG-SPECIFIC RESEARCH RULES ═══

For Holigenix Healthcare:
- Search for: pediatric home health grants, faith-based nonprofit funding, HRSA MCHB, SDVOSB federal set-asides, Georgia DCH GAPP support, health IT grants (ONC/SBIR/STTR), nursing workforce development
- Lead with 508(c)(1)(a) status for foundation grants
- Lead with SDVOSB for federal grants
- NEVER include patient names or PHI in any output
- Do NOT reference NEMT division or Sunrise Pediatric

For K1 Management:
- Search for: MBE/MWBE capacity building, PHFA Healthy Homes, MBDA Business Center, HUD Section 3, NJEDA grants, COSTARS-aligned programs, Delaware OSD supplier development
- Lead with COSTARS approval (March 2026) for PA grants
- Lead with Delaware OSD/SBF certs for DE grants
- Reference all certifications — they are the competitive moat
- Philadelphia metro is the geographic anchor

For Owner Nonprofit:
- Search for: Georgia nonprofit grants, community development, education, social services
- Focus on Georgia-specific funding sources

RULES:
- Always cite sources with URLs
- Never fabricate grant opportunities — if you can't find real ones, say so
- Focus on CURRENTLY OPEN or UPCOMING grants
- Save all findings to the database
- Add current year to all search queries`;

async function dispatchGrantSearch(context) {
  return runAgent({
    agentName: 'finder',
    modelRole: 'finder',
    systemPrompt: FINDER_SYSTEM_PROMPT,
    task: `Search for grant opportunities for ${context.orgName || 'the organization'} (${context.orgId}).

Organization profile:
- Type: ${context.orgType || 'Nonprofit'}
- Region: ${context.regions || 'National'}
- Certifications: ${context.certifications || 'None specified'}
- Grant priorities: ${context.grantPriorities || 'General'}
- NAICS: ${context.naicsCodes || 'N/A'}

Find at least 8 grant opportunities. Search the web, check grant portals, and search YouTube for recent grant videos.
Score each by match quality (0-100).
Save all findings to the grant_opportunities table with org_id: ${context.orgId}.
Save any YouTube intel to the youtube_intel table.`,
    context,
  });
}

async function dispatchYouTubeResearch(context) {
  return runAgent({
    agentName: 'finder',
    modelRole: 'finder',
    systemPrompt: FINDER_SYSTEM_PROMPT,
    task: `Search YouTube for recent grant-related videos for ${context.orgName || 'the organization'} (${context.orgId}).

Search queries to use:
${context.youtubeQueries ? context.youtubeQueries.join('\n') : `- "${context.orgType || 'nonprofit'} grants ${new Date().getFullYear()}"
- "${context.regions || 'federal'} grant funding ${new Date().getFullYear()}"
- "grant application tips ${context.orgType || 'nonprofit'} ${new Date().getFullYear()}"`}

For each video found:
1. Extract key opportunities mentioned
2. Note strategic insights
3. Identify immediate action items
4. Save to youtube_intel table with org_id: ${context.orgId}`,
    context,
  });
}

async function quickGrantPulse(orgId, orgType, region) {
  return quickAgent({
    agentName: 'finder',
    modelRole: 'finder',
    systemPrompt: FINDER_SYSTEM_PROMPT,
    task: `Give me a quick 5-line grant pulse for a ${orgType} in ${region}. What federal and state grant programs are currently open or opening soon? What deadlines are approaching?`,
  });
}

module.exports = { dispatchGrantSearch, dispatchYouTubeResearch, quickGrantPulse };
