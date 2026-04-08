require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // also load .env if present

const TelegramBot = require('node-telegram-bot-api');
const cron = require('node-cron');
const express = require('express');

// ── SUB-AGENTS ──
const { dispatchGrantSearch, dispatchYouTubeResearch, quickGrantPulse } = require('./agents/finder');
const { dispatchApplicationDrafts, quickNarrativeIdeas } = require('./agents/writer');
const { dispatchEligibilityAnalysis, quickEligibilityCheck } = require('./agents/analyst');
const { dispatchPipelineReview, dispatchDeadlineCheck, quickPipelineStatus } = require('./agents/tracker');
const { dispatchMonitoringScan, dispatchStatusCheck, quickAlertSummary } = require('./agents/monitor');
const { dispatchDailyReport, dispatchEmailReport, dispatchDriveUpload, quickStats } = require('./agents/reporter');
const { dispatchVaultCheck, dispatchGrantReadiness, quickVaultStatus } = require('./agents/vault');
const { dispatchBudgetGeneration, quickBudgetEstimate } = require('./agents/budgetgen');
const { dispatchOneClickApply, dispatchPackageCheck, quickApplyCheck } = require('./agents/applicator');

// ============================================
// CONFIG
// ============================================
const TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
const ANTHROPIC_KEY = process.env.ANTHROPIC_KEY || process.env.ANTHROPIC_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENROUTER_KEY || '';
const COMPOSIO_API_KEY = process.env.OPEN_CLAW_COMPOSIO || process.env.COMPOSIO_API_KEY || '';
const RUN_SECRET = process.env.RUN_SECRET || '';

// At least one LLM key is required (OpenRouter preferred, Anthropic as fallback)
const HAS_LLM = OPENROUTER_API_KEY || ANTHROPIC_KEY;

// ── ENV VALIDATION ──
const required = { TELEGRAM_TOKEN };
const requiredLLM = { 'OPENROUTER_API_KEY or ANTHROPIC_KEY': HAS_LLM };
const optional = { SUPABASE_URL, SUPABASE_KEY, COMPOSIO_API_KEY, ANTHROPIC_KEY, OPENROUTER_API_KEY, PERPLEXITY_API_KEY: process.env.PERPLEXITY_API_KEY, YOUTUBE_API_KEY: process.env.YOUTUBE_API_KEY, GOOGLE_SERVICE_ACCOUNT: process.env.GOOGLE_SERVICE_ACCOUNT, EMAIL_USER: process.env.EMAIL_USER };

console.log('\n🔍 Environment Check:');
let missingRequired = false;
for (const [key, val] of Object.entries(required)) {
  if (!val) { console.error(`  ❌ ${key} — REQUIRED, not set`); missingRequired = true; }
  else { console.log(`  ✅ ${key}`); }
}
for (const [key, val] of Object.entries(requiredLLM)) {
  if (!val) { console.error(`  ❌ ${key} — REQUIRED, at least one LLM key needed`); missingRequired = true; }
  else { console.log(`  ✅ LLM Provider: ${OPENROUTER_API_KEY ? 'OpenRouter (primary)' : 'Anthropic (direct)'}`); }
}
for (const [key, val] of Object.entries(optional)) {
  console.log(`  ${val ? '✅' : '⚠️'} ${key}${val ? '' : ' — not set (optional)'}`);
}
if (missingRequired) {
  console.error('\nFATAL: Missing required env vars. See above.\n');
  process.exit(1);
}
console.log('');

const OWNER_CHAT_ID = process.env.OWNER_CHAT_ID || null;
let ownerChatId = OWNER_CHAT_ID;

// ============================================
// ORGANIZATION PROFILES
// ============================================
const ORGS = [
  {
    id: 'holigenix_healthcare',
    label: 'Holigenix Healthcare LLC — Pediatric Home Health (Georgia)',
    name: 'Holigenix Healthcare LLC',
    dba: 'Holigenix Healthcare — Home Health Care',
    legalStructure: '508(c)(1)(a) Faith-Based Nonprofit Organization (also operates as LLC)',
    orgType: 'Faith-Based Nonprofit Home Health Agency',
    yearEstablished: '2024',
    address: '56 Perimeter Center East, Suite 150, Atlanta, GA 30346',
    county: 'Cobb County, Georgia (Atlanta Metropolitan Area)',
    phone: '(404) 831-7582',
    email: 'admin@holigenixhealthcare.com',
    website: 'holigenixhealthcare.com',
    npi: '1770341067',
    uei: process.env.HOLIGENIX_UEI || 'NNR7S596R4K9',
    cage: '9XZJ9',
    industry: 'Pediatric Home Health / Private Duty Nursing',
    healthcareClassification: 'Pediatric Home Health Agency — Faith-Based Nonprofit',
    clinicalDirector: 'Yinessa Davis-Cacapit, RN, BSN — Director of Nursing & Co-Founder',
    operationsLead: 'Rodney Williams — Co-Founder, Operations & Strategy',
    adminSupport: 'Rio — Virtual Administrative Assistant (Mon–Thu 3–6 PM EST)',
    mission: 'To deliver compassionate, high-quality home healthcare services that empower medically complex individuals and their families — particularly children — to thrive safely within their homes and communities.',
    vision: 'To be the most trusted and innovative home healthcare agency in Georgia — bridging clinical excellence, faith-based values, and technology-driven care coordination to create lasting health equity in underserved communities.',
    coreValues: 'Compassion, Clinical Excellence, Integrity, Faith (508(c)(1)(a) nonprofit), Health Equity, Innovation',
    medicaidProgram: 'Georgia Pediatric Program (GAPP) — Approved Provider',
    primaryService: 'Private Duty Nursing (PDN) — Skilled Nursing and Personal Care',
    evvAggregator: 'HHAeXchange (Georgia state-mandated EVV aggregator)',
    claimsSystem: 'GAMMIS (Georgia Medicaid Management Information System)',
    services: 'Private Duty Nursing — RN (S9123: $95.36/hr); Skilled Nursing — LPN (S9124: $63.40/hr); Personal Care Aide — PCA (S9122: $25.52/hr); Supervisory nursing visits; Digital nursing notes (20-section state-aligned); Service plan management; Family caregiver education; Seizure management; G-tube/NG-tube care; Tracheostomy/ventilator care; Wound care; Medication administration',
    population: 'Medically fragile pediatric patients (GAPP waiver — primary); Adult private-pay (in development); High-net-worth families requiring premium home care; Veterans (VA-aligned); Underserved Black and brown families in metro Atlanta',
    communityNeed: 'Georgia ranks among the top states for pediatric Medicaid enrollment; Cobb County and metro Atlanta face documented shortage of qualified home health providers accepting Medicaid pediatric cases; families of medically complex children (seizure disorders, G-tube, tracheostomy, ventilator dependency) cannot access timely skilled nursing; disparities disproportionately affect Black and brown families in metro Atlanta — Holigenix\'s core service population.',
    certifications: [
      'Approved GAPP Medicaid Provider',
      '508(c)(1)(a) Faith-Based Nonprofit (IRS determination letter on file)',
      'Georgia DCH Licensed Home Health Agency',
      'Medicare certified',
      'SAM.gov registered — active (UEI: NNR7S596R4K9, CAGE: 9XZJ9)',
      'Veteran-Owned Small Business (VOSB) — SBA certified, originally entered 08/18/2024, valid through 02/18/2028; business claim resubmitted 04/08/2026 (App ID 86261)',
      'Service-Disabled Veteran-Owned Small Business (SDVOSB) — SBA certified, originally entered 08/18/2024, valid through 02/18/2028; business claim resubmitted 04/08/2026 (App ID 86261)',
      'WOSB — application in progress',
      '100% EVV compliance via HHAeXchange',
      'HIPAA compliant covered entity',
    ],
    technologyPlatform: 'CarePortal — proprietary EMR/operations platform (React/TypeScript/Supabase/Tailwind/Claude AI); features: digital nursing notes (20-section), DocuSign integration, Google OAuth, EVV dashboard, 14-document GAPP intake workflow; OnboardBot — automated staff/client onboarding (Railway/Node.js); CareOps AI Agent — 24/7 monitoring and compliance; HoligeAI — Anthropic Claude API embedded; n8n automation; GoHighLevel CRM/SMS; GAMMIS EDI integration (Gainwell Technologies enrollment in progress)',
    compliance: 'Full HIPAA compliance (covered healthcare entity); Georgia DCH GAPP regulatory framework; 100% EVV compliance via HHAeXchange; GCHEXS background check compliance; GAMMIS billing; Weekly Thursday payroll cycle; 14-document structured GAPP client intake; 20-section digital nursing notes; SOPs in development for all operational workflows',
    staff: 'Clinical: RNs (1099), LPNs at $35–40/hr (1099), PCAs (1099); Admin: Director of Nursing (Yinessa Davis-Cacapit RN BSN), Virtual Admin (Rio), Operations Lead (Rodney Williams)',
    employees: '~8 staff; 5 active GAPP pediatric clients (high medical complexity); established 2024; digital infrastructure built to scale to 50+ clients without additional admin overhead',
    currentImpact: '5 active medically fragile pediatric clients; 100% EVV compliance; credentialed staff across Cobb County and metro Atlanta; CarePortal platform in active development',
    pastPerformance: 'Approved GAPP Medicaid provider — active clinical operations serving medically complex pediatric patients in Cobb County, Georgia; 100% EVV compliance rate via HHAeXchange; Clinical care delivered by licensed RNs and LPNs under supervision of DON Yinessa Davis-Cacapit, RN, BSN; Conditions managed: seizure disorders, polypharmacy (Keppra/Valproic Acid/Diazepam), G-tube dependency, mobility impairment, infection control',
    outcomeTargets: 'Active pediatric clients: 5 → 20+ (2026); Credentialed field staff: 4–6 → 15+; EVV compliance: 100% maintained; Nursing documentation: manual → 95%+ digital; Families receiving caregiver education: limited → all active cases; Private-pay service line: launched Q3 2026; CarePortal: fully deployed in production',
    grantPurpose: 'Workforce development — RN/LPN/PCA recruitment, credentialing, training, retention incentives and caregiver pipeline programs; Technology — full CarePortal platform deployment, HIPAA cloud infrastructure, device provisioning for field staff; Capacity building — SOP development, compliance/audit preparation, quality assurance systems; Community outreach — family caregiver education, outreach to underserved pediatric populations in Cobb County and metro Atlanta, GAPP waiver enrollment navigation; Working capital during Medicaid reimbursement cycles',
    capitalNeeds: 'CarePortal full development and GAMMIS EDI integration; HIPAA-compliant data infrastructure; Clinical device provisioning (field nurses); Nursing workforce recruitment and credentialing; Working capital bridge during Medicaid billing cycles; Community outreach programming; SBIR/STTR health IT innovation track',
    grantPriorities: [
      'HRSA / MCHB Maternal & Child Health — pediatric health equity',
      '508(c)(1)(a) Faith-Based funders — Robert Wood Johnson, United Way Atlanta, Community Foundation Greater Atlanta, Kaiser Permanente, Blank Family Foundation',
      'SDVOSB federal set-asides — VOSB/SDVOSB certified valid through 02/18/2028',
      'Georgia DCH GAPP Provider Capacity Support',
      'CSBG Community Services Block Grant',
      'ONC / SBIR / STTR Health IT — CarePortal SaaS',
      'HCBS Waiver Development (CMS)',
      'GCDD Georgia Council on Developmental Disabilities',
      'WOSB programs (pipeline)',
      'Nursing workforce development grants',
    ],
    grantFocusAreas: 'HRSA Rural Health Outreach (pediatric access/workforce); CMS/MCHB Maternal & Child Health Grants; Georgia DCH GAPP Provider Capacity Support; CSBG Community Services Block Grant; HCBS Waiver Development Grants (CMS); Georgia DPH Community Health Grants; Atlanta Regional Commission Area Plan (disability services); GCDD Georgia Council on Developmental Disabilities; Robert Wood Johnson Foundation; United Way of Greater Atlanta; Community Foundation for Greater Atlanta; Kaiser Permanente Community Benefit; Blank Family Foundation; Faith-Based Health Funders (508(c)(1)(a) alignment); SDVOSB federal set-asides; WOSB programs (pending); ONC/SBIR Health IT (CarePortal); SAMHSA Medicaid waiver expansion; Children\'s Healthcare of Atlanta Foundation; Marcus Foundation; Nemours Foundation; Lucile Packard Foundation for Children\'s Health',
    growthPlan: 'Phase 1 (Current): Serve GAPP clients, build CarePortal, establish SOPs; Phase 2 (2026): Scale to 20+ clients, expand to NOW/COMP/SOURCE Georgia Medicaid waivers, launch private-pay, full CarePortal deployment; Phase 3 (2027+): Regional faith-based nonprofit pediatric home care model, CarePortal SaaS licensing, ACHC/CHAP accreditation',
    strategicPriorities: 'Complete GAMMIS EDI Trading Partner enrollment (highest billing priority); Scale GAPP census to 20+ active clients; Expand to NOW/COMP/SOURCE Medicaid waiver programs; Launch private-pay service line Q3 2026; Achieve WOSB federal certification; Build referral pipeline (hospital discharge planners, NICU social workers, estate planning attorneys, wealth advisors, MCO coordinators); Deploy CarePortal to full production; Pursue ACHC or CHAP accreditation',
    longTermGoals: 'ACHC/CHAP national accreditation; WOSB federal certification; SBIR/STTR for CarePortal health IT; Statewide Georgia GAPP expansion; NOW/COMP/SOURCE waiver expansion; CarePortal SaaS licensing to peer agencies; Regional faith-based nonprofit pediatric home care model',
    rules: [
      'NEVER include patient names or PHI',
      'Do NOT reference NEMT division (not yet launched)',
      'Do NOT reference Sunrise Pediatric demo environment',
      'Use official mission statement verbatim',
      'Lead with 508(c)(1)(a) for foundation grants',
      'Lead with SDVOSB for federal grants',
      'Lead with GAPP approval as state credibility anchor',
      'Feature CarePortal technology as health IT innovation differentiator',
      'Reference faith-based mission for community/foundation funders',
      'Include NPI 1770341067 and address in formal grant applications',
      'Cite VOSB/SDVOSB as active SBA certifications valid through February 2028 (UEI: NNR7S596R4K9)',
      'Enterprise healthcare brand voice — benchmark: Axxess, CharmHealth, Epic',
    ],
    naicsCodes: '621610 (Home Health Care Services), 621399 (Other Health Practitioners), 621111 (Offices of Physicians)',
    regions: 'Georgia',
    serviceArea: 'Cobb County, Georgia (primary); Metro Atlanta expansion; statewide Georgia target',
    emailTo: process.env.HOLIGENIX_EMAIL_TO || 'admin@holigenixhealthcare.com',
    driveFolderId: process.env.HOLIGENIX_DRIVE_FOLDER_ID,
  },
  {
    id: 'k1_management',
    label: 'K1 Management LLC / Garden State Motions LLC',
    name: 'K1 Management LLC',
    entityAlt: 'Garden State Motions LLC (NJ entity)',
    legalStructure: 'LLC',
    orgType: 'Minority-Owned Business',
    industry: 'Government Contracting / Construction / Facilities Management',
    regions: 'Pennsylvania, New Jersey, Delaware, Philadelphia Metro',
    serviceCounties: {
      pa: ['Berks','Bucks','Chester','Cumberland','Dauphin','Delaware','Lancaster','Lehigh','Luzerne','Montgomery','York'],
      nj: ['Atlantic','Burlington','Camden','Essex','Hudson','Mercer','Middlesex','Passaic','Somerset','Union'],
      de: ['New Castle','Kent'],
    },
    mission: 'K1 Management LLC is a certified minority-owned general contracting firm specializing in residential rehabilitation, facilities maintenance, janitorial services, landscaping, and specialty trade construction. We serve government agencies and municipalities while creating economic opportunity by helping small and minority-owned contractors become certified, bonded, and contract-ready through our contractor development program.',
    services: [
      'Residential rehabilitation (roofing, bathrooms, ramps, kitchens)',
      'Janitorial and commercial cleaning',
      'Landscaping and grounds maintenance',
      'Drywall, flooring, interior finishes',
      'Residential roofing',
      'Graphic and signage installation',
      'Government contractor development and certification consulting ($680 base + $500/cert)',
    ],
    certifications: [
      'MBE — Pennsylvania State',
      'SB — Pennsylvania',
      'SDB (Small Disadvantaged Business) — Pennsylvania (Verified)',
      'MWBE — New Jersey (Garden State Motions)',
      'SBE — New Jersey (Garden State Motions)',
      'HIC (Home Improvement Contractor) — Pennsylvania',
      'GC (General Contractor) — Pennsylvania',
      'COSTARS Approved Supplier — Pennsylvania (March 2026)',
      'Delaware OSD Certificate (December 2025)',
      'Delaware SBF Certificate (December 2025)',
      'SAM.gov registered — active (both entities)',
      'DBE — application in progress',
    ],
    bonding: '$500,000 bonding via CNA | General Liability active (Spinnaker + CNA, COI March 2026) | OSHA certified personnel on staff',
    naicsCodes: '236118, 236116, 238130, 238160, 238310, 238330, 561720, 561730, 323113, 399300',
    pastPerformance: [
      'Chester Upland School District — janitorial services 7+ schools Summer 2025 (reference letter on file)',
      'Graphic/signage installation — commercial December 2025 (50+ photos)',
      'Residential construction — Bateman project 2024',
    ],
    employees: 'Owner-operated with 30+ active subcontractors',
    yearsOp: 'K1 Management LLC — PA entity established; Garden State Motions LLC — NJ est. 2022',
    grantPurpose: 'Scale government contract volume tri-state simultaneously; build AI-powered bid automation platform; develop contractor readiness consulting ($680 base + $500/certification); expand bonding capacity beyond $500K; pursue COSTARS cooperative purchasing outreach; target Healthy Homes and residential rehabilitation as primary revenue driver.',
    capitalNeeds: 'Technology infrastructure for AI bid automation, working capital for multi-contract execution, bonding capacity expansion, subcontractor network development',
    grantPriorities: [
      'MBE/MWBE capacity building (certs in hand — need capital)',
      'PHFA Healthy Homes (PA residential rehab = core service)',
      'MBDA Business Center grants (minority contractor development)',
      'HUD Section 3 community development construction grants',
      'NJEDA MBE capacity building',
      'Small business AI/technology adoption grants',
      'COSTARS-aligned capacity building (just approved March 2026)',
      'Delaware OSD/SBF supplier development (just certified Dec 2025)',
      'SBA Community Advantage / 8(a) prep',
      'Contractor training and certification assistance',
    ],
    grantFocusAreas: 'Minority Business Enterprise development, Small business technology adoption, Workforce development and contractor training, Community development through housing rehabilitation, Women-owned business support, Government contracting access for underrepresented businesses',
    longTermGoals: 'WOSB federal certification, 8(a) program application, national MWBE certification, AI bid platform launch',
    emailTo: process.env.CLIENT_EMAIL_TO || 'tiffany@k1mlg.llc',
    driveFolderId: process.env.CLIENT_DRIVE_FOLDER_ID,
  },
  {
    id: 'owner_nonprofit',
    name: process.env.OWNER_NONPROFIT_NAME || 'Owner Nonprofit',
    legalStructure: 'Nonprofit',
    orgType: 'Nonprofit Organization',
    regions: 'Georgia',
    mission: process.env.OWNER_NONPROFIT_MISSION || '',
    grantPurpose: process.env.OWNER_NONPROFIT_PURPOSE || '',
    certifications: [],
    grantPriorities: [
      'Georgia nonprofit grants',
      'Community development',
      'Education grants',
      'Social services funding',
    ],
    naicsCodes: '',
    emailTo: process.env.OWNER_EMAIL_TO || '',
    driveFolderId: process.env.OWNER_DRIVE_FOLDER_ID,
  },
];

// ============================================
// SUPABASE HELPERS
// ============================================
async function supabaseGet(table, params = '') {
  if (!SUPABASE_URL || !SUPABASE_KEY) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
    });
    return await res.json();
  } catch (e) { console.error(`Supabase GET (${table}):`, e.message); return []; }
}

async function supabaseUpsert(table, data) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(data)
    });
  } catch (e) { console.error(`Supabase upsert (${table}):`, e.message); }
}

async function logActivity(agentId, action, detail, metadata = {}) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/agent_activity_log`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ agent_id: agentId, action, detail, metadata })
    });
  } catch (e) { console.error('logActivity error:', e.message); }
}

async function updateAgentStatus(agentId, status, summary) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  const now = new Date().toISOString();
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/agents?id=eq.${agentId}`, {
      method: 'PATCH',
      headers: {
        'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json', 'Prefer': 'return=minimal'
      },
      body: JSON.stringify({ status, last_run_at: now, last_result: { summary }, updated_at: now })
    });
  } catch (e) { console.error('updateAgentStatus error:', e.message); }
}

// ============================================
// CLAUDE HELPER (for Director direct reasoning)
// ============================================
async function askClaude(systemPrompt, userPrompt) {
  // Route through OpenRouter if available (primary), Anthropic as fallback
  if (OPENROUTER_API_KEY) {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://grantiq.app',
          'X-Title': 'GrantIQ',
        },
        body: JSON.stringify({
          model: 'anthropic/claude-sonnet-4-20250514',
          max_tokens: 4096,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        })
      });
      const data = await res.json();
      if (data.error) return `API error: ${data.error.message || JSON.stringify(data.error)}`;
      return data.choices?.[0]?.message?.content || '';
    } catch (e) {
      console.error('[OpenRouter] askClaude error, trying Anthropic fallback:', e.message);
      // Fall through to Anthropic
    }
  }

  // Anthropic direct fallback
  if (ANTHROPIC_KEY) {
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });
      const data = await res.json();
      if (data.error) return `API error: ${data.error.message || data.error.type}`;
      return data.content?.map(c => c.text || '').join('') || '';
    } catch (e) { return 'Error: ' + e.message; }
  }

  return 'Error: No LLM key configured. Set OPENROUTER_API_KEY or ANTHROPIC_KEY.';
}

// ============================================
// DIRECTOR BRIEFING GENERATOR
// ============================================
async function generateBriefing(orgId) {
  const org = ORGS.find(o => o.id === orgId) || ORGS[0];
  const today = new Date().toISOString().split('T')[0];

  const [grants, drafts, youtubeIntel, runs, agents] = await Promise.all([
    supabaseGet('grant_opportunities', `org_id=eq.${orgId}&order=match_score.desc&limit=20`),
    supabaseGet('application_drafts', `org_id=eq.${orgId}&order=created_at.desc&limit=10`),
    supabaseGet('youtube_intel', `org_id=eq.${orgId}&order=created_at.desc&limit=5`),
    supabaseGet('grant_runs', `org_id=eq.${orgId}&order=run_date.desc&limit=5`),
    supabaseGet('agents', 'order=id'),
  ]);

  const newGrants = Array.isArray(grants) ? grants.filter(g => g.status === 'new') : [];
  const activeGrants = Array.isArray(grants) ? grants.filter(g => !['expired', 'skipped', 'rejected'].includes(g.status)) : [];
  const topGrants = Array.isArray(grants) ? grants.slice(0, 5) : [];

  const directorSystem = `You are Director, the AI Grant Agency Director for GrantIQ. You command 6 sub-agents: Finder (discovery), Writer (applications), Analyst (eligibility), Tracker (deadlines), Monitor (alerts), Reporter (reports).

You are STRATEGIC. Every briefing synthesizes data from all agents and delivers one decisive command brief. You don't just report — you DECIDE what matters and COMMAND what happens next.

Output format for Telegram (use emojis, HIGH SIGNAL, max 30 lines):

--- GRANT AGENCY COMMAND BRIEF ---

📊 PIPELINE STATUS
- Active grants, new discoveries, drafts in progress

🔍 TOP OPPORTUNITIES (Finder)
- Top 5 grants by match score with amounts and deadlines

✍️ APPLICATION STATUS (Writer)
- Drafts available, grants ready for application

📋 ELIGIBILITY (Analyst)
- High-match grants, certification advantages to leverage

⏰ DEADLINES (Tracker)
- Urgent deadlines, approaching deadlines

📈 YOUTUBE INTEL (Finder)
- Key insights from video research

⚡ TODAY'S COMMANDS
- 3 specific actions ranked by funding impact
- Assign each to the right agent

🤖 AGENT FLEET STATUS

End with: "Reply: search | write | analyze | pipeline | monitor | report | brief [org]"

IMPORTANT RULES:
- NEVER include patient names or PHI (especially for Holigenix)
- Do NOT reference NEMT division for Holigenix
- Reference org-specific certifications when discussing competitive advantage
- Every recommendation must be actionable with a specific next step`;

  const directorPrompt = `Today: ${today}
Organization: ${org.name} (${org.id})
Type: ${org.orgType}
Region: ${org.regions}

CERTIFICATIONS:
${JSON.stringify(org.certifications || [])}

GRANT PRIORITIES:
${JSON.stringify(org.grantPriorities || [])}

GRANTS IN PIPELINE: ${Array.isArray(grants) ? grants.length : 0} total (${newGrants.length} new, ${activeGrants.length} active)
TOP GRANTS:
${JSON.stringify(topGrants.map(g => ({ name: g.name, funder: g.funder, amount: g.amount, deadline: g.deadline, score: g.match_score, status: g.status })))}

APPLICATION DRAFTS: ${Array.isArray(drafts) ? drafts.length : 0} available
YOUTUBE INTEL: ${Array.isArray(youtubeIntel) ? youtubeIntel.length : 0} videos analyzed
RECENT RUNS: ${Array.isArray(runs) ? runs.length : 0}

AGENT FLEET:
${(Array.isArray(agents) ? agents : []).map(a => `${a.name}: ${a.status} | Last run: ${a.last_run_at || 'never'}`).join('\n')}

COMPOSIO: ${COMPOSIO_API_KEY ? '✅ Connected' : '⚠️ Not configured'}

Generate the command briefing. Be decisive. Assign specific actions.`;

  return await askClaude(directorSystem, directorPrompt);
}

// ============================================
// FULL AGENT RUN — All orgs, all modules
// ============================================
async function runFullAgentCycle() {
  console.log('🚀 Starting full GrantIQ agent cycle...');
  const results = {};

  for (const org of ORGS) {
    console.log(`\n[${org.id.toUpperCase()}] Starting grant research cycle...`);
    try {
      // Step 1: Finder — discover grants
      console.log(`[${org.id}] Step 1: Finder searching for grants...`);
      await updateAgentStatus('finder', 'working', `Searching: ${org.name}`);
      const searchResult = await dispatchGrantSearch({
        orgId: org.id,
        orgName: org.name,
        orgType: org.orgType,
        regions: org.regions,
        certifications: JSON.stringify(org.certifications),
        grantPriorities: JSON.stringify(org.grantPriorities),
        naicsCodes: org.naicsCodes,
      });
      await updateAgentStatus('finder', 'idle', `Found grants for ${org.name}`);

      // Step 2: Analyst — score eligibility
      console.log(`[${org.id}] Step 2: Analyst scoring eligibility...`);
      await updateAgentStatus('analyst', 'working', `Analyzing: ${org.name}`);
      await dispatchEligibilityAnalysis({
        orgId: org.id,
        orgName: org.name,
        orgType: org.orgType,
        legalStructure: org.legalStructure,
        certifications: org.certifications,
        regions: org.regions,
        naicsCodes: org.naicsCodes,
      });
      await updateAgentStatus('analyst', 'idle', `Analysis complete for ${org.name}`);

      // Step 3: Writer — draft applications
      console.log(`[${org.id}] Step 3: Writer drafting applications...`);
      await updateAgentStatus('writer', 'working', `Writing for: ${org.name}`);
      await dispatchApplicationDrafts({
        orgId: org.id,
        orgName: org.name,
        orgType: org.orgType,
        mission: org.mission,
        certifications: JSON.stringify(org.certifications),
        pastPerformance: JSON.stringify(org.pastPerformance || []),
        count: 5,
      });
      await updateAgentStatus('writer', 'idle', `Drafts complete for ${org.name}`);

      // Step 4: Reporter — generate reports, send email, upload to Drive
      console.log(`[${org.id}] Step 4: Reporter generating daily report...`);
      await updateAgentStatus('reporter', 'working', `Reporting: ${org.name}`);
      const reportResult = await dispatchDailyReport({
        orgId: org.id,
        orgName: org.name,
        emailTo: org.emailTo,
        driveFolderId: org.driveFolderId,
        certifications: org.certifications,
      });
      await updateAgentStatus('reporter', 'idle', `Report delivered for ${org.name}`);

      results[org.id] = { status: 'success', grants: searchResult?.actions?.length || 0 };
      console.log(`[${org.id.toUpperCase()}] ✅ Cycle complete`);

    } catch (e) {
      console.error(`[${org.id.toUpperCase()}] ❌ Error:`, e.message);
      results[org.id] = { status: 'error', error: e.message };
    }
  }

  // Step 5: Tracker — check all deadlines
  console.log('\n[TRACKER] Checking deadlines across all orgs...');
  await updateAgentStatus('tracker', 'working', 'Deadline check');
  await dispatchDeadlineCheck({});
  await updateAgentStatus('tracker', 'idle', 'Deadline check complete');

  await logActivity('director', 'full_cycle', 'Full agent cycle completed', results);
  console.log('\n✅ Full GrantIQ agent cycle complete.');
  return results;
}

// ============================================
// TELEGRAM BOT
// ============================================
const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

let activeOrgId = 'holigenix_healthcare'; // Default org

function getActiveOrg() {
  return ORGS.find(o => o.id === activeOrgId) || ORGS[0];
}

bot.onText(/\/start/, (msg) => {
  ownerChatId = msg.chat.id;
  bot.sendMessage(msg.chat.id, `🏛️ GrantIQ is online.

I'm your AI Grant Agency Director — Director.
I command 10 specialist agents to find, write, and WIN grants.

═══ ORGANIZATIONS ═══
/org holigenix — Switch to Holigenix Healthcare
/org k1 — Switch to K1 Management
/org nonprofit — Switch to Owner Nonprofit

═══ DISCOVERY (Finder) ═══
/search — Full grant search
/youtube — YouTube grant video research
/pulse — Quick grant pulse

═══ ONE-CLICK APPLY (Applicator) ═══
/apply [grant name] — Full auto-apply package
/packages — View application packages
/budget [grant] — Generate detailed budget
/budgetquick [amount] — Quick budget estimate

═══ DOCUMENT VAULT ═══
/docs — Full document checklist
/docstatus — Quick vault status
/upload [doc_type] — Mark document as uploaded

═══ APPLICATIONS (Writer) ═══
/write — Draft application narratives
/ideas [grant] — Quick narrative angle ideas

═══ ELIGIBILITY (Analyst) ═══
/analyze — Run eligibility analysis
/eligible [grant] — Quick eligibility check

═══ PIPELINE (Tracker) ═══
/pipeline — Full pipeline review
/deadlines — Check upcoming deadlines
/status — Quick pipeline status

═══ MONITORING (Monitor) ═══
/monitor — Run monitoring scan
/alerts — View active alerts
/check — Check submitted statuses

═══ REPORTING (Reporter) ═══
/report — Daily grant report
/email — Send email report
/stats — Quick stats

═══ COMMAND ═══
/briefing — Full agency command brief
/run — Run full agent cycle (all orgs)
/fleet — Agent fleet status
/tools — Connected integrations

📋 Active org: ${getActiveOrg().name}
Daily briefings at 7am EST. Deadline alerts every 6 hours.`);
});

// ── ORG SWITCHING ──
bot.onText(/\/org(?:\s+(.+))?/i, async (msg, match) => {
  const target = match?.[1]?.trim()?.toLowerCase();
  if (!target || target === 'all') {
    let text = '🏛️ Organizations:\n\n';
    for (const org of ORGS) {
      const active = org.id === activeOrgId ? ' ← ACTIVE' : '';
      text += `• ${org.name}${active}\n  ID: ${org.id}\n  Type: ${org.orgType}\n  Certs: ${(org.certifications || []).length}\n\n`;
    }
    text += 'Switch: /org holigenix | /org k1 | /org nonprofit';
    bot.sendMessage(msg.chat.id, text);
    return;
  }

  const orgMap = { holigenix: 'holigenix_healthcare', k1: 'k1_management', nonprofit: 'owner_nonprofit' };
  const newOrgId = orgMap[target] || ORGS.find(o => o.id.includes(target) || o.name.toLowerCase().includes(target))?.id;

  if (newOrgId) {
    activeOrgId = newOrgId;
    const org = getActiveOrg();
    bot.sendMessage(msg.chat.id, `✅ Switched to: ${org.name}\nType: ${org.orgType}\nRegion: ${org.regions || 'N/A'}\nCertifications: ${(org.certifications || []).length}`);
  } else {
    bot.sendMessage(msg.chat.id, '❌ Unknown org. Try: /org holigenix | /org k1 | /org nonprofit');
  }
});

// ── BRIEFING ──
bot.onText(/\/briefing/, async (msg) => {
  ownerChatId = msg.chat.id;
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `⏳ Director is analyzing ${org.name}...`);
  await updateAgentStatus('director', 'working', 'Generating briefing');
  const briefing = await generateBriefing(org.id);
  bot.sendMessage(msg.chat.id, briefing, { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, briefing));
  await updateAgentStatus('director', 'idle', 'Briefing delivered');
  await logActivity('director', 'briefing', `Briefing generated for ${org.name}`);
});

bot.onText(/\/fleet/, async (msg) => {
  const agents = await supabaseGet('agents', 'order=id');
  let text = '🤖 Agent Fleet Status\n\n';
  const agentNames = { finder: '🔍 Finder', writer: '✍️ Writer', analyst: '📋 Analyst', tracker: '⏰ Tracker', monitor: '👁️ Monitor', reporter: '📊 Reporter' };
  for (const a of (Array.isArray(agents) ? agents : [])) {
    const icon = a.status === 'working' ? '🔄' : a.status === 'error' ? '🔴' : a.status === 'disabled' ? '⚫' : '🟢';
    const label = agentNames[a.name] || `🤖 ${a.name}`;
    text += `${icon} ${label}\n   ${a.status} | Last: ${a.last_run_at ? new Date(a.last_run_at).toLocaleString() : 'never'}\n\n`;
  }
  bot.sendMessage(msg.chat.id, text);
});

// ── FINDER ──
bot.onText(/\/search/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `🔍 Finder is searching for grants for ${org.name}...\nThis may take 2-3 minutes.`);
  await updateAgentStatus('finder', 'working', `Searching: ${org.name}`);
  try {
    const result = await dispatchGrantSearch({
      orgId: org.id, orgName: org.name, orgType: org.orgType,
      regions: org.regions, certifications: JSON.stringify(org.certifications),
      grantPriorities: JSON.stringify(org.grantPriorities), naicsCodes: org.naicsCodes,
    });
    bot.sendMessage(msg.chat.id, result.result || '✅ Grant search complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
    await updateAgentStatus('finder', 'idle', `Search complete: ${org.name}`);
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Finder error: ${e.message}`);
    await updateAgentStatus('finder', 'error', e.message);
  }
});

bot.onText(/\/youtube/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `📺 Finder is searching YouTube for ${org.name} grants...`);
  await updateAgentStatus('finder', 'working', `YouTube research: ${org.name}`);
  try {
    const result = await dispatchYouTubeResearch({
      orgId: org.id, orgName: org.name, orgType: org.orgType, regions: org.regions,
    });
    bot.sendMessage(msg.chat.id, result.result || '✅ YouTube research complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
    await updateAgentStatus('finder', 'idle', 'YouTube research complete');
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/pulse/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `📡 Quick grant pulse for ${org.name}...`);
  const result = await quickGrantPulse(org.id, org.orgType, org.regions);
  bot.sendMessage(msg.chat.id, result.result || 'No pulse data.');
});

// ── WRITER ──
bot.onText(/\/write/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `✍️ Writer is drafting applications for ${org.name}...\nThis may take 2-3 minutes.`);
  await updateAgentStatus('writer', 'working', `Writing for: ${org.name}`);
  try {
    const result = await dispatchApplicationDrafts({
      orgId: org.id, orgName: org.name, orgType: org.orgType,
      mission: org.mission, certifications: JSON.stringify(org.certifications),
      pastPerformance: JSON.stringify(org.pastPerformance || []), count: 5,
    });
    bot.sendMessage(msg.chat.id, result.result || '✅ Application drafts generated.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
    await updateAgentStatus('writer', 'idle', `Drafts complete: ${org.name}`);
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/ideas(?:\s+(.+))?/i, async (msg, match) => {
  const org = getActiveOrg();
  const grantName = match?.[1]?.trim() || 'general grant';
  bot.sendMessage(msg.chat.id, `✍️ Writer brainstorming narrative ideas for "${grantName}"...`);
  const result = await quickNarrativeIdeas(org.name, org.orgType, grantName);
  bot.sendMessage(msg.chat.id, result.result || 'No ideas generated.');
});

// ── ANALYST ──
bot.onText(/\/analyze/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `📋 Analyst is evaluating eligibility for ${org.name}...`);
  await updateAgentStatus('analyst', 'working', `Analyzing: ${org.name}`);
  try {
    const result = await dispatchEligibilityAnalysis({
      orgId: org.id, orgName: org.name, orgType: org.orgType,
      legalStructure: org.legalStructure, certifications: org.certifications,
      regions: org.regions, naicsCodes: org.naicsCodes,
    });
    bot.sendMessage(msg.chat.id, result.result || '✅ Eligibility analysis complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
    await updateAgentStatus('analyst', 'idle', `Analysis complete: ${org.name}`);
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/eligible(?:\s+(.+))?/i, async (msg, match) => {
  const org = getActiveOrg();
  const grantName = match?.[1]?.trim() || 'general grant';
  bot.sendMessage(msg.chat.id, `📋 Quick eligibility check for "${grantName}"...`);
  const result = await quickEligibilityCheck(org.name, org.orgType, (org.certifications || []).join(', '), grantName);
  bot.sendMessage(msg.chat.id, result.result || 'No result.');
});

// ── TRACKER ──
bot.onText(/\/pipeline/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `⏰ Tracker reviewing pipeline for ${org.name}...`);
  await updateAgentStatus('tracker', 'working', `Pipeline review: ${org.name}`);
  try {
    const result = await dispatchPipelineReview({ orgId: org.id, orgName: org.name });
    bot.sendMessage(msg.chat.id, result.result || '✅ Pipeline review complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
    await updateAgentStatus('tracker', 'idle', 'Pipeline review complete');
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/deadlines/, async (msg) => {
  bot.sendMessage(msg.chat.id, '⏰ Tracker checking deadlines across all orgs...');
  try {
    const result = await dispatchDeadlineCheck({});
    bot.sendMessage(msg.chat.id, result.result || '✅ Deadline check complete.');
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/status/, async (msg) => {
  const org = getActiveOrg();
  const result = await quickPipelineStatus(org.id);
  bot.sendMessage(msg.chat.id, result.result || 'No pipeline data.');
});

// ── MONITOR ──
bot.onText(/\/monitor/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `👁️ Monitor scanning for ${org.name}...`);
  await updateAgentStatus('monitor', 'working', `Monitoring: ${org.name}`);
  try {
    const result = await dispatchMonitoringScan({
      orgId: org.id, orgName: org.name, orgType: org.orgType,
      regions: org.regions, grantPriorities: JSON.stringify(org.grantPriorities),
    });
    bot.sendMessage(msg.chat.id, result.result || '✅ Monitoring scan complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
    await updateAgentStatus('monitor', 'idle', `Monitoring complete: ${org.name}`);
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/alerts/, async (msg) => {
  const result = await quickAlertSummary();
  bot.sendMessage(msg.chat.id, result.result || 'No active alerts.');
});

bot.onText(/\/check/, async (msg) => {
  bot.sendMessage(msg.chat.id, '👁️ Monitor checking submitted application statuses...');
  try {
    const result = await dispatchStatusCheck({});
    bot.sendMessage(msg.chat.id, result.result || '✅ Status check complete.');
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

// ── REPORTER ──
bot.onText(/\/report/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `📊 Reporter generating report for ${org.name}...`);
  await updateAgentStatus('reporter', 'working', `Reporting: ${org.name}`);
  try {
    const result = await dispatchDailyReport({
      orgId: org.id, orgName: org.name, emailTo: org.emailTo,
      driveFolderId: org.driveFolderId, certifications: org.certifications,
    });
    bot.sendMessage(msg.chat.id, result.result || '✅ Report generated.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
    await updateAgentStatus('reporter', 'idle', `Report delivered: ${org.name}`);
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/email/, async (msg) => {
  const org = getActiveOrg();
  if (!org.emailTo) { bot.sendMessage(msg.chat.id, `❌ No email configured for ${org.name}.`); return; }
  bot.sendMessage(msg.chat.id, `📧 Reporter sending email report to ${org.emailTo}...`);
  try {
    const result = await dispatchEmailReport({ orgId: org.id, orgName: org.name, emailTo: org.emailTo });
    bot.sendMessage(msg.chat.id, result.result || '✅ Email sent.');
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/drive/, async (msg) => {
  const org = getActiveOrg();
  if (!org.driveFolderId) { bot.sendMessage(msg.chat.id, `❌ No Drive folder configured for ${org.name}.`); return; }
  bot.sendMessage(msg.chat.id, `📁 Reporter uploading to Drive for ${org.name}...`);
  try {
    const result = await dispatchDriveUpload({ orgId: org.id, orgName: org.name, driveFolderId: org.driveFolderId });
    bot.sendMessage(msg.chat.id, result.result || '✅ Drive upload complete.');
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/stats/, async (msg) => {
  const org = getActiveOrg();
  const result = await quickStats(org.id);
  bot.sendMessage(msg.chat.id, result.result || 'No stats available.');
});

// ── FULL RUN ──
bot.onText(/\/run/, async (msg) => {
  ownerChatId = msg.chat.id;
  bot.sendMessage(msg.chat.id, '🚀 Starting full GrantIQ agent cycle for ALL organizations...\nThis may take 10-15 minutes.');
  try {
    const results = await runFullAgentCycle();
    let summary = '✅ Full agent cycle complete!\n\n';
    for (const [orgId, result] of Object.entries(results)) {
      const org = ORGS.find(o => o.id === orgId);
      summary += `${result.status === 'success' ? '✅' : '❌'} ${org?.name || orgId}: ${result.status}\n`;
    }
    bot.sendMessage(msg.chat.id, summary);
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ Full cycle error: ${e.message}`);
  }
});

// ── VAULT (Document Management) ──
bot.onText(/\/docs/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `📁 Vault checking documents for ${org.name}...`);
  try {
    const result = await dispatchVaultCheck({ orgId: org.id, orgName: org.name });
    bot.sendMessage(msg.chat.id, result.result || '✅ Vault check complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/docstatus/, async (msg) => {
  const org = getActiveOrg();
  const result = await quickVaultStatus(org.id);
  bot.sendMessage(msg.chat.id, result.result || 'No vault data.');
});

bot.onText(/\/upload(?:\s+(.+))?/i, async (msg, match) => {
  const org = getActiveOrg();
  const docType = match?.[1]?.trim();
  if (!docType) {
    bot.sendMessage(msg.chat.id, `📁 To mark a document as uploaded, use:\n/upload <doc_type>\n\nExample: /upload irs_determination\n\nUse /docs to see all required documents and their types.`);
    return;
  }
  // Mark document as uploaded in vault
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/document_vault?org_id=eq.${org.id}&doc_type=eq.${docType}`, {
      method: 'PATCH',
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
      body: JSON.stringify({ status: 'uploaded', uploaded_at: new Date().toISOString() })
    });
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      bot.sendMessage(msg.chat.id, `✅ Marked "${data[0].doc_name}" as uploaded for ${org.name}.`);
    } else {
      bot.sendMessage(msg.chat.id, `❌ Document type "${docType}" not found. Use /docs to see valid types.`);
    }
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

// ── BUDGETGEN (Budget Generator) ──
bot.onText(/\/budget(?:\s+(.+))?/i, async (msg, match) => {
  const org = getActiveOrg();
  const grantName = match?.[1]?.trim();
  bot.sendMessage(msg.chat.id, `💰 BudgetGen creating budget for ${org.name}${grantName ? ` — "${grantName}"` : ''}...\nThis may take 1-2 minutes.`);
  try {
    const result = await dispatchBudgetGeneration({
      orgId: org.id, orgName: org.name, grantName: grantName || 'General capacity building grant',
      grantAmount: '$50,000 - $250,000',
    });
    bot.sendMessage(msg.chat.id, result.result || '✅ Budget generated.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

bot.onText(/\/budgetquick(?:\s+(.+))?/i, async (msg, match) => {
  const org = getActiveOrg();
  const amount = match?.[1]?.trim() || '$100,000';
  const result = await quickBudgetEstimate(org.id, amount, 'workforce development and technology');
  bot.sendMessage(msg.chat.id, result.result || 'No estimate.');
});

// ── APPLICATOR (One-Click Apply) ──
bot.onText(/\/apply(?:\s+(.+))?/i, async (msg, match) => {
  const org = getActiveOrg();
  const grantName = match?.[1]?.trim();
  if (!grantName) {
    bot.sendMessage(msg.chat.id, `🚀 One-Click Apply — Usage:\n/apply <grant name>\n/apply HRSA Maternal Child Health\n\nI'll check your docs, generate narrative + budget, fill SF-424, and package the full application.`);
    return;
  }
  bot.sendMessage(msg.chat.id, `🚀 ONE-CLICK APPLY: "${grantName}" for ${org.name}\n\n⏳ Applicator is:\n1. Analyzing grant requirements\n2. Checking document vault\n3. Generating tailored narrative\n4. Creating budget\n5. Filling SF-424 data\n6. Packaging application\n\nThis may take 3-5 minutes...`);
  await updateAgentStatus('applicator', 'working', `Applying: ${grantName}`);
  try {
    const result = await dispatchOneClickApply({
      orgId: org.id, orgName: org.name, grantName,
      uei: org.uei, cage: org.cage, npi: org.npi,
      certifications: JSON.stringify(org.certifications),
    });
    bot.sendMessage(msg.chat.id, result.result || '✅ Application package ready.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
    await updateAgentStatus('applicator', 'idle', `Package ready: ${grantName}`);
  } catch (e) {
    bot.sendMessage(msg.chat.id, `❌ ${e.message}`);
    await updateAgentStatus('applicator', 'error', e.message);
  }
});

bot.onText(/\/packages/, async (msg) => {
  const org = getActiveOrg();
  bot.sendMessage(msg.chat.id, `📦 Checking application packages for ${org.name}...`);
  try {
    const result = await dispatchPackageCheck({ orgId: org.id, orgName: org.name });
    bot.sendMessage(msg.chat.id, result.result || '✅ Package check complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

// ── COMPOSIO TOOLS ──
bot.onText(/\/tools/, async (msg) => {
  const { getComposio } = require('./tools/composio-tools');
  const composio = getComposio();
  let text = '🔧 Integrations:\n\n';
  text += `✅ Claude (LLM)\n`;
  text += `${process.env.OPENROUTER_API_KEY ? '✅' : '⚠️'} OpenRouter (multi-model)\n`;
  text += `${process.env.PERPLEXITY_API_KEY ? '✅' : '⚠️'} Perplexity (web search)\n`;
  text += `${process.env.YOUTUBE_API_KEY ? '✅' : '⚠️'} YouTube Data API\n`;
  text += `${process.env.GOOGLE_SERVICE_ACCOUNT ? '✅' : '⚠️'} Google Drive\n`;
  text += `${process.env.EMAIL_USER ? '✅' : '⚠️'} Gmail\n`;
  text += `${composio ? '✅' : '⚠️'} Composio\n`;
  text += `✅ Supabase\n`;

  if (composio) {
    try {
      const connections = await composio.connectedAccounts.list({});
      for (const conn of (connections.items || [])) {
        text += `✅ ${conn.appName || conn.app?.name || 'Unknown'} (Composio)\n`;
      }
    } catch (e) { /* ignore */ }
  }

  text += `\nConnect more: /connect <app>`;
  bot.sendMessage(msg.chat.id, text);
});

bot.onText(/\/connect (.+)/i, async (msg, match) => {
  const { getComposio } = require('./tools/composio-tools');
  const appName = match[1].trim().toLowerCase();
  const composio = getComposio();
  if (!composio) { bot.sendMessage(msg.chat.id, '❌ Set COMPOSIO_API_KEY first.'); return; }
  bot.sendMessage(msg.chat.id, `🔗 Generating ${appName} connection...`);
  try {
    const entity = composio.getEntity('grantiq-bot');
    const connection = await entity.initiateConnection({ appName });
    bot.sendMessage(msg.chat.id, `✅ Click to connect ${appName}:\n\n${connection.redirectUrl}`);
  } catch (e) { bot.sendMessage(msg.chat.id, `❌ ${e.message}`); }
});

// ── NATURAL LANGUAGE — Director understands everything ──
bot.on('message', async (msg) => {
  if (msg.text?.startsWith('/')) return;
  if (!msg.text) return;

  ownerChatId = msg.chat.id;
  const org = getActiveOrg();
  const userMessage = msg.text.trim();

  bot.sendMessage(msg.chat.id, '🧠 Director is on it...');

  const routerResponse = await askClaude(
    `You are Director, the routing brain of GrantIQ — an AI grant research agency with 6 sub-agents.

Your job: read the user's message, decide what they want, and return a JSON action.

ACTIVE ORGANIZATION: ${org.name} (${org.id})

AGENTS YOU CAN DISPATCH:
- "finder" — grant search, discovery, YouTube research, "find grants", "search for funding", "what grants are available"
- "applicator" — ONE-CLICK APPLY, "apply for this grant", "submit application", "auto-apply", "apply for HRSA"
- "vault" — document vault, "what documents do I need", "check my docs", "what's missing", "upload status"
- "budgetgen" — budget generation, "create a budget", "how much should I budget", "budget for this grant"
- "writer" — write application narratives, drafts, "write an application", "draft a proposal"
- "analyst" — eligibility analysis, match scoring, "am I eligible", "check eligibility", "score this grant"
- "tracker" — pipeline review, deadline management, "what deadlines", "pipeline status", "track this grant"
- "monitor" — monitoring scan, status checks, alerts, "any new grants", "check for updates"
- "reporter" — reports, stats, email, "send me a report", "what are my stats"
- "briefing" — full agency briefing, "what's going on", "morning brief", "status update"
- "chat" — general conversation, grant strategy advice, anything that doesn't need an agent

RESPOND WITH ONLY valid JSON:
{
  "intent": "finder|applicator|vault|budgetgen|writer|analyst|tracker|monitor|reporter|briefing|chat",
  "confidence": 0.0-1.0,
  "orgOverride": "org_id or null (if user mentions a specific org)",
  "grantName": "specific grant name mentioned or null",
  "chatResponse": "If intent is chat, your helpful response here. Otherwise null."
}`,
    `User message: "${userMessage}"`
  );

  let action;
  try {
    const jsonStr = routerResponse.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
    action = JSON.parse(jsonStr);
  } catch {
    action = { intent: 'chat', chatResponse: routerResponse, confidence: 0.5 };
  }

  // Apply org override if specified
  if (action.orgOverride) {
    const orgMap = { holigenix: 'holigenix_healthcare', k1: 'k1_management', nonprofit: 'owner_nonprofit' };
    const overrideId = orgMap[action.orgOverride] || action.orgOverride;
    if (ORGS.find(o => o.id === overrideId)) activeOrgId = overrideId;
  }

  const activeOrg = getActiveOrg();
  console.log(`[DIRECTOR] Intent: ${action.intent} (${action.confidence}) — "${userMessage.substring(0, 50)}" — Org: ${activeOrg.id}`);

  try {
    switch (action.intent) {
      case 'finder': {
        bot.sendMessage(msg.chat.id, `🔍 Dispatching Finder for ${activeOrg.name}...`);
        await updateAgentStatus('finder', 'working', `Research: ${userMessage.substring(0, 50)}`);
        const result = await dispatchGrantSearch({
          orgId: activeOrg.id, orgName: activeOrg.name, orgType: activeOrg.orgType,
          regions: activeOrg.regions, certifications: JSON.stringify(activeOrg.certifications),
          grantPriorities: JSON.stringify(activeOrg.grantPriorities), naicsCodes: activeOrg.naicsCodes,
        });
        bot.sendMessage(msg.chat.id, result.result || '✅ Search complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
        await updateAgentStatus('finder', 'idle', 'Research delivered');
        break;
      }

      case 'applicator': {
        const applyGrant = action.grantName || userMessage.replace(/apply|for|to|the/gi, '').trim();
        bot.sendMessage(msg.chat.id, `🚀 ONE-CLICK APPLY: "${applyGrant}" for ${activeOrg.name}\n\n⏳ Analyzing requirements, checking docs, generating narrative + budget, packaging...`);
        await updateAgentStatus('applicator', 'working', `Applying: ${applyGrant}`);
        const result = await dispatchOneClickApply({
          orgId: activeOrg.id, orgName: activeOrg.name, grantName: applyGrant,
          uei: activeOrg.uei, cage: activeOrg.cage, npi: activeOrg.npi,
          certifications: JSON.stringify(activeOrg.certifications),
        });
        bot.sendMessage(msg.chat.id, result.result || '✅ Application package ready.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
        await updateAgentStatus('applicator', 'idle', 'Package ready');
        break;
      }

      case 'vault': {
        bot.sendMessage(msg.chat.id, `📁 Checking document vault for ${activeOrg.name}...`);
        const result = await dispatchVaultCheck({ orgId: activeOrg.id, orgName: activeOrg.name });
        bot.sendMessage(msg.chat.id, result.result || '✅ Vault check complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
        break;
      }

      case 'budgetgen': {
        const budgetGrant = action.grantName || 'capacity building grant';
        bot.sendMessage(msg.chat.id, `💰 Generating budget for ${activeOrg.name}...`);
        const result = await dispatchBudgetGeneration({
          orgId: activeOrg.id, orgName: activeOrg.name, grantName: budgetGrant,
        });
        bot.sendMessage(msg.chat.id, result.result || '✅ Budget generated.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
        break;
      }

      case 'writer': {
        bot.sendMessage(msg.chat.id, `✍️ Dispatching Writer for ${activeOrg.name}...`);
        await updateAgentStatus('writer', 'working', `Writing: ${userMessage.substring(0, 50)}`);
        const result = await dispatchApplicationDrafts({
          orgId: activeOrg.id, orgName: activeOrg.name, orgType: activeOrg.orgType,
          mission: activeOrg.mission, certifications: JSON.stringify(activeOrg.certifications),
          pastPerformance: JSON.stringify(activeOrg.pastPerformance || []),
          grantId: action.grantName, count: 5,
        });
        bot.sendMessage(msg.chat.id, result.result || '✅ Drafts generated.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
        await updateAgentStatus('writer', 'idle', 'Writing delivered');
        break;
      }

      case 'analyst': {
        bot.sendMessage(msg.chat.id, `📋 Dispatching Analyst for ${activeOrg.name}...`);
        await updateAgentStatus('analyst', 'working', `Analyzing eligibility`);
        const result = await dispatchEligibilityAnalysis({
          orgId: activeOrg.id, orgName: activeOrg.name, orgType: activeOrg.orgType,
          legalStructure: activeOrg.legalStructure, certifications: activeOrg.certifications,
          regions: activeOrg.regions, naicsCodes: activeOrg.naicsCodes,
        });
        bot.sendMessage(msg.chat.id, result.result || '✅ Analysis complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
        await updateAgentStatus('analyst', 'idle', 'Analysis delivered');
        break;
      }

      case 'tracker': {
        bot.sendMessage(msg.chat.id, `⏰ Dispatching Tracker for ${activeOrg.name}...`);
        await updateAgentStatus('tracker', 'working', `Pipeline review`);
        const result = await dispatchPipelineReview({ orgId: activeOrg.id, orgName: activeOrg.name });
        bot.sendMessage(msg.chat.id, result.result || '✅ Pipeline review complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
        await updateAgentStatus('tracker', 'idle', 'Pipeline delivered');
        break;
      }

      case 'monitor': {
        bot.sendMessage(msg.chat.id, `👁️ Dispatching Monitor for ${activeOrg.name}...`);
        await updateAgentStatus('monitor', 'working', `Monitoring scan`);
        const result = await dispatchMonitoringScan({
          orgId: activeOrg.id, orgName: activeOrg.name, orgType: activeOrg.orgType,
          regions: activeOrg.regions, grantPriorities: JSON.stringify(activeOrg.grantPriorities),
        });
        bot.sendMessage(msg.chat.id, result.result || '✅ Monitoring complete.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
        await updateAgentStatus('monitor', 'idle', 'Monitoring delivered');
        break;
      }

      case 'reporter': {
        bot.sendMessage(msg.chat.id, `📊 Dispatching Reporter for ${activeOrg.name}...`);
        await updateAgentStatus('reporter', 'working', `Generating report`);
        const result = await dispatchDailyReport({
          orgId: activeOrg.id, orgName: activeOrg.name, emailTo: activeOrg.emailTo,
          driveFolderId: activeOrg.driveFolderId, certifications: activeOrg.certifications,
        });
        bot.sendMessage(msg.chat.id, result.result || '✅ Report generated.', { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, result.result || 'Done'));
        await updateAgentStatus('reporter', 'idle', 'Report delivered');
        break;
      }

      case 'briefing': {
        bot.sendMessage(msg.chat.id, `⏳ Director is analyzing ${activeOrg.name}...`);
        await updateAgentStatus('director', 'working', 'Generating briefing');
        const briefing = await generateBriefing(activeOrg.id);
        bot.sendMessage(msg.chat.id, briefing, { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, briefing));
        await updateAgentStatus('director', 'idle', 'Briefing delivered');
        await logActivity('director', 'briefing', 'Briefing generated via natural language');
        break;
      }

      case 'chat':
      default: {
        if (action.chatResponse && action.chatResponse.length > 10) {
          bot.sendMessage(msg.chat.id, action.chatResponse);
        } else {
          const response = await askClaude(
            `You are Director, the AI Grant Agency Director for GrantIQ. You run an agency with 6 agents: Finder (discovery), Writer (applications), Analyst (eligibility), Tracker (deadlines), Monitor (alerts), Reporter (reports). You specialize in grants for healthcare nonprofits, minority-owned businesses, and government contractors. Answer with expert grant strategy knowledge. Be concise and actionable. Max 20 lines.`,
            `Org: ${activeOrg.name} (${activeOrg.orgType})\nUser: ${userMessage}`
          );
          bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(msg.chat.id, response));
        }
        break;
      }
    }

    await logActivity('director', 'dispatch', `Intent: ${action.intent} — "${userMessage.substring(0, 80)}"`, { intent: action.intent, confidence: action.confidence, org: activeOrg.id });

  } catch (e) {
    console.error('[DIRECTOR] Dispatch error:', e.message);
    bot.sendMessage(msg.chat.id, `❌ Something went wrong: ${e.message}\n\nTry again or use /fleet to check agent health.`);
  }
});

// ============================================
// CRON SCHEDULES
// ============================================

// Daily full agent cycle at 7:00am EST (12:00 UTC)
const cronSchedule = process.env.CRON_SCHEDULE || '0 12 * * *';
cron.schedule(cronSchedule, async () => {
  console.log('⏰ Daily grant research cycle triggered');
  try {
    const results = await runFullAgentCycle();

    // Send briefing to owner
    if (ownerChatId) {
      for (const org of ORGS) {
        try {
          const briefing = await generateBriefing(org.id);
          bot.sendMessage(ownerChatId, `📋 Daily Briefing — ${org.name}\n\n${briefing}`, { parse_mode: 'Markdown' }).catch(() => bot.sendMessage(ownerChatId, `📋 Daily Briefing — ${org.name}\n\n${briefing}`));
        } catch (e) { console.error(`Briefing error for ${org.id}:`, e.message); }
      }
    }

    await logActivity('director', 'scheduled_cycle', 'Daily 7am grant research cycle', results);
  } catch (e) { console.error('Daily cycle error:', e.message); }
});

// Deadline check every 6 hours
cron.schedule('0 */6 * * *', async () => {
  console.log('⏰ Deadline check triggered');
  try {
    const result = await dispatchDeadlineCheck({});

    // Alert owner of urgent deadlines
    if (ownerChatId && result.result) {
      const hasUrgent = result.result.toLowerCase().includes('urgent') || result.result.includes('🚨');
      if (hasUrgent) {
        bot.sendMessage(ownerChatId, `🚨 Deadline Alert\n\n${result.result}`, { parse_mode: 'Markdown' }).catch(() => {});
      }
    }

    await logActivity('tracker', 'scheduled_deadline', '6-hour deadline check');
  } catch (e) { console.error('Deadline check error:', e.message); }
});

// Monitoring scan twice daily at 10am and 4pm EST (15:00 and 21:00 UTC)
cron.schedule('0 15,21 * * *', async () => {
  console.log('⏰ Monitoring scan triggered');
  try {
    for (const org of ORGS) {
      await dispatchMonitoringScan({
        orgId: org.id, orgName: org.name, orgType: org.orgType,
        regions: org.regions, grantPriorities: JSON.stringify(org.grantPriorities),
      });
    }
    await logActivity('monitor', 'scheduled_scan', 'Monitoring scan complete');
  } catch (e) { console.error('Monitoring scan error:', e.message); }
});

// Weekly comprehensive report every Monday at 9am EST (14:00 UTC)
cron.schedule('0 14 * * 1', async () => {
  console.log('⏰ Weekly report triggered');
  try {
    for (const org of ORGS) {
      if (org.emailTo) {
        await dispatchEmailReport({ orgId: org.id, orgName: org.name, emailTo: org.emailTo });
      }
    }
    await logActivity('reporter', 'scheduled_weekly', 'Weekly Monday report');
  } catch (e) { console.error('Weekly report error:', e.message); }
});

// ============================================
// EXPRESS SERVER + API
// ============================================
const app = express();
const PORT = process.env.PORT || 3000;

// CORS
const VERCEL_DASHBOARD_URL = process.env.VERCEL_DASHBOARD_URL || '*';
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', VERCEL_DASHBOARD_URL);
  res.header('Access-Control-Allow-Headers', 'Content-Type, x-api-secret');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    service: 'grantiq-bot',
    status: 'online',
    version: '1.0.0',
    orgs: ORGS.map(o => ({ id: o.id, name: o.name, type: o.orgType })),
    agents: ['director', 'finder', 'writer', 'analyst', 'tracker', 'monitor', 'reporter'],
    telegram: !!TELEGRAM_TOKEN,
    claude: !!ANTHROPIC_KEY,
    composio: !!COMPOSIO_API_KEY,
    supabase: !!SUPABASE_URL,
    uptime: Math.floor(process.uptime()),
  });
});

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    schedule: cronSchedule,
    uptime: Math.floor(process.uptime()),
    orgs: ORGS.length,
    activeOrg: activeOrgId,
  });
});

app.get('/api/data', async (req, res) => {
  try {
    const [grants, drafts, runs, alerts] = await Promise.all([
      supabaseGet('grant_opportunities', 'order=match_score.desc&limit=100'),
      supabaseGet('application_drafts', 'order=created_at.desc&limit=50'),
      supabaseGet('grant_runs', 'order=run_date.desc&limit=30'),
      supabaseGet('deadline_alerts', 'order=created_at.desc&limit=20'),
    ]);
    res.json({
      grants: Array.isArray(grants) ? grants : [],
      drafts: Array.isArray(drafts) ? drafts : [],
      runs: Array.isArray(runs) ? runs : [],
      alerts: Array.isArray(alerts) ? alerts : [],
      orgs: ORGS.map(o => ({ id: o.id, name: o.name, type: o.orgType, certs: (o.certifications || []).length })),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/run', async (req, res) => {
  const secret = req.headers['x-api-secret'];
  if (RUN_SECRET && secret !== RUN_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }
  res.json({ status: 'started', message: 'Full agent cycle initiated' });
  runFullAgentCycle().catch(e => console.error('API run error:', e.message));
});

// ── ONE-CLICK APPLY API ──
app.post('/api/apply', async (req, res) => {
  const { grantName, orgId } = req.body;
  if (!grantName || !orgId) {
    return res.status(400).json({ error: 'Missing grantName or orgId' });
  }
  const org = ORGS.find(o => o.id === orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  res.json({ status: 'started', message: `Applicator started for "${grantName}"` });

  // Run async
  dispatchOneClickApply({
    orgId: org.id, orgName: org.name, grantName,
    uei: org.uei, cage: org.cage, npi: org.npi,
    certifications: JSON.stringify(org.certifications),
  }).then(result => {
    console.log(`[APPLICATOR] Package ready: ${grantName} for ${org.name}`);
    if (ownerChatId) {
      bot.sendMessage(ownerChatId, `🚀 Application package ready!\n\nGrant: ${grantName}\nOrg: ${org.name}\n\n${result.result?.substring(0, 500) || 'Package created.'}`, { parse_mode: 'Markdown' }).catch(() => {});
    }
  }).catch(e => console.error('[APPLICATOR] Error:', e.message));
});

// ── BUDGET GENERATION API ──
app.post('/api/budget', async (req, res) => {
  const { grantName, orgId, amount } = req.body;
  if (!orgId) return res.status(400).json({ error: 'Missing orgId' });
  const org = ORGS.find(o => o.id === orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  res.json({ status: 'started', message: `Budget generation started for "${grantName || 'general'}"` });
  dispatchBudgetGeneration({ orgId: org.id, orgName: org.name, grantName: grantName || 'General grant', grantAmount: amount || '$50,000 - $250,000' })
    .catch(e => console.error('[BUDGETGEN] Error:', e.message));
});

// ── GRANT SEARCH API ──
app.post('/api/search', async (req, res) => {
  const { orgId } = req.body;
  const org = ORGS.find(o => o.id === (orgId || 'holigenix_healthcare')) || ORGS[0];
  res.json({ status: 'started', message: `Grant search started for ${org.name}` });
  dispatchGrantSearch({
    orgId: org.id, orgName: org.name, orgType: org.orgType,
    regions: org.regions, certifications: JSON.stringify(org.certifications),
    grantPriorities: JSON.stringify(org.grantPriorities), naicsCodes: org.naicsCodes,
  }).catch(e => console.error('[FINDER] Error:', e.message));
});

app.listen(PORT, () => {
  console.log('');
  console.log('🏛️ GrantIQ Bot — AI Grant Research Agency');
  console.log('==========================================');
  console.log(`🧠 Director: Online (Claude Sonnet)`);
  console.log(`🔍 Finder: Ready (Perplexity + YouTube + Web)`);
  console.log(`✍️  Writer: Ready (Application Narratives)`);
  console.log(`📋 Analyst: Ready (Eligibility Scoring)`);
  console.log(`⏰ Tracker: Ready (Deadline Management)`);
  console.log(`👁️  Monitor: Ready (Grant Monitoring)`);
  console.log(`📊 Reporter: Ready (Reports + Email + Drive)`);
  console.log('');
  console.log(`📱 Telegram: ${TELEGRAM_TOKEN ? 'Connected' : '❌ Missing'}`);
  console.log(`🧠 Claude: ${ANTHROPIC_KEY ? 'Connected' : '❌ Missing'}`);
  console.log(`🔧 Composio: ${COMPOSIO_API_KEY ? 'Connected' : '⚠️ Not set'}`);
  console.log(`🔍 Perplexity: ${process.env.PERPLEXITY_API_KEY ? 'Connected' : '⚠️ Not set'}`);
  console.log(`📺 YouTube: ${process.env.YOUTUBE_API_KEY ? 'Connected' : '⚠️ Not set'}`);
  console.log(`📁 Google Drive: ${process.env.GOOGLE_SERVICE_ACCOUNT ? 'Connected' : '⚠️ Not set'}`);
  console.log('');
  console.log(`🏛️ Organizations: ${ORGS.map(o => o.name).join(' | ')}`);
  console.log(`⏰ Cron: Daily 7am EST, Deadlines q6h, Monitor 10am/4pm, Weekly Mon 9am`);
  console.log(`🚀 API: http://localhost:${PORT}`);
  console.log('');
});
