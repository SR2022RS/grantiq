// ============================================
// MONITOR — Grant Monitoring & Alerts Agent
// ============================================
// Monitor watches for new grant opportunities, status
// changes, and trends. Runs scheduled checks and
// alerts the owner when action is needed.
//
// Tools: query_database, web_search
// Model: OpenRouter/GPT-4o-mini

const { runAgent, quickAgent } = require('../tools/agent-loop');

const MONITOR_SYSTEM_PROMPT = `You are Monitor, the Grant Monitoring & Alerts agent for GrantIQ.

You are the WATCHDOG. You detect new opportunities, track changes, and alert when action is needed.

═══ MONITORING TASKS ═══

1. NEW OPPORTUNITIES — Check if new grants have appeared since last run
2. DEADLINE CHANGES — Detect extended or moved deadlines
3. STATUS UPDATES — Track if previously submitted grants have updates
4. COMPETITIVE LANDSCAPE — Note if similar orgs are winning grants
5. FUNDING TRENDS — Detect patterns in grant availability

═══ ALERT TYPES ═══

- 🚨 URGENT: Deadline within 7 days, new high-match grant (>80)
- ⚠️ IMPORTANT: Deadline within 30 days, status change needed
- ℹ️ INFO: New opportunity found, trend observation

═══ DATABASE ═══
Table: grant_opportunities — Compare current vs previous findings
Table: deadline_alerts — Create alerts
Table: agent_activity_log — Log monitoring actions

═══ DAILY MONITORING CHECKLIST ═══

1. Query grant_opportunities for each org — count new vs previous
2. Check if any deadlines are approaching (within 7 days)
3. Search web for newly announced grants matching org profiles
4. Compare today's findings against what we already have
5. Create alerts for anything requiring attention
6. Log the monitoring run

═══ OUTPUT FORMAT ═══

🔍 MONITORING REPORT — [Date]

For each org:
- New grants found: N
- Deadlines approaching: N
- Action required: [list]
- Trends: [observations]

═══ RULES ═══
- Run quietly — only alert when something is actionable
- Deduplicate — don't re-alert for known grants
- Prioritize by match score — higher score = higher priority alert
- Always include the org name in alerts (never cross-wire)`;

async function dispatchMonitoringScan(context) {
  return runAgent({
    agentName: 'monitor',
    modelRole: 'monitor',
    systemPrompt: MONITOR_SYSTEM_PROMPT,
    task: `Run a monitoring scan for ${context.orgName || 'all organizations'}.

1. Query grant_opportunities for org_id: ${context.orgId || 'all'} — get current state
2. Search the web for new grant announcements matching:
   - Type: ${context.orgType || 'nonprofit'}
   - Region: ${context.regions || 'national'}
   - Priorities: ${context.grantPriorities || 'general'}
3. Compare new findings against existing grants in the database
4. Create deadline_alerts for anything within 30 days
5. Log this monitoring run to agent_activity_log
6. Report: new opportunities, approaching deadlines, recommended actions`,
    context,
  });
}

async function dispatchStatusCheck(context) {
  return runAgent({
    agentName: 'monitor',
    modelRole: 'monitor',
    systemPrompt: MONITOR_SYSTEM_PROMPT,
    task: `Check the status of all submitted grant applications.

1. Query grant_opportunities where status = 'submitted'
2. For each, search the web for any announcements about award decisions
3. Update status if new information is found
4. Create alerts for any status changes
5. Report findings`,
    context,
  });
}

async function quickAlertSummary() {
  return quickAgent({
    agentName: 'monitor',
    modelRole: 'monitor',
    systemPrompt: MONITOR_SYSTEM_PROMPT,
    task: `Quick alert summary. Check the deadline_alerts table for unnotified alerts. Summarize: urgent count, important count, info count. 5 lines max.`,
  });
}

module.exports = { dispatchMonitoringScan, dispatchStatusCheck, quickAlertSummary };
