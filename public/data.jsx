// Mock data shaped like the real Supabase schema described in the PRD.
// Numbers and dates roughly mid-2026 so the prototype feels live.

const ORGS = [
  { id: "all",                  short: "All",       name: "All Orgs" },
  { id: "holigenix_healthcare", short: "Holigenix", name: "Holigenix Healthcare", certs: ["HHAeXchange", "EVV Compliant", "Medicaid"] },
  { id: "k1_management",        short: "K1 Mgmt",   name: "K1 Management",        certs: ["MBE-PA", "SDB-PA", "MWBE-NJ", "COSTARS", "DE OSD", "SAM.gov"] },
  { id: "owner_nonprofit",      short: "Owner NP",  name: "Owner Nonprofit",      certs: ["501(c)(3)", "GuideStar Gold"] },
];

const GRANTS = [
  { id: "g1",  name: "Delaware EDGE Grant — Late Stage", funder: "Delaware Division of Small Business",
    org_id: "k1_management", amount: "$100,000", deadline: "2026-05-12", match_score: 92, status: "drafting",
    docs_ready: 22, docs_total: 27, source: "DE OSD bulletin",
    description: "Matching grant for late-stage Delaware-based small businesses scaling operations. Requires audited financials, 2 years of tax returns, and a 12-month growth plan.",
    eligibility: ["Delaware HQ or operating subsidiary", "≤50 employees", "Audited financials"],
    advantage: "MBE-PA + DE OSD certifications stack — preferred scoring." },
  { id: "g2",  name: "HRSA Health Center Program — Service Area Competition", funder: "HRSA / HHS",
    org_id: "holigenix_healthcare", amount: "$650,000 / yr", deadline: "2026-05-19", match_score: 88, status: "drafting",
    docs_ready: 18, docs_total: 24, source: "Grants.gov daily",
    description: "Operating support for organizations delivering primary care to underserved populations. Holigenix's EVV compliance and HHAeXchange integration are direct evidence of service capacity.",
    eligibility: ["FQHC or look-alike", "Service area documented", "EVV compliance"],
    advantage: "100% EVV compliance is rare — flagged as a scoring differentiator." },
  { id: "g3",  name: "MBDA Capital Readiness Program", funder: "Minority Business Development Agency",
    org_id: "k1_management", amount: "$250,000", deadline: "2026-06-02", match_score: 86, status: "reviewing",
    docs_ready: 19, docs_total: 23, source: "MBDA cohort drop",
    description: "Capital-readiness technical assistance for minority-owned businesses preparing for Series-A or growth debt.",
    eligibility: ["MBE certified", "Revenue $250K–$10M", "≥2 years operating"],
    advantage: "MBE-PA + MWBE-NJ qualifies as multi-state minority enterprise." },
  { id: "g4",  name: "RWJF Pioneering Ideas Brief", funder: "Robert Wood Johnson Foundation",
    org_id: "owner_nonprofit", amount: "$50,000", deadline: "2026-05-30", match_score: 81, status: "new",
    docs_ready: 6, docs_total: 12, source: "RWJF bulletin",
    description: "Brief proposals for ideas that disrupt the status quo of health.",
    eligibility: ["501(c)(3)", "Brief 250-word concept"],
    advantage: "Low document burden — fast turnaround possible." },
  { id: "g5",  name: "PA DCED Manufacturing Innovation Grant", funder: "PA Dept. of Community & Economic Dev.",
    org_id: "k1_management", amount: "$75,000", deadline: "2026-06-15", match_score: 78, status: "new",
    docs_ready: 16, docs_total: 21, source: "PA DCED weekly",
    description: "Innovation matching grant for PA-based manufacturers. K1's PA presence + MBE certification stack scores well.",
    eligibility: ["PA manufacturer", "Innovation plan"],
    advantage: "MBE-PA gives 10-point bonus." },
  { id: "g6",  name: "NJ EDA Small Business Improvement Grant", funder: "New Jersey EDA",
    org_id: "k1_management", amount: "$50,000", deadline: "2026-07-01", match_score: 74, status: "new",
    docs_ready: 14, docs_total: 19, source: "NJ EDA portal",
    description: "Reimbursement for capital improvements at NJ business locations.",
    eligibility: ["NJ business address", "Improvements ≥$5K"],
    advantage: "MWBE-NJ priority window." },
  { id: "g7",  name: "Delaware Healthy Community Initiative", funder: "Delaware Division of Public Health",
    org_id: "holigenix_healthcare", amount: "$120,000", deadline: "2026-06-20", match_score: 71, status: "new",
    docs_ready: 11, docs_total: 18, source: "DE DPH bulletin",
    description: "Funds to expand home health services in underserved DE counties.",
    eligibility: ["DE service area", "EVV"],
    advantage: "EVV compliance scored separately." },
  { id: "g8",  name: "United Way of NJ Capacity Building", funder: "United Way of NJ",
    org_id: "owner_nonprofit", amount: "$25,000", deadline: "2026-07-08", match_score: 68, status: "new",
    docs_ready: 4, docs_total: 11, source: "UWNJ portal",
    description: "Operating support for NJ-based 501(c)(3)s.",
    eligibility: ["NJ 501(c)(3)"],
    advantage: "Low competition window." },
  { id: "g9",  name: "SBA Community Navigator Pilot", funder: "U.S. Small Business Administration",
    org_id: "k1_management", amount: "$200,000", deadline: "2026-08-01", match_score: 64, status: "new",
    docs_ready: 17, docs_total: 26, source: "SBA daily",
    description: "Pilot funds for community-based small-business support orgs.",
    eligibility: ["MBE/SDB", "Community navigator role"],
    advantage: "SDB-PA stacks with MBE." },
  { id: "g10", name: "VA Home Care Veteran Outreach", funder: "Veterans Affairs",
    org_id: "holigenix_healthcare", amount: "$300,000", deadline: "2026-04-28", match_score: 58, status: "rejected",
    docs_ready: 24, docs_total: 24, source: "VA bulletin",
    description: "Direct veteran home-health outreach contract.",
    eligibility: ["VA-accredited provider"],
    advantage: "—" },
  { id: "g11", name: "MBDA Federal Procurement Center", funder: "MBDA",
    org_id: "k1_management", amount: "$150,000", deadline: "2026-09-01", match_score: 82, status: "new",
    docs_ready: 19, docs_total: 23, source: "MBDA",
    description: "Technical assistance for MBE firms pursuing federal contracts.",
    eligibility: ["MBE", "Federal procurement track record optional"],
    advantage: "Stack-friendly for K1's existing certs." },
  { id: "g12", name: "PA Keystone Communities Grant", funder: "PA DCED",
    org_id: "owner_nonprofit", amount: "$60,000", deadline: "2026-07-22", match_score: 55, status: "new",
    docs_ready: 5, docs_total: 14, source: "PA DCED",
    description: "Small community development grants.",
    eligibility: ["501(c)(3)", "PA service area"],
    advantage: "—" },
];

const DRAFTS = [
  { id: "d1", grant_id: "g1", grant_name: "Delaware EDGE Grant — Late Stage", org_id: "k1_management",
    status: "ready_for_review", updated: "2026-05-04T18:42:00Z", word_count: 2840, sections: 6,
    summary: "Late-stage matching application for K1 Management. Emphasizes 32% YoY revenue growth, 12-person staff expansion plan, and DE/PA cross-state operations.",
    next: "Review narrative + budget, then queue Playwright submission." },
  { id: "d2", grant_id: "g2", grant_name: "HRSA Health Center Program — SAC", org_id: "holigenix_healthcare",
    status: "ready_for_review", updated: "2026-05-04T17:11:00Z", word_count: 5210, sections: 9,
    summary: "Service area competition narrative for Holigenix. Centers on 100% EVV compliance, HHAeXchange integration, and underserved-area patient volume.",
    next: "Validate budget against HRSA SF-424A, then submit." },
  { id: "d3", grant_id: "g3", grant_name: "MBDA Capital Readiness Program", org_id: "k1_management",
    status: "drafting", updated: "2026-05-04T15:50:00Z", word_count: 1620, sections: 4,
    summary: "Capital-readiness narrative in progress. Sections on growth plan and audited financials still pending.",
    next: "Agent will resume drafting at 19:00 EST." },
  { id: "d4", grant_id: "g11", grant_name: "MBDA Federal Procurement Center", org_id: "k1_management",
    status: "drafting", updated: "2026-05-04T14:02:00Z", word_count: 980, sections: 2,
    summary: "Procurement track record draft. Awaiting K1 past-performance docs.",
    next: "Blocked on missing past-performance summary." },
];

const SESSIONS = [
  { id: "s1", grant_id: "g1", url: "https://grants.delaware.gov/edge/apply", org_id: "k1_management",
    status: "gated", reason: "Signature gate — DocuSign envelope ready, awaiting Rodney's approval to send.",
    started: "2026-05-04T18:55:00Z", step: 14, total: 18, screenshots: 9,
    last_screenshot_label: "DocuSign envelope preview" },
  { id: "s2", grant_id: "g2", url: "https://grants.hrsa.gov/sac/apply", org_id: "holigenix_healthcare",
    status: "in_progress", reason: null,
    started: "2026-05-04T19:02:00Z", step: 7, total: 22, screenshots: 4,
    last_screenshot_label: "Filling SF-424A budget table" },
  { id: "s3", grant_id: "g6", url: "https://njeda.gov/sbig/portal", org_id: "k1_management",
    status: "completed", reason: null,
    started: "2026-05-03T14:00:00Z", step: 18, total: 18, screenshots: 12,
    last_screenshot_label: "Submission confirmation #NJSBIG-2026-04421" },
  { id: "s4", grant_id: "g10", url: "https://va.gov/grants/home-care", org_id: "holigenix_healthcare",
    status: "failed", reason: "Form changed structure — agent could not locate budget upload field.",
    started: "2026-05-02T11:30:00Z", step: 9, total: null, screenshots: 6,
    last_screenshot_label: "Unrecognized form layout" },
];

const ALERTS = [
  { id: "a1", severity: "high",   created: "2026-05-04T18:55:00Z", title: "Playwright gated on Delaware EDGE", body: "Signature gate reached — review the DocuSign envelope and approve to continue.", session_id: "s1" },
  { id: "a2", severity: "info",   created: "2026-05-04T18:42:00Z", title: "HRSA SAC draft ready", body: "Draft narrative + budget ready for Holigenix HRSA application.", draft_id: "d2" },
  { id: "a3", severity: "info",   created: "2026-05-04T07:00:00Z", title: "Daily discovery: 3 new K1 matches", body: "Avg 87% match. PA DCED Manufacturing, NJ EDA SBIG, MBDA Federal Procurement.", page: "pipeline" },
  { id: "a4", severity: "warn",   created: "2026-05-04T06:32:00Z", title: "EVV Compliance Report missing", body: "Required for 4 Holigenix grants. Last upload: Jan 2026.", page: "vault" },
  { id: "a5", severity: "info",   created: "2026-05-03T14:08:00Z", title: "NJ EDA SBIG submitted", body: "Confirmation #NJSBIG-2026-04421. Tracking saved.", session_id: "s3" },
];

const VAULT = [
  // Holigenix
  { id: "v1",  org_id: "holigenix_healthcare", required_for: "all",     doc_name: "Articles of Incorporation",            description: "DE Secretary of State filing", status: "uploaded", uploaded_at: "2026-01-12" },
  { id: "v2",  org_id: "holigenix_healthcare", required_for: "all",     doc_name: "EIN Verification Letter",              description: "IRS CP-575 or 147C",         status: "uploaded", uploaded_at: "2026-01-12" },
  { id: "v3",  org_id: "holigenix_healthcare", required_for: "all",     doc_name: "Bank Reference Letter",                description: "Letter from business bank confirming account standing",  status: "missing" },
  { id: "v4",  org_id: "holigenix_healthcare", required_for: "all",     doc_name: "Board of Directors / Leadership List", description: "Names, titles, affiliations",       status: "missing" },
  { id: "v5",  org_id: "holigenix_healthcare", required_for: "all",     doc_name: "CV — Yinessa Davis-Capacit, RN, BSN",  description: "Director of Nursing — credentials & experience",          status: "missing" },
  { id: "v6",  org_id: "holigenix_healthcare", required_for: "all",     doc_name: "CV — Rodney Williams",                 description: "Co-Founder, Operations & Strategy",        status: "missing" },
  { id: "v7",  org_id: "holigenix_healthcare", required_for: "federal", doc_name: "EVV Compliance Report (HHAeXchange)",  description: "100% EVV compliance evidence",     status: "missing", expires: "2026-12-31" },
  { id: "v8",  org_id: "holigenix_healthcare", required_for: "federal", doc_name: "990-N e-Postcard (3-year)",             description: "IRS Form 990 history",                       status: "uploaded", uploaded_at: "2026-02-04" },
  { id: "v9",  org_id: "holigenix_healthcare", required_for: "federal", doc_name: "Audited Financials FY24",              description: "Independent CPA audit",                      status: "uploaded", uploaded_at: "2026-03-19" },
  { id: "v10", org_id: "holigenix_healthcare", required_for: "state",   doc_name: "DE Home Health License",               description: "DE DPH active license",                      status: "uploaded", uploaded_at: "2026-01-22", expires: "2027-01-22" },
  { id: "v11", org_id: "holigenix_healthcare", required_for: "state",   doc_name: "PA HCBS Provider Agreement",           description: "PA Dept of Aging contract",                  status: "uploaded", uploaded_at: "2026-02-12" },
  { id: "v12", org_id: "holigenix_healthcare", required_for: "all",     doc_name: "Logo (vector + raster)",               description: "SVG, PNG @ 1x/2x, 1-line color rules",       status: "uploaded", uploaded_at: "2026-01-12" },
  // K1
  { id: "v13", org_id: "k1_management",        required_for: "all",     doc_name: "Articles of Incorporation",            description: "PA Department of State filing",     status: "uploaded", uploaded_at: "2026-01-08" },
  { id: "v14", org_id: "k1_management",        required_for: "all",     doc_name: "EIN Verification Letter",              description: "IRS CP-575 or 147C",                  status: "uploaded", uploaded_at: "2026-01-08" },
  { id: "v15", org_id: "k1_management",        required_for: "all",     doc_name: "MBE-PA Certification",                 description: "PA Bureau of Diversity, Inclusion",    status: "uploaded", uploaded_at: "2026-01-22", expires: "2027-01-22" },
  { id: "v16", org_id: "k1_management",        required_for: "all",     doc_name: "SDB-PA Certification",                 description: "Small Diverse Business — PA",          status: "uploaded", uploaded_at: "2026-01-22" },
  { id: "v17", org_id: "k1_management",        required_for: "all",     doc_name: "MWBE-NJ Certification",                description: "NJ Treasury",                                     status: "uploaded", uploaded_at: "2026-01-29" },
  { id: "v18", org_id: "k1_management",        required_for: "all",     doc_name: "COSTARS Approval",                     description: "PA cooperative purchasing program",                status: "uploaded", uploaded_at: "2026-02-05" },
  { id: "v19", org_id: "k1_management",        required_for: "federal", doc_name: "SAM.gov Active Registration",          description: "UEI active, expires 2026-11-30",                  status: "uploaded", uploaded_at: "2025-12-01", expires: "2026-11-30" },
  { id: "v20", org_id: "k1_management",        required_for: "federal", doc_name: "Audited Financials FY24",              description: "Independent CPA audit",                            status: "uploaded", uploaded_at: "2026-03-12" },
  { id: "v21", org_id: "k1_management",        required_for: "federal", doc_name: "Tax Returns (3-year)",                 description: "Federal 1120 returns 2022–2024",                   status: "uploaded", uploaded_at: "2026-03-12" },
  { id: "v22", org_id: "k1_management",        required_for: "federal", doc_name: "Past Performance Summary",             description: "Prior contract executions, references",            status: "missing" },
  { id: "v23", org_id: "k1_management",        required_for: "state",   doc_name: "DE OSD Certification",                 description: "Office of Supplier Diversity",                     status: "uploaded", uploaded_at: "2026-02-19" },
  { id: "v24", org_id: "k1_management",        required_for: "state",   doc_name: "PA Workers Comp Certificate",          description: "Active, expires 2026-09-30",                       status: "uploaded", uploaded_at: "2025-10-01", expires: "2026-09-30" },
  { id: "v25", org_id: "k1_management",        required_for: "state",   doc_name: "NJ Business Registration Cert.",       description: "Treasury BRC",                                     status: "uploaded", uploaded_at: "2026-01-29" },
  { id: "v26", org_id: "k1_management",        required_for: "all",     doc_name: "CV — Rodney Williams",                 description: "Operations Lead",                                  status: "missing" },
  { id: "v27", org_id: "k1_management",        required_for: "all",     doc_name: "Capability Statement",                 description: "1-page capabilities + NAICS codes",                status: "uploaded", uploaded_at: "2026-02-26" },
  // Owner Nonprofit (sparser)
  { id: "v28", org_id: "owner_nonprofit",      required_for: "all",     doc_name: "501(c)(3) Determination Letter",       description: "IRS exempt status",                                status: "uploaded", uploaded_at: "2026-01-15" },
  { id: "v29", org_id: "owner_nonprofit",      required_for: "all",     doc_name: "Form 990 (latest)",                    description: "Most recent filing",                               status: "uploaded", uploaded_at: "2026-02-20" },
  { id: "v30", org_id: "owner_nonprofit",      required_for: "all",     doc_name: "Board Roster",                         description: "Names, terms, affiliations",                       status: "missing" },
  { id: "v31", org_id: "owner_nonprofit",      required_for: "all",     doc_name: "Mission Statement",                    description: "Approved by board",                                status: "missing" },
  { id: "v32", org_id: "owner_nonprofit",      required_for: "all",     doc_name: "Audited Financials FY24",              description: "Independent CPA audit",                            status: "missing" },
];

const NOTES = [
  { id: "n1", agent: "grants",     tag: "scoring",     confidence: 0.92, created: "2026-05-03T22:14:00Z",
    text: "Delaware EDGE applications score MBE-PA + DE OSD as a 12-point combined bonus when both are listed in the cover letter, vs 8 points when only DE OSD appears. Always lead with the stack." },
  { id: "n2", agent: "grants",     tag: "narrative",   confidence: 0.87, created: "2026-05-02T19:00:00Z",
    text: "HRSA SAC reviewers respond more favorably to specific patient-volume numbers tied to underserved ZIP codes than to generic 'underserved population' language. Pull the EVV log for last 12 mo." },
  { id: "n3", agent: "playwright", tag: "form-quirk",  confidence: 0.95, created: "2026-05-04T15:00:00Z",
    text: "DE EDGE portal silently fails the 'Save Draft' button if the budget total field has commas. Strip commas before keying." },
  { id: "n4", agent: "grants",     tag: "eligibility", confidence: 0.78, created: "2026-04-30T11:20:00Z",
    text: "RWJF Pioneering Ideas Briefs over 250 words are auto-rejected by the intake bot before human review. Hard cap at 248." },
  { id: "n5", agent: "playwright", tag: "form-quirk",  confidence: 0.91, created: "2026-04-28T16:00:00Z",
    text: "NJ EDA SBIG portal requires Chrome — FF triggers a redirect loop on the OIDC handoff. Always use Chromium." },
  { id: "n6", agent: "grants",     tag: "deadline",    confidence: 0.83, created: "2026-04-25T09:00:00Z",
    text: "PA DCED rolling grants close 5pm ET on the listed date — not midnight. Submit by 3pm to leave room for resume retries." },
];

const CHAT_HISTORY = [
  { id: "c1", role: "user",      text: "What's our best shot for K1 closing this month?" },
  { id: "c2", role: "assistant", text: "Two strong candidates for K1 closing in the next 3 weeks:",
    blocks: [
      { kind: "tool",   tool: "search_grants", args: { org: "k1_management", deadline: "≤30d" }, result: "Returned 4 grants, top 2 below." },
      { kind: "markdown", body: "**1. Delaware EDGE Grant — Late Stage** · 92% match · due **May 12** (8 days)\nDocs: 22/27 ready. Missing: Past Performance Summary, Bank Reference Letter, 2 CVs.\n\n**2. MBDA Capital Readiness** · 86% match · due **June 2** (29 days)\nDocs: 19/23 ready. Missing: Past Performance Summary, audited cap-table, 2 attestations.\n\nBoth need the same Past Performance Summary — uploading that unblocks both." },
    ] },
  { id: "c3", role: "user",      text: "Start the EDGE draft and queue Playwright to begin filling once I review." },
  { id: "c4", role: "assistant", text: "On it. Drafting now.",
    blocks: [
      { kind: "tool", tool: "create_draft",     args: { grant_id: "g1" }, result: "draft_id: d1 created" },
      { kind: "tool", tool: "queue_playwright", args: { grant_id: "g1", gate_on: ["signature","submit"] }, result: "session_id: s1 queued, will gate on signature." },
      { kind: "markdown", body: "Draft will be ready in ~6 min. I'll alert you when it lands in your Inbox. Playwright session is queued — it'll gate before signing." },
    ] },
];

const AGENT_ACTIVITY = [
  { id: "act1", t: "2026-05-04T19:02:00Z", agent: "playwright", text: "Filling SF-424A budget table on HRSA SAC", session_id: "s2" },
  { id: "act2", t: "2026-05-04T18:55:00Z", agent: "playwright", text: "Reached signature gate on DE EDGE", session_id: "s1" },
  { id: "act3", t: "2026-05-04T18:42:00Z", agent: "grants",     text: "Finalized HRSA SAC narrative draft (5,210 words)" },
  { id: "act4", t: "2026-05-04T18:30:00Z", agent: "grants",     text: "Pulled past 12 mo EVV logs from HHAeXchange" },
  { id: "act5", t: "2026-05-04T07:00:00Z", agent: "grants",     text: "Daily discovery cron — 3 K1 matches, 1 Holigenix, 0 Owner NP" },
];

// ─────────────────────────────────────────────────────────────────
// Per-grant requirement checklists (doc + eligibility + narrative)
// Each row references either a vault doc id (links readiness) or is a
// grant-specific requirement (one-off, e.g., "12-month growth plan").
const REQUIREMENTS = [
  // g1 — DE EDGE — K1
  { id: "r1-1",  grant_id: "g1", kind: "doc",       label: "Articles of Incorporation", vault_id: "v13", required: true },
  { id: "r1-2",  grant_id: "g1", kind: "doc",       label: "EIN Verification",          vault_id: "v14", required: true },
  { id: "r1-3",  grant_id: "g1", kind: "doc",       label: "Audited Financials FY24",   vault_id: "v20", required: true },
  { id: "r1-4",  grant_id: "g1", kind: "doc",       label: "Tax Returns 3-yr",          vault_id: "v21", required: true },
  { id: "r1-5",  grant_id: "g1", kind: "doc",       label: "Past Performance Summary",  vault_id: "v22", required: true },
  { id: "r1-6",  grant_id: "g1", kind: "doc",       label: "Bank Reference Letter",     vault_id: null,  required: true, missing_reason: "Not in vault — pending bank request" },
  { id: "r1-7",  grant_id: "g1", kind: "doc",       label: "MBE-PA Cert",               vault_id: "v15", required: false, scoring_bonus: "+8 pts" },
  { id: "r1-8",  grant_id: "g1", kind: "doc",       label: "DE OSD Cert",               vault_id: "v23", required: false, scoring_bonus: "+8 pts (stacks with MBE)" },
  { id: "r1-9",  grant_id: "g1", kind: "eligible",  label: "Delaware HQ or operating subsidiary", status: "met",      detail: "DE OSD reg. confirms" },
  { id: "r1-10", grant_id: "g1", kind: "eligible",  label: "≤50 employees",                       status: "met",      detail: "Headcount: 12" },
  { id: "r1-11", grant_id: "g1", kind: "eligible",  label: "Revenue ≥$500K prior FY",             status: "met",      detail: "FY24: $2.1M" },
  { id: "r1-12", grant_id: "g1", kind: "narrative", label: "Executive Summary",                   status: "drafted",  word_target: 500 },
  { id: "r1-13", grant_id: "g1", kind: "narrative", label: "12-month Growth Plan",                status: "drafted",  word_target: 1500 },
  { id: "r1-14", grant_id: "g1", kind: "narrative", label: "Use of Funds",                        status: "drafted",  word_target: 600 },
  { id: "r1-15", grant_id: "g1", kind: "narrative", label: "Impact Metrics",                      status: "pending",  word_target: 400 },
  { id: "r1-16", grant_id: "g1", kind: "form",      label: "DE EDGE Application Form",            status: "pending",  detail: "Playwright will fill" },
  { id: "r1-17", grant_id: "g1", kind: "form",      label: "Budget Worksheet (Excel)",            status: "drafted",  detail: "Generated from template" },
  { id: "r1-18", grant_id: "g1", kind: "signature", label: "Authorized Officer Signature",        status: "pending",  detail: "DocuSign queued" },

  // g2 — HRSA SAC — Holigenix
  { id: "r2-1",  grant_id: "g2", kind: "doc", label: "Articles of Incorporation",            vault_id: "v1",  required: true },
  { id: "r2-2",  grant_id: "g2", kind: "doc", label: "EIN Verification",                     vault_id: "v2",  required: true },
  { id: "r2-3",  grant_id: "g2", kind: "doc", label: "EVV Compliance Report (HHAeXchange)",  vault_id: "v7",  required: true },
  { id: "r2-4",  grant_id: "g2", kind: "doc", label: "990-N e-Postcard 3-yr",                vault_id: "v8",  required: true },
  { id: "r2-5",  grant_id: "g2", kind: "doc", label: "Audited Financials FY24",              vault_id: "v9",  required: true },
  { id: "r2-6",  grant_id: "g2", kind: "doc", label: "DE Home Health License",               vault_id: "v10", required: true },
  { id: "r2-7",  grant_id: "g2", kind: "doc", label: "PA HCBS Provider Agreement",           vault_id: "v11", required: true },
  { id: "r2-8",  grant_id: "g2", kind: "doc", label: "Board of Directors / Leadership List", vault_id: "v4",  required: true },
  { id: "r2-9",  grant_id: "g2", kind: "doc", label: "CV — Yinessa Davis-Capacit, RN",       vault_id: "v5",  required: true },
  { id: "r2-10", grant_id: "g2", kind: "doc", label: "CV — Rodney Williams",                 vault_id: "v6",  required: true },
  { id: "r2-11", grant_id: "g2", kind: "eligible",  label: "FQHC or look-alike",            status: "partial", detail: "Look-alike pending — flagged" },
  { id: "r2-12", grant_id: "g2", kind: "eligible",  label: "Service area documented",       status: "met",     detail: "DE counties + PA HCBS zones" },
  { id: "r2-13", grant_id: "g2", kind: "eligible",  label: "EVV compliance",                status: "met",     detail: "100% — scoring differentiator" },
  { id: "r2-14", grant_id: "g2", kind: "narrative", label: "Need Statement",                status: "drafted", word_target: 1500 },
  { id: "r2-15", grant_id: "g2", kind: "narrative", label: "Service Area Definition",       status: "drafted", word_target: 800 },
  { id: "r2-16", grant_id: "g2", kind: "narrative", label: "Patient Volume Projections",    status: "drafted", word_target: 1200 },
  { id: "r2-17", grant_id: "g2", kind: "narrative", label: "Staffing & Operations Plan",    status: "drafted", word_target: 900 },
  { id: "r2-18", grant_id: "g2", kind: "narrative", label: "Sustainability Plan",           status: "pending", word_target: 600 },
  { id: "r2-19", grant_id: "g2", kind: "form",      label: "SF-424 Application",            status: "drafted" },
  { id: "r2-20", grant_id: "g2", kind: "form",      label: "SF-424A Budget",                status: "in_progress" },
  { id: "r2-21", grant_id: "g2", kind: "form",      label: "SF-LLL Disclosure of Lobbying", status: "drafted" },
  { id: "r2-22", grant_id: "g2", kind: "signature", label: "Authorized Officer",            status: "pending" },

  // g3 — MBDA Capital Readiness — K1 (sparse for prototype)
  { id: "r3-1",  grant_id: "g3", kind: "doc", label: "MBE-PA Cert",          vault_id: "v15", required: true },
  { id: "r3-2",  grant_id: "g3", kind: "doc", label: "MWBE-NJ Cert",         vault_id: "v17", required: true },
  { id: "r3-3",  grant_id: "g3", kind: "doc", label: "Audited Financials",  vault_id: "v20", required: true },
  { id: "r3-4",  grant_id: "g3", kind: "doc", label: "Past Performance Summary", vault_id: "v22", required: true },
  { id: "r3-5",  grant_id: "g3", kind: "eligible", label: "MBE certified", status: "met" },
  { id: "r3-6",  grant_id: "g3", kind: "eligible", label: "Revenue $250K–$10M", status: "met" },
];

// ─────────────────────────────────────────────────────────────────
// Discovery sources — feeds being scraped/monitored
const SOURCES = [
  { id: "src1",  name: "Grants.gov daily feed",   type: "Federal portal",   coverage: "All federal opportunities", last_run: "2026-05-04T07:00:00Z", health: "ok",       items_24h: 142, kept: 4,  org_relevance: ["holigenix_healthcare","k1_management","owner_nonprofit"], cron: "0 7 * * *" },
  { id: "src2",  name: "SAM.gov contracts",       type: "Federal portal",   coverage: "Federal contracts UEI-gated", last_run: "2026-05-04T07:00:00Z", health: "ok",       items_24h: 38,  kept: 1,  org_relevance: ["k1_management"], cron: "0 7 * * *" },
  { id: "src3",  name: "HRSA bulletin",            type: "Agency RSS",       coverage: "Health-services grants",      last_run: "2026-05-04T07:01:00Z", health: "ok",       items_24h: 4,   kept: 1,  org_relevance: ["holigenix_healthcare"], cron: "0 7 * * *" },
  { id: "src4",  name: "MBDA cohort drops",        type: "Agency",           coverage: "Minority business cohorts",   last_run: "2026-05-04T07:02:00Z", health: "ok",       items_24h: 2,   kept: 2,  org_relevance: ["k1_management"], cron: "0 7 * * *" },
  { id: "src5",  name: "PA DCED weekly",           type: "State portal",     coverage: "PA economic development",     last_run: "2026-05-03T09:00:00Z", health: "ok",       items_24h: 6,   kept: 1,  org_relevance: ["k1_management","owner_nonprofit"], cron: "0 9 * * 1" },
  { id: "src6",  name: "DE OSD bulletin",          type: "State portal",     coverage: "Delaware supplier diversity", last_run: "2026-05-04T07:05:00Z", health: "ok",       items_24h: 1,   kept: 1,  org_relevance: ["k1_management","holigenix_healthcare"], cron: "0 7 * * *" },
  { id: "src7",  name: "DE DPH bulletin",          type: "State portal",     coverage: "Delaware public health",      last_run: "2026-05-04T07:05:00Z", health: "ok",       items_24h: 1,   kept: 1,  org_relevance: ["holigenix_healthcare"], cron: "0 7 * * *" },
  { id: "src8",  name: "NJ EDA portal",            type: "State portal",     coverage: "NJ economic development",     last_run: "2026-05-04T07:05:00Z", health: "ok",       items_24h: 3,   kept: 1,  org_relevance: ["k1_management"], cron: "0 7 * * *" },
  { id: "src9",  name: "Candid Foundation Directory", type: "Subscription", coverage: "100K+ private foundations",   last_run: "2026-05-04T07:10:00Z", health: "ok",       items_24h: 22,  kept: 3,  org_relevance: ["owner_nonprofit","holigenix_healthcare"], cron: "0 7 * * *" },
  { id: "src10", name: "RWJF bulletin",            type: "Foundation",       coverage: "Robert Wood Johnson",         last_run: "2026-05-04T07:11:00Z", health: "ok",       items_24h: 1,   kept: 1,  org_relevance: ["owner_nonprofit"], cron: "0 7 * * *" },
  { id: "src11", name: "VA grant bulletin",        type: "Agency",           coverage: "Veterans Affairs grants",     last_run: "2026-05-04T07:11:00Z", health: "ok",       items_24h: 3,   kept: 0,  org_relevance: ["holigenix_healthcare"], cron: "0 7 * * *" },
  { id: "src12", name: "United Way NJ portal",     type: "Foundation",       coverage: "UWNJ funding opportunities",  last_run: "2026-05-02T07:00:00Z", health: "stale",    items_24h: 0,   kept: 0,  org_relevance: ["owner_nonprofit"], cron: "0 7 * * 5" },
  { id: "src13", name: "HelloSkip API",            type: "Aggregator",       coverage: "Curated grant database",      last_run: "2026-05-04T07:12:00Z", health: "ok",       items_24h: 18,  kept: 2,  org_relevance: ["all"], cron: "0 7 * * *" },
  { id: "src14", name: "SBA daily",                type: "Agency",           coverage: "Small Business Admin",        last_run: "2026-05-04T07:12:00Z", health: "ok",       items_24h: 8,   kept: 1,  org_relevance: ["k1_management","owner_nonprofit"], cron: "0 7 * * *" },
  { id: "src15", name: "Instrumentl-style scrape", type: "Custom",           coverage: "Foundation 990 scrape",        last_run: "2026-05-04T03:00:00Z", health: "warn",     items_24h: 0,   kept: 0,  org_relevance: ["all"], cron: "0 3 * * *", note: "Auth captcha on last run — needs review" },
];

// ─────────────────────────────────────────────────────────────────
// Saved searches / watchlists
const WATCHLISTS = [
  { id: "w1", name: "Texas Medicaid HCBS",          org_id: "holigenix_healthcare", query: "medicaid hcbs texas home health", new_24h: 0, total_lifetime: 3,  active: true },
  { id: "w2", name: "PA/NJ/DE minority biz $50–250K", org_id: "k1_management",      query: "MBE OR MWBE 50000..250000 (PA OR NJ OR DE)", new_24h: 2, total_lifetime: 17, active: true },
  { id: "w3", name: "Foundation health innovation",  org_id: "owner_nonprofit",     query: "health innovation foundation 501c3 brief", new_24h: 1, total_lifetime: 9, active: true },
  { id: "w4", name: "Federal procurement set-asides", org_id: "k1_management",     query: "federal SDB 8a set-aside contract", new_24h: 0, total_lifetime: 24, active: true },
  { id: "w5", name: "Capital readiness cohorts",      org_id: "k1_management",     query: "capital readiness cohort accelerator MBE", new_24h: 0, total_lifetime: 4, active: false },
];

// ─────────────────────────────────────────────────────────────────
// Dismissed / passed grants (with reasons so agents don't resurface)
const DISMISSED = [
  { id: "x1", name: "USDA Rural Business Dev Grant",       funder: "USDA",          org_id: "k1_management",        amount: "$50,000", dismissed_at: "2026-04-28", reason: "Not in eligible rural ZIP", dismissed_by: "rodney" },
  { id: "x2", name: "NIH SBIR Phase I — Digital Health",   funder: "NIH",            org_id: "holigenix_healthcare", amount: "$300,000", dismissed_at: "2026-04-26", reason: "Requires R&D track record we don't have", dismissed_by: "agent" },
  { id: "x3", name: "Kresge Foundation Arts Initiative",   funder: "Kresge",         org_id: "owner_nonprofit",      amount: "$75,000", dismissed_at: "2026-04-22", reason: "Mission misalignment — arts focus", dismissed_by: "agent" },
  { id: "x4", name: "DOL Workforce Innovation Fund",       funder: "DOL",            org_id: "k1_management",        amount: "$500,000", dismissed_at: "2026-04-18", reason: "Requires consortium partner — none lined up", dismissed_by: "rodney" },
  { id: "x5", name: "NSF Convergence Accelerator",         funder: "NSF",            org_id: "owner_nonprofit",      amount: "$750,000", dismissed_at: "2026-04-15", reason: "Research-org track only", dismissed_by: "agent" },
  { id: "x6", name: "VA Adaptive Sports Grant",            funder: "VA",             org_id: "holigenix_healthcare", amount: "$30,000", dismissed_at: "2026-04-10", reason: "Activity scope outside home-health", dismissed_by: "agent" },
];

// ─────────────────────────────────────────────────────────────────
// Funders (relationship tracking)
const FUNDERS = [
  { id: "f1", name: "Delaware Division of Small Business",      type: "State agency", contact: "Tasha Reynolds (Program Officer)",   email: "tasha.reynolds@delaware.gov",         relationship: "active",  last_touch: "2026-04-21", grants_applied: 2, grants_awarded: 1, total_awarded: "$75,000", next_cycle: "2026-09-01" },
  { id: "f2", name: "HRSA / HHS",                                type: "Federal",       contact: "—",                                  email: "—",                                   relationship: "warm",    last_touch: "2026-03-12", grants_applied: 1, grants_awarded: 0, total_awarded: "$0",      next_cycle: "2026-05-19" },
  { id: "f3", name: "Minority Business Development Agency",      type: "Federal",       contact: "Marcus Chen (Outreach)",             email: "mchen@mbda.gov",                      relationship: "warm",    last_touch: "2026-04-02", grants_applied: 2, grants_awarded: 1, total_awarded: "$120,000", next_cycle: "2026-06-02" },
  { id: "f4", name: "Robert Wood Johnson Foundation",            type: "Foundation",    contact: "—",                                  email: "—",                                   relationship: "cold",    last_touch: null,         grants_applied: 0, grants_awarded: 0, total_awarded: "$0",      next_cycle: "2026-05-30" },
  { id: "f5", name: "PA Dept. of Community & Economic Dev.",     type: "State agency", contact: "Linda Park",                          email: "lpark@pa.gov",                        relationship: "active",  last_touch: "2026-04-30", grants_applied: 4, grants_awarded: 2, total_awarded: "$185,000", next_cycle: "2026-06-15" },
  { id: "f6", name: "New Jersey EDA",                            type: "State agency", contact: "James O'Neil",                        email: "joneil@njeda.com",                    relationship: "active",  last_touch: "2026-05-03", grants_applied: 3, grants_awarded: 2, total_awarded: "$95,000", next_cycle: "2026-07-01" },
  { id: "f7", name: "Delaware Division of Public Health",        type: "State agency", contact: "—",                                  email: "—",                                   relationship: "warm",    last_touch: "2026-02-08", grants_applied: 1, grants_awarded: 0, total_awarded: "$0",      next_cycle: "2026-06-20" },
  { id: "f8", name: "United Way of NJ",                          type: "Foundation",    contact: "Patricia Liu",                       email: "pliu@uwnj.org",                       relationship: "warm",    last_touch: "2026-03-22", grants_applied: 1, grants_awarded: 1, total_awarded: "$15,000", next_cycle: "2026-07-08" },
  { id: "f9", name: "U.S. Small Business Administration",        type: "Federal",       contact: "—",                                  email: "—",                                   relationship: "cold",    last_touch: null,         grants_applied: 0, grants_awarded: 0, total_awarded: "$0",      next_cycle: "2026-08-01" },
  { id: "f10", name: "Veterans Affairs",                         type: "Federal",       contact: "—",                                  email: "—",                                   relationship: "cold",    last_touch: "2026-02-14", grants_applied: 1, grants_awarded: 0, total_awarded: "$0",      next_cycle: null },
];

// ─────────────────────────────────────────────────────────────────
// Submissions history (with outcome)
const SUBMISSIONS = [
  { id: "sub1", grant_name: "NJ EDA SBIG — Capital Improvement", funder_id: "f6", org_id: "k1_management",       amount_requested: "$50,000",  amount_awarded: "$50,000",  status: "awarded",      submitted: "2026-05-03", decided: "2026-05-04", confirmation: "NJSBIG-2026-04421", agent_hours: 4.2, agent_cost: "$28" },
  { id: "sub2", grant_name: "PA DCED Innovation Grant FY25",     funder_id: "f5", org_id: "k1_management",       amount_requested: "$60,000",  amount_awarded: "$45,000",  status: "awarded",      submitted: "2026-02-14", decided: "2026-04-08", confirmation: "PADCED-2025-1138",   agent_hours: 6.8, agent_cost: "$41" },
  { id: "sub3", grant_name: "MBDA Federal Procurement Pilot",    funder_id: "f3", org_id: "k1_management",       amount_requested: "$120,000", amount_awarded: "$120,000", status: "awarded",      submitted: "2025-11-20", decided: "2026-01-15", confirmation: "MBDA-FPC-2025-088",  agent_hours: 9.4, agent_cost: "$67" },
  { id: "sub4", grant_name: "DE EDGE Grant — Early Stage",       funder_id: "f1", org_id: "k1_management",       amount_requested: "$75,000",  amount_awarded: "$75,000",  status: "awarded",      submitted: "2025-09-12", decided: "2025-10-30", confirmation: "DE-EDGE-2025-0341",  agent_hours: 5.1, agent_cost: "$32" },
  { id: "sub5", grant_name: "United Way NJ Capacity Building",   funder_id: "f8", org_id: "owner_nonprofit",     amount_requested: "$20,000",  amount_awarded: "$15,000",  status: "awarded",      submitted: "2026-01-09", decided: "2026-03-22", confirmation: "UWNJ-2026-077",     agent_hours: 3.4, agent_cost: "$22" },
  { id: "sub6", grant_name: "HRSA Behavioral Health Integration", funder_id: "f2", org_id: "holigenix_healthcare", amount_requested: "$420,000", amount_awarded: "$0", status: "declined",     submitted: "2026-01-22", decided: "2026-03-12", confirmation: "—",                  agent_hours: 8.6, agent_cost: "$58", reviewer_notes: "Service area overlap with existing FQHC — re-scope and re-apply." },
  { id: "sub7", grant_name: "VA Home Care Veteran Outreach",     funder_id: "f10", org_id: "holigenix_healthcare", amount_requested: "$300,000", amount_awarded: "$0", status: "declined",     submitted: "2026-02-14", decided: "2026-04-22", confirmation: "—",                  agent_hours: 7.1, agent_cost: "$48", reviewer_notes: "Insufficient veteran-specific outreach plan." },
  { id: "sub8", grant_name: "PA Keystone Communities (FY24)",    funder_id: "f5", org_id: "owner_nonprofit",     amount_requested: "$50,000",  amount_awarded: "$0", status: "declined",     submitted: "2025-08-04", decided: "2025-11-08", confirmation: "—",                  agent_hours: 4.0, agent_cost: "$26", reviewer_notes: "Project scope too broad — narrow to 1 service area." },
  { id: "sub9", grant_name: "MBDA Cohort 2025 — Spring",         funder_id: "f3", org_id: "k1_management",       amount_requested: "$80,000",  amount_awarded: "$0", status: "declined",     submitted: "2025-04-02", decided: "2025-06-12", confirmation: "—",                  agent_hours: 5.6, agent_cost: "$36" },
];

// ─────────────────────────────────────────────────────────────────
// Audit trail — per-grant log of all events
const AUDIT_LOG = [
  // g1 DE EDGE
  { id: "log-1",  grant_id: "g1", t: "2026-04-29T07:00:00Z", actor: "agent:grants",     action: "discovered", detail: "Source: DE OSD bulletin — match 92%" },
  { id: "log-2",  grant_id: "g1", t: "2026-04-29T07:02:00Z", actor: "agent:grants",     action: "scored",     detail: "Match 92% — MBE-PA + DE OSD stack" },
  { id: "log-3",  grant_id: "g1", t: "2026-04-30T09:14:00Z", actor: "rodney",           action: "approved",   detail: "Marked for drafting" },
  { id: "log-4",  grant_id: "g1", t: "2026-04-30T09:30:00Z", actor: "agent:grants",     action: "draft_started", detail: "Created draft d1" },
  { id: "log-5",  grant_id: "g1", t: "2026-05-01T11:42:00Z", actor: "agent:grants",     action: "section_drafted", detail: "Executive Summary (487 words)" },
  { id: "log-6",  grant_id: "g1", t: "2026-05-02T14:08:00Z", actor: "agent:grants",     action: "section_drafted", detail: "12-Month Growth Plan (1,520 words)" },
  { id: "log-7",  grant_id: "g1", t: "2026-05-03T16:30:00Z", actor: "rodney",           action: "edited",     detail: "Revised growth plan section 3" },
  { id: "log-8",  grant_id: "g1", t: "2026-05-04T18:42:00Z", actor: "agent:grants",     action: "draft_ready", detail: "All sections complete — flagged for review" },
  { id: "log-9",  grant_id: "g1", t: "2026-05-04T18:55:00Z", actor: "agent:playwright", action: "session_started", detail: "Session s1 → grants.delaware.gov/edge/apply" },
  { id: "log-10", grant_id: "g1", t: "2026-05-04T19:05:00Z", actor: "agent:playwright", action: "gated",      detail: "Signature gate — DocuSign envelope ready" },
  // g2 HRSA
  { id: "log-11", grant_id: "g2", t: "2026-04-25T07:01:00Z", actor: "agent:grants",     action: "discovered", detail: "Source: Grants.gov — match 88%" },
  { id: "log-12", grant_id: "g2", t: "2026-04-26T10:00:00Z", actor: "rodney",           action: "approved",   detail: "Marked for drafting" },
  { id: "log-13", grant_id: "g2", t: "2026-04-27T12:00:00Z", actor: "agent:grants",     action: "draft_started" },
  { id: "log-14", grant_id: "g2", t: "2026-05-04T18:30:00Z", actor: "agent:grants",     action: "tool_call",  detail: "Pulled 12-mo EVV log from HHAeXchange" },
  { id: "log-15", grant_id: "g2", t: "2026-05-04T18:42:00Z", actor: "agent:grants",     action: "draft_ready", detail: "Narrative complete — flagged for review" },
];

// ─────────────────────────────────────────────────────────────────
// Reusable narrative templates
const TEMPLATES = [
  { id: "t1", name: "Holigenix Mission Statement (3-sentence)",   org_id: "holigenix_healthcare", category: "mission",        word_count: 64,  uses: 9, last_used: "2026-05-04", body: "Holigenix Healthcare delivers EVV-compliant home health services to underserved communities across Delaware, Pennsylvania, and New Jersey. Our integrated HHAeXchange platform achieves 100% EVV compliance — a documented differentiator in CMS quality scoring. We expand access to dignified, in-home care for Medicaid-eligible populations." },
  { id: "t2", name: "K1 Capability Statement (1-page)",            org_id: "k1_management",        category: "capabilities",   word_count: 320, uses: 14, last_used: "2026-05-03", body: "K1 Management is a multi-state minority-owned operations and strategy firm…" },
  { id: "t3", name: "Holigenix Service Area Definition (DE+PA)",   org_id: "holigenix_healthcare", category: "service-area",   word_count: 480, uses: 6,  last_used: "2026-05-04", body: "Holigenix's primary service area covers New Castle and Kent counties in Delaware…" },
  { id: "t4", name: "K1 Past Performance — Top 3",                 org_id: "k1_management",        category: "past-performance", word_count: 720, uses: 11, last_used: "2026-04-30", body: "Over the past 24 months, K1 Management has delivered…" },
  { id: "t5", name: "Holigenix EVV Compliance Story (with metrics)", org_id: "holigenix_healthcare", category: "differentiator", word_count: 540, uses: 5,  last_used: "2026-05-04", body: "100% EVV compliance is rare among home-health providers in our service area…" },
  { id: "t6", name: "Owner NP Mission + Theory of Change",         org_id: "owner_nonprofit",      category: "mission",        word_count: 280, uses: 4,  last_used: "2026-04-15", body: "Owner Nonprofit advances community health equity by…" },
  { id: "t7", name: "MBE/SDB Stack Cover Letter",                  org_id: "k1_management",        category: "cover-letter",   word_count: 220, uses: 8,  last_used: "2026-05-01", body: "Dear [Reviewer], K1 Management is certified as MBE-PA, SDB-PA, MWBE-NJ…" },
  { id: "t8", name: "Holigenix Patient Volume Methodology",        org_id: "holigenix_healthcare", category: "methodology",    word_count: 410, uses: 3,  last_used: "2026-04-22", body: "Patient volume projections are derived from actual EVV log data over the past 12 months…" },
];

// Org-level metadata for owner / assignment
const ORG_TEAM = {
  holigenix_healthcare: [
    { id: "u1", name: "Rodney Williams",        role: "Owner / Operations" },
    { id: "u2", name: "Yinessa Davis-Capacit",  role: "Director of Nursing" },
    { id: "u_agent", name: "Grants Agent",      role: "AI agent" },
  ],
  k1_management: [
    { id: "u1", name: "Rodney Williams",        role: "Owner / Operations" },
    { id: "u_agent", name: "Grants Agent",      role: "AI agent" },
  ],
  owner_nonprofit: [
    { id: "u1", name: "Rodney Williams",        role: "Owner" },
    { id: "u_agent", name: "Grants Agent",      role: "AI agent" },
  ],
};

// Per-grant ownership/cost (overlaid on GRANTS at lookup time)
const GRANT_META = {
  g1:  { assignee: "u_agent", agent_hours: 6.8, agent_cost: "$42" },
  g2:  { assignee: "u_agent", agent_hours: 11.2, agent_cost: "$74" },
  g3:  { assignee: "u_agent", agent_hours: 3.1,  agent_cost: "$19" },
  g4:  { assignee: "u1",      agent_hours: 0.4,  agent_cost: "$3"  },
  g5:  { assignee: "u_agent", agent_hours: 1.8,  agent_cost: "$12" },
  g6:  { assignee: "u_agent", agent_hours: 0.8,  agent_cost: "$5"  },
  g7:  { assignee: "u_agent", agent_hours: 0.6,  agent_cost: "$4"  },
  g8:  { assignee: "u1",      agent_hours: 0.3,  agent_cost: "$2"  },
  g9:  { assignee: "u_agent", agent_hours: 0.5,  agent_cost: "$3"  },
  g10: { assignee: "u_agent", agent_hours: 7.1,  agent_cost: "$48" },
  g11: { assignee: "u_agent", agent_hours: 2.4,  agent_cost: "$15" },
  g12: { assignee: "u1",      agent_hours: 0.2,  agent_cost: "$1"  },
};

window.MOCK = { ORGS, GRANTS, DRAFTS, SESSIONS, ALERTS, VAULT, NOTES, CHAT_HISTORY, AGENT_ACTIVITY,
                REQUIREMENTS, SOURCES, WATCHLISTS, DISMISSED, FUNDERS, SUBMISSIONS, AUDIT_LOG, TEMPLATES, ORG_TEAM, GRANT_META };
