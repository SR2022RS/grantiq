// =============================================================================
// Document catalog — maps (org_id, doc_type) → on-disk Markdown template +
// classifies each known document type by how it gets resolved.
// =============================================================================
// Templates live as files under workspace/templates/<org_id>/<doc_type>.md
// to keep them readable, version-controlled, and editable in any text editor.
//
// template_kind:
//   'draftable'      — agent generates a starter from the on-disk template
//   'request'        — external authority issues; agent provides a request email template
//   'gather'         — exists somewhere (cabinet, drive); agent provides a hint
//   'external_auth'  — third-party verification (SAM.gov, NPI registry — login required)

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '..', '..', 'workspace', 'templates');

// Known doc-type metadata. Maps the doc_type used in document_vault to:
// - template_kind
// - title (human-readable)
// - For 'draftable': nothing more — template lives at workspace/templates/<org>/<doc_type>.md
// - For 'request': request_to (who issues), request_template (email body)
// - For 'gather': gather_hint (where to find)
export const DOC_TYPE_METADATA = {
  // ─── DRAFTABLE — agent serves the on-disk Markdown template ──────────────
  board_list: {
    template_kind: 'draftable',
    title: 'Board of Directors / Leadership List',
  },
  cv_operations_lead: {
    template_kind: 'draftable',
    title: 'CV — Operations Lead',
  },
  cv_clinical_director: {
    template_kind: 'draftable',
    title: 'CV — Clinical Director',
  },
  org_chart: {
    template_kind: 'draftable',
    title: 'Organizational Chart',
  },
  w9: {
    template_kind: 'draftable',
    title: 'W-9 Tax Form (preparation sheet)',
  },
  letter_of_support_community: {
    template_kind: 'draftable',
    title: 'Letter of Support — Community Partner',
    aliases: ['letter_of_support_2'],
  },
  letter_of_support_government: {
    template_kind: 'draftable',
    title: 'Letter of Support — Government / MCO',
    aliases: ['letter_of_support_3'],
  },
  letter_of_support_physician: {
    template_kind: 'draftable',
    title: 'Letter of Support — Physician / Referral Partner',
    aliases: ['letter_of_support_1'],
  },
  capability_statement: {
    template_kind: 'draftable',
    title: 'Capability Statement (1-page)',
  },

  // ─── REQUEST — external authority issues; we generate a request email ────
  irs_determination: {
    template_kind: 'request',
    title: 'IRS 508(c)(1)(a) Determination Letter',
    request_to: 'IRS',
    request_template: `Subject: Request for 508(c)(1)(a) determination letter — {{ORG_NAME}} (EIN {{EIN}})

To Whom It May Concern,

{{ORG_NAME}} (EIN: {{EIN}}, organized under IRC Section 508(c)(1)(a)) is preparing federal grant applications and requires a copy of our determination letter.

Please send a current copy by mail to:
{{ADDRESS}}

Or by email to: {{EMAIL}}

Sincerely,
{{OPERATIONS_LEAD_NAME}}
{{OPERATIONS_LEAD_TITLE}}, {{ORG_NAME}}
`,
  },
  medicare_cert: {
    template_kind: 'request',
    title: 'Medicare Certification',
    request_to: 'CMS / Medicare Administrative Contractor',
    request_template: `Subject: Request for Medicare certification documentation — {{ORG_NAME}}

To Whom It May Concern,

{{ORG_NAME}} requires a copy of our Medicare certification documentation for grant application purposes.

Provider details:
- NPI: {{NPI}}
- EIN: {{EIN}}
- Address: {{ADDRESS}}

Please advise if you can provide a verification letter or certification confirmation.

Sincerely,
{{OPERATIONS_LEAD_NAME}}
{{ORG_NAME}}
`,
  },
  sdvosb_cert: {
    template_kind: 'request',
    title: 'SDVOSB Certification Letter',
    request_to: 'SBA / VetCert (https://veterans.certify.sba.gov)',
    request_template: `Log into https://veterans.certify.sba.gov with the {{ORG_NAME}} account credentials.

Navigate to: My Certifications → Active Certifications → SDVOSB → Download Letter

Verification details:
- UEI: {{UEI}}
- CAGE: {{CAGE}}
- App ID: 86261, valid through 02/18/2028

Save as PDF, upload to GrantIQ.
`,
  },
  vosb_cert: {
    template_kind: 'request',
    title: 'VOSB Certification Letter',
    request_to: 'SBA / VetCert (https://veterans.certify.sba.gov)',
    request_template: `Log into https://veterans.certify.sba.gov with the {{ORG_NAME}} account credentials.

Navigate to: My Certifications → Active Certifications → VOSB → Download Letter

Verification details:
- UEI: {{UEI}}
- CAGE: {{CAGE}}
- App ID: 86261, valid through 02/18/2028

Save as PDF, upload to GrantIQ.
`,
  },
  financial_statements: {
    template_kind: 'request',
    title: 'Financial Statements (P&L + Balance Sheet)',
    request_to: 'Accountant / Bookkeeper',
    request_template: `Subject: Request — Most recent fiscal year P&L + Balance Sheet for grant applications

Hi [ACCOUNTANT NAME],

I need our most recent fiscal year financial statements for grant applications:
- Profit & Loss Statement
- Balance Sheet

If you can pull from QuickBooks (or wherever our books currently live), can you send the PDFs by [DATE — give 1-2 days]? No DIY substitute is grant-credible.

Format: PDF, signed if possible.

Thanks,
{{OPERATIONS_LEAD_NAME}}
{{ORG_NAME}}
`,
  },
  bank_reference: {
    template_kind: 'request',
    title: 'Bank Reference Letter',
    request_to: 'Business Banker',
    request_template: `Subject: Request for bank reference letter — {{ORG_NAME}}

Hi [BANKER NAME],

I'm preparing grant applications and need a bank reference letter confirming our account standing and relationship with [BANK NAME].

Standard format covers:
- Account opened: [DATE]
- Account in good standing
- Average balance range or general account activity
- Length of relationship

If you can produce on bank letterhead and email signed PDF to {{EMAIL}} by [DATE — give 1-2 days], I'd appreciate it.

Thanks,
{{OPERATIONS_LEAD_NAME}}
{{ORG_NAME}}
`,
  },
  indirect_cost_rate: {
    template_kind: 'request',
    title: 'Indirect Cost Rate Agreement',
    request_to: 'Federal Cognizant Agency or De Minimis Rate',
    request_template: `Two options for federal grant applications:

OPTION 1 — De minimis rate (10% MTDC):
If we have not negotiated an indirect cost rate, we declare the de minimis 10% modified total direct cost (MTDC) rate per 2 CFR 200. No external negotiation needed. For a small startup, this is almost always the right call.

OPTION 2 — Negotiate a rate with our cognizant federal agency:
Apply for this only after winning a meaningful federal award.

For our current grant applications, we'll use OPTION 1 unless the funder requires otherwise.
`,
  },
  tax_returns: {
    template_kind: 'request',
    title: 'Business Tax Returns (Last 2 Years)',
    request_to: 'Accountant or IRS Tax Transcript',
    request_template: `Subject: Request — Last 2 years business tax returns for federal grant applications

Hi [ACCOUNTANT NAME],

For federal grant applications I need the most recent two years of business tax returns:
- {{ORG_NAME}} — [LAST YEAR] return (Form [FORM TYPE — e.g., 1120, 1065, 990])
- {{ORG_NAME}} — [YEAR BEFORE] return

If you have signed PDFs on file, please email them to {{EMAIL}}. If not, IRS Tax Transcripts (free, online order at irs.gov/individuals/get-transcript) are also acceptable.

Thanks,
{{OPERATIONS_LEAD_NAME}}
{{ORG_NAME}}
`,
  },

  // ─── GATHER — exists somewhere; user finds and uploads ───────────────────
  state_license: {
    template_kind: 'gather',
    title: 'State Home Health License',
    gather_hint: 'Find the PDF copy from when your state DCH issued your license. Check email/files for "DCH license" or "Home Health" + your agency name.',
  },
  evv_compliance: {
    template_kind: 'gather',
    title: 'EVV Compliance Report (HHAeXchange)',
    gather_hint: 'Log into HHAeXchange → Reports → run/export EVV compliance report for the most recent reporting period (typically last quarter or YTD). Save as PDF.',
  },
  sam_registration: {
    template_kind: 'gather',
    title: 'SAM.gov Registration Verification',
    gather_hint: 'Log into sam.gov → Entity Management → download your active registration PDF. (UEI: {{UEI}}, CAGE: {{CAGE}}). If expired, renew immediately — federal grants require active SAM.gov registration.',
  },
};

// Resolve aliases — some doc_types have synonymous IDs in document_vault rows
const ALIAS_MAP = {};
for (const [canonical, meta] of Object.entries(DOC_TYPE_METADATA)) {
  if (meta.aliases) {
    for (const alias of meta.aliases) {
      ALIAS_MAP[alias] = canonical;
    }
  }
}

export function resolveDocType(doc_type) {
  return ALIAS_MAP[doc_type] || doc_type;
}

export function getDocTypeMetadata(doc_type) {
  return DOC_TYPE_METADATA[resolveDocType(doc_type)] || null;
}

export function listDraftableDocTypes() {
  return Object.entries(DOC_TYPE_METADATA)
    .filter(([_, v]) => v.template_kind === 'draftable')
    .map(([k]) => k);
}

// Read a draftable template from disk for a specific org. Returns null if no template exists.
export function readTemplateForOrg(org_id, doc_type) {
  const canonical = resolveDocType(doc_type);
  const path = resolve(TEMPLATES_DIR, org_id, `${canonical}.md`);
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

// List which draftable doc types have on-disk templates for a given org.
export function listAvailableDraftableTemplates(org_id) {
  const draftable = listDraftableDocTypes();
  return draftable.filter((dt) => readTemplateForOrg(org_id, dt) !== null);
}

// Render a Markdown template by replacing {{TOKEN}} placeholders with org data.
// Unknown tokens stay as {{TOKEN}} so the user can tell what's missing.
// [BRACKETED PLACEHOLDERS] are preserved as-is (those are user-fillable per template).
export function renderTemplate(template, orgData = {}) {
  if (!template) return '';
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  const tokens = {
    ORG_NAME: orgData.name || '[ORG NAME]',
    ORG_TYPE: orgData.orgType || '[ORG TYPE]',
    TODAY: today,
    ADDRESS: orgData.address || '[ADDRESS]',
    EMAIL: orgData.email || orgData.emailTo || '[EMAIL]',
    UEI: orgData.uei || '[UEI]',
    CAGE: orgData.cage || '[CAGE]',
    NPI: orgData.npi || '[NPI]',
    EIN: orgData.ein || '[EIN]',
    OPERATIONS_LEAD_NAME: extractName(orgData.operationsLead) || 'Rodney Williams',
    OPERATIONS_LEAD_TITLE: extractTitle(orgData.operationsLead) || 'Operations Lead',
    CLINICAL_DIRECTOR_NAME: extractName(orgData.clinicalDirector) || '',
    CLINICAL_DIRECTOR_TITLE: extractTitle(orgData.clinicalDirector) || '',
  };

  let out = template;
  for (const [k, v] of Object.entries(tokens)) {
    out = out.replaceAll(`{{${k}}}`, v);
  }
  return out;
}

function extractName(s) {
  if (!s) return null;
  const m = s.match(/^([^—,]+)/);
  return m ? m[1].trim() : null;
}

function extractTitle(s) {
  if (!s) return null;
  const m = s.match(/—\s*([^—]+?)(\s*—|$)/);
  return m ? m[1].trim() : null;
}
