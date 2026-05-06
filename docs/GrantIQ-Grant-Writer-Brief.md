# GrantIQ — Grant Writer Review Brief

**For:** [Grant writer name]
**From:** Rodney Williams
**Date:** May 2026
**Goal:** Get your professional grant-writer eyes on this platform so we can prioritize what to build, fix, and redesign next.

---

## What is GrantIQ?

GrantIQ is a private, AI-powered grant operations dashboard I built to manage grant discovery, application drafting, and submission across the four businesses I run. Instead of hiring a full-time grant writer (which I can't justify yet) or paying for tools like Instrumentl ($300-$1000/mo), I built my own — and now I want a real grant writer to tell me where it's strong, where it's weak, and what's missing.

It's live at **https://grantiq-ivory.vercel.app** (password-gated; I'll share login by Signal).

The platform uses **two AI agents**:

- **Grants Agent** — finds grants, scores eligibility, drafts narratives, generates supporting documents (capability statements, W-9s, letters of support, etc.).
- **Playwright Agent** — fills out grant application forms in a real browser, pauses for my approval before signatures, CAPTCHAs, and final submit.

---

## The four businesses GrantIQ tracks

| Business | Type | Geography | Primary grant lanes |
|---|---|---|---|
| **Holigenix Healthcare LLC** | 508(c)(1)(a) faith-based nonprofit, pediatric home health | Georgia only | HRSA, foundations, Medicaid, healthcare equity |
| **K1 Management LLC** | MBE / MWBE / SDB government contractor | PA, NJ, DE | State procurement, federal contracts, MBDA, COSTARS |
| **Owner Nonprofit** | Faith-based community org | Georgia | Foundations, community development |
| **AI Junkies University** | Online workforce development institution (founded 2025) | Georgia, online national | DOL/WIOA, STEM education, economic mobility |

Strict rule: each business only gets matched to grants in its valid geography. The agent enforces this.

---

## How the platform is laid out

The portal has these main sections:

### Operate (the daily-use area)
- **Inbox** — priority queue: gated browser sessions, drafts ready for review, urgent deadlines
- **Pipeline** — every active grant, with filters by status, match score, deadline. One-click "Draft application" button on each row.
- **Drafts** — every saved narrative + budget pair the agent has produced
- **Sessions** — live browser sessions where the agent is filling out forms
- **Calendar** — 90-day deadline timeline plus a "TBD" bucket for grants the agent couldn't extract a deadline for

### Documents (the org-specific area)
- **Brief** — structured per-org profile: mission, metrics, problem, solution, target population, why-us, funding alignment, use of funds, roadmap. Used by the agent when reasoning about grant fit.
- **Knowledge** — per-org reference material: notes, links, and uploaded PDFs/images. Stored privately, signed-URL downloads.
- **Vault** — every required document for the org with status (uploaded / drafted / missing). One-click "Draft with AI" button on missing draftable docs.
- **Templates** — reusable narrative blocks across orgs

### Discovery
- **Sources** — grant feeds the agent monitors
- **Watchlists** — saved searches that fire alerts on new matches
- **Dismissed** — rejected grants log with reasons (so the agent doesn't keep re-surfacing them)

### Relationships
- **Funders** — per-funder relationship history, win rate, contact person
- **Submissions** — every past submission with outcome and dollar amount

### Intelligence
- **Chat** — persistent chat with the Grants agent (full markdown rendering, conversation history)
- **Notes** — Layer-3 agent learnings (things the agent has remembered about my org, voice, prior wins)

---

## What the Grants Agent can do today

The agent has 18 tools it can call during a conversation. Here's what those tools actually do:

- **Search the web** for grants matching one of my orgs' profiles
- **Fetch a specific grant page** and read it
- **Score a grant** 0-100 against an org's profile
- **Save grants** to my pipeline with deadlines, eligibility notes, certification advantages
- **Check documents** — for any specific grant, what % ready am I?
- **Draft an application narrative** — 6 sections (executive summary, organizational capacity, needs statement, project approach, outcomes & evaluation, sustainability) at 200-500 words each
- **Generate a budget** from my org's billing rates
- **Save drafts** to the database for review
- **Generate supporting documents** — capability statements, org charts, board lists, W-9 prep sheets, three flavors of letters of support, CVs
- **Hand off form-filling to the Playwright agent** with a complete task spec

---

## Document types the agent can draft today

| Type | Status |
|---|---|
| Capability statement (1-page) | ✅ Per-org templates |
| Organizational chart | ✅ |
| Board of directors / leadership list | ✅ |
| W-9 preparation sheet | ✅ |
| Letter of support — community partner / subcontractor | ✅ |
| Letter of support — government / municipal partner | ✅ |
| Letter of support — physician / past performance reference | ✅ |
| CV — operations lead | ✅ |
| CV — clinical director (Holigenix only) | ✅ |
| Application narrative — 6 generic sections | ✅ |
| Budget — line-item from billing rates | ✅ |

**Document types we do NOT draft yet** (and we know we should):

- Logic models
- Theories of change
- Funder-specific narrative formats (NIH biosketch, NSF format, foundation RFP-specific)
- Budget justifications (not just budgets — the *why* behind each line)
- Sustainability plans
- Evaluation plans
- MOUs (memorandums of understanding)
- Letters of inquiry (LOIs)
- Cover letters with funder-specific personalization

---

## What we already know is weak

I'm being honest with you so you don't waste time on stuff I already know about:

1. **Funders, Submissions, and Watchlists are mostly mock data.** Beautiful screens, no real backing yet.
2. **Drafts can't be edited inside the portal.** You can only view and download to edit elsewhere.
3. **Deadlines on most grants are blank.** The agent has been saving grants without parsing the deadline. I just fixed the rule going forward; existing 23 grants still need backfill.
4. **Uploaded PDFs in the KB aren't read by the agent.** It can list them but can't extract their text yet.
5. **No award / payment tracking.** Once awarded, the dollars don't flow into GrantIQ.
6. **One shared password gates the whole portal.** No per-user login.
7. **Templates view is read-only.** Can't edit the reusable narrative blocks from the UI.
8. **No mobile design.** Desktop only, basically.

---

## What I need from you

Please review the platform and answer the following. This document is yours to mark up — write directly into it (replace the **[your answer]** blocks), or send your thoughts back in any format. Be brutal. The goal is to know what to build next, not to make me feel good.

---

### Question 1 — Does this fit a grant writer's daily workflow?

If you walked into this platform tomorrow as my hired grant writer, would it support how you actually work? Where would you get stuck?

**[your answer]**

---

### Question 2 — What's missing that you'd expect?

What features would you assume any serious grant operations tool has, that we don't have? (Examples I've heard: project-by-project requirement checklists, per-funder contact databases, voice/tone libraries, narrative reuse across applications, evaluation frameworks, etc.)

**[your answer]**

---

### Question 3 — Document types

Looking at the "we don't draft yet" list above, which 3-5 of those would have the biggest impact if the agent could draft them? Are there any document types I haven't even mentioned that you find yourself building over and over?

**[your answer]**

---

### Question 4 — The agent's narrative quality

What separates a good grant narrative from a bad one in your experience? What signals would tell you "this AI doesn't actually understand grants" vs. "this AI is genuinely helpful"? When you eventually review some of the agent's drafts, what should I have you look for?

**[your answer]**

---

### Question 5 — The "I just got a new grant assigned" workflow

Walk me through the ideal flow when I tell you, "Apply for this grant for Holigenix." What screen do you want to land on? What do you want already pulled together for you? What do you want the agent to have done before you touch the draft?

**[your answer]**

---

### Question 6 — What you'd build first

If you had unlimited dev time on this platform, what would be the very first thing you'd add or fix? Why?

**[your answer]**

---

### Question 7 — Anything else

Reactions, complaints, ideas, things you've seen on Instrumentl / Submittable / GrantHub / Foundation Directory / Candid / GrantWatch / HelloSkip that you'd steal. Half-formed thoughts welcome.

**[your answer]**

---

## How to send this back

Whatever's easiest:

- Edit this Markdown file directly (replace the **[your answer]** blocks) and email it back
- Print, mark up, scan
- Voice notes / a phone call where you walk me through your reactions
- A messy email with bullet points

I'd rather have rough, honest reactions in 30 minutes than a polished doc in two weeks.

Once I have your feedback, I'll triage it into the next development cycle and send you what I'm changing first. Then we iterate.

Thanks — looking forward to seeing what you find.

— Rodney
admin@holigenixhealthcare.com

---

*This document also lives on the portal at https://grantiq-ivory.vercel.app/GrantIQ-Grant-Writer-Brief.md if you'd rather grab it from there.*
