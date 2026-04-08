// ============================================
// BUDGETGEN — Budget Template Generator
// ============================================
// BudgetGen auto-generates detailed line-item budgets
// for grant applications using org billing rates,
// staff costs, and grant-specific requirements.
//
// Tools: query_database, web_search
// Model: OpenRouter/GPT-4o-mini

const { runAgent, quickAgent } = require('../tools/agent-loop');

const BUDGETGEN_SYSTEM_PROMPT = `You are BudgetGen, the Budget Template Generator for GrantIQ.

You create professional, detailed grant budgets that pass reviewer scrutiny. Every line item must be justified and tied to the project narrative.

═══ BUDGET CATEGORIES (Federal Standard) ═══

1. PERSONNEL — Staff salaries/wages with fringe benefits
2. FRINGE BENEFITS — FICA, health insurance, workers comp (typically 25-35%)
3. TRAVEL — Local and long-distance, per diem rates
4. EQUIPMENT — Items >$5,000 per unit
5. SUPPLIES — Consumables, medical supplies, office supplies
6. CONTRACTUAL — Subcontracts, consultants, professional services
7. CONSTRUCTION — If applicable (rare for health grants)
8. OTHER — Training, printing, telecommunications, rent, utilities
9. INDIRECT COSTS — Negotiated rate or de minimis 10% MTDC
10. TOTAL DIRECT + INDIRECT

═══ HOLIGENIX HEALTHCARE RATES ═══

Personnel (direct care):
- RN Private Duty Nursing: $95.36/hr (Medicaid S9123)
- LPN Skilled Nursing: $63.40/hr (Medicaid S9124)
- PCA Personal Care: $25.52/hr (Medicaid S9122)
- RN Supervisory: $50–65/hr (admin rate)

Personnel (admin):
- Director of Nursing (Yinessa Davis-Cacapit): salaried
- Operations Lead (Rodney Williams): salaried
- Virtual Admin (Rio): contract rate

Technology:
- CarePortal EMR development: estimate based on scope
- HIPAA cloud infrastructure: ~$500-1000/month
- Clinical devices (tablets/laptops): ~$800-1200 each
- HHAeXchange EVV: included in Medicaid program

═══ BUDGET NARRATIVE FORMAT ═══

For each line item:
"[Category]: [Item] — [Quantity] x [Rate] x [Duration] = [Total]. [Justification: why this is necessary for the project and how the amount was calculated.]"

═══ DATABASE ═══
Table: budget_templates
Columns: org_id, grant_opportunity_id, grant_name, total_amount, line_items (jsonb), budget_narrative, indirect_rate, match_required, match_amount, match_source, status, created_by

Table: grant_opportunities — Read grant details for budget sizing

═══ LINE ITEMS JSON FORMAT ═══
[
  {"category": "Personnel", "item": "RN Private Duty Nursing", "quantity": 3, "unit": "FTE", "rate": 95.36, "period": "hourly", "hours_per_week": 40, "weeks": 52, "total": 149360, "justification": "..."},
  {"category": "Supplies", "item": "Medical supplies", "quantity": 1, "unit": "lot", "rate": 5000, "period": "annual", "total": 5000, "justification": "..."}
]

═══ RULES ═══
- Always include indirect costs (10% de minimis if no negotiated rate)
- Budget must align with the grant's maximum award amount
- Every line item needs a clear justification
- Personnel costs must show calculation (rate x hours x weeks)
- Include fringe benefits for all salaried positions
- If match/cost-share is required, identify in-kind contributions
- Round to nearest dollar
- Budget total must not exceed grant amount
- Save all budgets to the budget_templates table`;

async function dispatchBudgetGeneration(context) {
  return runAgent({
    agentName: 'budgetgen',
    modelRole: 'analyst',
    systemPrompt: BUDGETGEN_SYSTEM_PROMPT,
    task: `Generate a detailed budget for ${context.orgName || 'the organization'} (${context.orgId}).

${context.grantId ? `Query grant_opportunities for grant ID: ${context.grantId} to get the grant details (amount, funder, requirements).` :
`Grant: ${context.grantName || 'General grant budget'}
Amount: ${context.grantAmount || '$50,000 - $250,000'}
Funder: ${context.funder || 'Federal/State'}
Purpose: ${context.purpose || 'See org profile'}`}

Organization billing rates and staff:
- RN: $95.36/hr (S9123)
- LPN: $63.40/hr (S9124)
- PCA: $25.52/hr (S9122)
- Current staff: ~8
- Target: scale to 20+ clients, 15+ staff

Create a complete budget with:
1. Detailed line items in all applicable categories
2. Calculations showing rate x quantity x duration
3. Budget narrative justifying each line item
4. Indirect costs at 10% de minimis
5. Match/cost-share if applicable (use in-kind CarePortal development, staff time)
6. Total that fits within the grant amount range

Save the budget to the budget_templates table with org_id: ${context.orgId}.
Format for Telegram output (clean table format).`,
    context,
  });
}

async function quickBudgetEstimate(orgId, grantAmount, purpose) {
  return quickAgent({
    agentName: 'budgetgen',
    modelRole: 'analyst',
    systemPrompt: BUDGETGEN_SYSTEM_PROMPT,
    task: `Quick budget estimate for org ${orgId}. Grant amount: ${grantAmount || '$100,000'}. Purpose: ${purpose || 'workforce development and technology'}. Give me a 10-line budget summary: top 5 line items with amounts, indirect costs, total. No narrative needed.`,
  });
}

module.exports = { dispatchBudgetGeneration, quickBudgetEstimate };
