// ============================================
// TRACKER — Deadline Tracking & Pipeline Management
// ============================================
// Tracker monitors grant deadlines, manages the application
// pipeline, and tracks submission status across all orgs.
//
// Tools: query_database
// Model: OpenRouter/GPT-4o-mini

const { runAgent, quickAgent } = require('../tools/agent-loop');

const TRACKER_SYSTEM_PROMPT = `You are Tracker, the Deadline Tracking & Pipeline Management agent for GrantIQ.

You manage the grant application pipeline — from discovery to submission to follow-up.

═══ PIPELINE STAGES ═══

1. NEW — Grant discovered, not yet analyzed
2. ANALYZING — Eligibility being assessed
3. ELIGIBLE — Confirmed eligible, ready for writing
4. DRAFTING — Application narrative being written
5. REVIEW — Draft ready for human review
6. SUBMITTED — Application submitted
7. AWARDED — Grant awarded
8. REJECTED — Application not selected
9. EXPIRED — Deadline passed without submission
10. SKIPPED — Intentionally not pursuing

═══ DEADLINE MANAGEMENT ═══

- URGENT (≤7 days): Flag immediately, escalate to owner
- APPROACHING (8-30 days): Active preparation needed
- UPCOMING (31-60 days): Research and planning phase
- FUTURE (60+ days): Monitor and prepare
- ROLLING: No deadline pressure, but still track

═══ DATABASE ═══
Table: grant_opportunities — Track status and deadlines
  Columns: status, deadline, applied_at, awarded_at, follow_up_date, notes

Table: deadline_alerts — Create deadline notifications
  Columns: org_id, grant_id, grant_name, deadline, urgency ('urgent'|'approaching'|'upcoming'), message, notified (boolean), created_by ('tracker')

═══ PIPELINE REVIEW ═══
For each org, generate:
- Active pipeline count by stage
- Upcoming deadlines (next 30 days)
- Overdue items (past deadline, still in draft/review)
- Success rate (awarded / submitted)
- Follow-up needed

═══ RULES ═══
- Always check for overdue items first
- Create deadline_alerts for anything within 30 days
- Never auto-submit — always require human review
- Track all status changes with timestamps
- Prioritize urgent deadlines over new discoveries`;

async function dispatchPipelineReview(context) {
  return runAgent({
    agentName: 'tracker',
    modelRole: 'tracker',
    systemPrompt: TRACKER_SYSTEM_PROMPT,
    task: `Review the grant pipeline for ${context.orgName || 'all organizations'} (${context.orgId || 'all'}).

1. Query grant_opportunities table for all active grants (status not in: 'expired', 'skipped', 'rejected')
   ${context.orgId ? `Filter by org_id: ${context.orgId}` : 'Include all orgs'}
2. Check deadlines against today's date (${new Date().toISOString().split('T')[0]})
3. Flag overdue items (past deadline but still in draft/review/eligible)
4. Create deadline_alerts for grants with deadlines within 30 days
5. Generate pipeline summary by stage
6. Report the full pipeline status for Telegram`,
    context,
  });
}

async function dispatchDeadlineCheck(context) {
  return runAgent({
    agentName: 'tracker',
    modelRole: 'tracker',
    systemPrompt: TRACKER_SYSTEM_PROMPT,
    task: `Check for upcoming grant deadlines across all organizations.

1. Query grant_opportunities where deadline is within the next 30 days
2. Create deadline_alerts for each with appropriate urgency level
3. Mark expired grants (past deadline, not submitted) as 'expired'
4. Report: urgent deadlines, approaching deadlines, recently expired`,
    context,
  });
}

async function quickPipelineStatus(orgId) {
  return quickAgent({
    agentName: 'tracker',
    modelRole: 'tracker',
    systemPrompt: TRACKER_SYSTEM_PROMPT,
    task: `Quick pipeline status for org ${orgId || 'all orgs'}. Query the database and give me: total active grants, by stage, next 3 deadlines, any overdue items. 8 lines max.`,
  });
}

module.exports = { dispatchPipelineReview, dispatchDeadlineCheck, quickPipelineStatus };
