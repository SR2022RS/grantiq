// Generic 4-template scaffold for newly-onboarded orgs. Stored in
// org_templates table since Vercel filesystem is read-only at runtime.
// User can edit these via the Templates tab once they exist.

export const SCAFFOLD_TEMPLATES = {
  capability_statement: {
    title: 'Capability Statement (1-page)',
    body: `# {{ORG_NAME}} — Capability Statement

**{{ORG_NAME}}**
[ADDRESS] · [PHONE] · [EMAIL] · [WEBSITE]

---

## Core Competencies

- [Primary service/product line 1]
- [Primary service/product line 2]
- [Primary service/product line 3]
- [Differentiator: tech stack, certifications, methodology]

## Past Performance

- **[Client / project name]** — [Brief outcome, dollar value if relevant, dates]
- **[Client / project name]** — [Brief outcome, dollar value if relevant, dates]
- **[Client / project name]** — [Brief outcome, dollar value if relevant, dates]

## Differentiators

[1-2 sentence statement of what makes this org uniquely qualified — certifications, scale, geographic reach, mission alignment.]

## Company Data

- Legal name: {{ORG_NAME}}
- EIN: {{EIN}}
- UEI: {{UEI}}
- CAGE: {{CAGE}}
- DUNS: [if applicable]
- NAICS codes: [list primary + secondary]
- Founded: [YEAR]
- Address: {{ADDRESS}}

## Certifications

- [Certification 1 — issuing body, expiration]
- [Certification 2 — issuing body, expiration]
- [Certification 3 — issuing body, expiration]

## Contact

{{OPERATIONS_LEAD_NAME}}, {{OPERATIONS_LEAD_TITLE}}
{{EMAIL}} · [PHONE]

---

*Edit this template at workspace/templates/{{ORG_ID}}/capability_statement.md or via the Templates tab.*
`,
  },
  org_chart: {
    title: 'Organizational Chart',
    body: `# {{ORG_NAME}}

**Organizational Chart**

Effective: {{TODAY}}

---

## Leadership

\`\`\`
              ┌──────────────────────────────────┐
              │  [PRIMARY OWNER / EXECUTIVE]     │
              │  [TITLE]                         │
              │  {{ORG_NAME}}                    │
              └──────────────┬───────────────────┘
                             │
        ┌────────────────────┼─────────────────────┐
        │                    │                     │
        ▼                    ▼                     ▼
  ┌──────────────┐   ┌────────────────┐   ┌──────────────────┐
  │ [DEPT 1]     │   │ [DEPT 2]       │   │ [DEPT 3]         │
  │ [LEAD]       │   │ [LEAD]         │   │ [LEAD]           │
  └──────────────┘   └────────────────┘   └──────────────────┘
\`\`\`

## Headcount Summary

- **W-2 Employees:** [NUMBER]
- **Contractors / 1099:** [NUMBER]
- **Active Programs:** [NUMBER]
- **States with Active Operations:** [LIST]

{{ORG_NAME}} · {{ADDRESS}} · {{EMAIL}}

---

*Replace this ASCII chart with a Lucidchart, Visio, or PowerPoint diagram for visual presentations. [BRACKETED PLACEHOLDERS] — fill in via Word, save as PDF, upload.*
`,
  },
  board_list: {
    title: 'Board of Directors / Leadership List',
    body: `# {{ORG_NAME}}

**Board of Directors / Leadership Roster**

Effective: {{TODAY}}

---

## Officers

| Name | Title | Role | Term | Email |
|------|-------|------|------|-------|
| [Name] | Chair / President | [Strategic role] | [Start–End] | [email] |
| [Name] | Vice Chair | [Role] | [Start–End] | [email] |
| [Name] | Treasurer | [Financial oversight] | [Start–End] | [email] |
| [Name] | Secretary | [Governance / records] | [Start–End] | [email] |

## At-Large Members

| Name | Affiliation / Background | Role on Board | Term |
|------|--------------------------|---------------|------|
| [Name] | [Background — community, professional] | [Committee] | [Start–End] |
| [Name] | [Background] | [Committee] | [Start–End] |

## Advisory / Operational Leadership (non-board)

- {{OPERATIONS_LEAD_NAME}} — {{OPERATIONS_LEAD_TITLE}}
- [Name] — [Title]
- [Name] — [Title]

## Governance Notes

- Board meets [FREQUENCY] (e.g., quarterly)
- [Number] standing committees: [LIST]
- Bylaws last revised: [DATE]
- 501(c)(3) / 508(c)(1)(a) status: [STATUS]

---

*Edit this template via the Templates tab. Funders typically request board affiliations + terms; fill in as much detail as possible before exporting.*
`,
  },
  w9: {
    title: 'W-9 Form Preparation Sheet',
    body: `# W-9 Form Preparation Sheet — {{ORG_NAME}}

Data sheet to use when filling out the official IRS Form W-9.

**IMPORTANT:** The IRS does not allow third parties to generate or sign your W-9 for you. The official, current Form W-9 must be downloaded from https://www.irs.gov/forms-pubs/about-form-w-9 and signed by an authorized officer. This document provides the exact data to type into each field.

---

## W-9 Field-by-Field Data — {{ORG_NAME}}

**Line 1: Name (as shown on tax return)**
{{ORG_NAME}}

**Line 2: Business name / disregarded entity name**
[Leave blank — or enter DBA if applicable]

**Line 3a: Federal tax classification**
Check the box that matches the IRS election:
- Single-Member LLC owned by an individual → "Individual/sole proprietor or single-member LLC"
- Multi-Member LLC taxed as Partnership → "Limited liability company" + "P"
- LLC taxed as S-Corp → "Limited liability company" + "S"
- LLC taxed as C-Corp → "Limited liability company" + "C"
- C Corporation → "C Corporation"
- S Corporation → "S Corporation"
- Nonprofit (501(c)(3) or 508(c)(1)(a)) → "Other" and write classification

[CONFIRM WITH CPA]

**Line 3b: Foreign partner indicator**
Leave unchecked unless applicable.

**Line 4: Exemptions**
Leave blank unless exempt payee or exempt from FATCA reporting.

**Line 5: Address**
{{ADDRESS}}

**Line 6: City, state, ZIP**
[CITY], [STATE] [ZIP]

**Line 7: Account number(s)**
Leave blank (or fill in if requester asks).

**Part I: Taxpayer Identification Number (TIN)**
Enter EIN: **{{EIN}}**

**Part II: Certification — Signature**
Signed by: {{OPERATIONS_LEAD_NAME}}, {{OPERATIONS_LEAD_TITLE}}

**Part II: Certification — Date**
Date of signature.

---

## Quick Steps

1. Download Form W-9 from irs.gov (use most recent revision)
2. Open in Adobe Acrobat or any PDF editor
3. Type each field exactly as shown above
4. Sign Part II
5. Save as \`{{ORG_ID}}_W9_[YYYY-MM-DD].pdf\` and upload

## Notes

- Most grantors accept a W-9 dated within the last 12 months. Re-sign annually.
- Never email an unencrypted W-9. Use a secure portal or encrypted PDF.

---

*Prepared for {{ORG_NAME}}*
`,
  },
};

export function listScaffoldDocTypes() {
  return Object.keys(SCAFFOLD_TEMPLATES);
}

export function getScaffoldRows(org_id) {
  return Object.entries(SCAFFOLD_TEMPLATES).map(([doc_type, { title, body }]) => ({
    org_id,
    doc_type,
    title,
    body,
  }));
}
