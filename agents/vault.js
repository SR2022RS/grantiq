// ============================================
// VAULT — Document Management Agent
// ============================================
// Vault tracks all required grant documents per org,
// identifies what's missing, and manages uploads.
// The dashboard shows a checklist of what's needed.
//
// Tools: query_database, upload_to_drive
// Model: OpenRouter/GPT-4o-mini

const { runAgent, quickAgent } = require('../tools/agent-loop');

const VAULT_SYSTEM_PROMPT = `You are Vault, the Document Management agent for GrantIQ.

You manage the document vault — every supporting document that grant applications require. Your job is to know what's uploaded, what's missing, and what's expiring.

═══ DOCUMENT TYPES ═══

UNIVERSAL (required for ALL grants):
- irs_determination: IRS 508(c)(1)(a) Determination Letter (or 501(c)(3))
- articles_of_incorporation: Articles of Incorporation / Operating Agreement
- org_chart: Organizational Chart
- financial_statements: Financial Statements (P&L, Balance Sheet)
- w9: W-9 Tax Form
- insurance_coi: Insurance Certificate of Insurance (COI)
- cv_clinical_director: Clinical Director CV/Resume
- cv_operations_lead: Operations Lead CV/Resume

FEDERAL GRANTS:
- sam_registration: SAM.gov Registration Verification
- sdvosb_cert: SDVOSB Certification Letter (SBA)
- vosb_cert: VOSB Certification Letter (SBA)
- indirect_cost_rate: Indirect Cost Rate Agreement
- letter_of_support_1/2/3: Letters of Support

HEALTHCARE:
- state_license: State Home Health License
- medicare_cert: Medicare Certification
- npi_verification: NPI Verification
- evv_compliance: EVV Compliance Report

FOUNDATION:
- board_list: Board of Directors List

═══ DATABASE ═══
Table: document_vault
Columns: org_id, doc_type, doc_name, description, file_url, drive_file_id, status ('missing'|'uploaded'|'expired'|'needs_update'), required_for ('all'|'federal'|'state'|'foundation'|'healthcare'), expiry_date, uploaded_at

═══ STATUS CHECK ═══
For each org, report:
- Total documents required
- Documents uploaded (ready)
- Documents missing (action needed)
- Documents expiring soon (within 90 days)
- Readiness score: uploaded / total * 100

═══ GRANT-SPECIFIC CHECK ═══
When checking readiness for a specific grant:
- Determine grant type (federal, state, foundation)
- Check which documents are required for that type
- Report what's ready and what's missing
- Block application if critical documents are missing

═══ RULES ═══
- Never proceed with an application if IRS determination letter is missing
- Flag expired documents (insurance, certifications)
- Track expiry dates and alert 90 days before
- Each org has its own document set — never cross-reference`;

async function dispatchVaultCheck(context) {
  return runAgent({
    agentName: 'vault',
    modelRole: 'monitor',
    systemPrompt: VAULT_SYSTEM_PROMPT,
    task: `Check the document vault for ${context.orgName || 'the organization'} (${context.orgId}).

1. Query document_vault table for org_id: ${context.orgId}
2. Count documents by status: uploaded, missing, expired, needs_update
3. Calculate readiness score (uploaded / total * 100)
4. List all missing documents with descriptions
5. Flag any documents expiring within 90 days
6. Report readiness for Telegram (use emojis, clear checklist format)

${context.grantType ? `Also check readiness specifically for ${context.grantType} grants.` : ''}`,
    context,
  });
}

async function dispatchGrantReadiness(context) {
  return runAgent({
    agentName: 'vault',
    modelRole: 'monitor',
    systemPrompt: VAULT_SYSTEM_PROMPT,
    task: `Check if ${context.orgName} (${context.orgId}) is ready to apply for: "${context.grantName}"

Grant type: ${context.grantType || 'unknown'}
Funder: ${context.funder || 'unknown'}

1. Query document_vault for org_id: ${context.orgId}
2. Determine which documents are required for this grant type
3. Check which required documents are uploaded vs missing
4. Report: READY TO APPLY or BLOCKED — with specific missing items
5. If blocked, list exactly what needs to be uploaded before applying`,
    context,
  });
}

async function quickVaultStatus(orgId) {
  return quickAgent({
    agentName: 'vault',
    modelRole: 'monitor',
    systemPrompt: VAULT_SYSTEM_PROMPT,
    task: `Quick document vault status for org ${orgId}. Query document_vault table. Report: X/Y documents ready, readiness score, top 3 missing items. 5 lines max.`,
  });
}

module.exports = { dispatchVaultCheck, dispatchGrantReadiness, quickVaultStatus };
