# PromptLens — MVP SRS

**Version:** 0.1 · **Date:** 5 November 2026 · **Status:** implementation started

## Purpose
Help small agencies, solo SEO consultants, and B2B SaaS teams find website improvements, complete them, and report progress toward AI visibility. PromptLens is a working name.

## Users and stories
| User | Core story |
|---|---|
| Small agency | Manage client brands and export a branded progress report. |
| Solo consultant | Find the three most useful fixes and get practical instructions. |
| Startup team | Understand and improve its website without needing an SEO specialist. |

## Core flow
Add brand → approve buyer questions → run baseline → review prioritized fixes → make changes → rescan → report progress.

## Functional requirements
1. **Projects:** authenticated, user-owned records; up to three brands with website, description, audience, competitors, and up to 20 questions each.
2. **Readiness audit:** fetch public website content; save dated evidence for accessibility, indexing directives, search-crawler access, and basic content clarity. State exactly which page was checked.
3. **Action plan:** prioritize detected issues; show evidence, explanation, effort, and suggested changes. Recommendations are rules-based initially.
4. **Verification:** track planned/done actions separately from verified fixes. Only a successful rescan changes readiness results.
5. **Visibility:** record ChatGPT/Gemini observations with question, date, collection method, answer, mentions, and cited URLs. Automatic collection and weekly scheduling require a configured provider. Manual observations must be labelled.
6. **Progress/reporting:** readiness history, outstanding fixes, recorded mentions/citations, and printable agency-branded report. No invented metrics or mixed readiness/visibility score.
7. **Commercial launch:** working billing, cancellation, server-enforced plan limits, provider credentials, and scheduled collection must pass validation before paid public launch.

## Quality and security
Responsive and keyboard-accessible UI; server-side authorization on every record; server-only secrets; bounded public-URL fetching with private-network/redirect checks; audit throttling; clear failures rather than fabricated success. Persist project data in a database. Keep question-set changes visible when interpreting trends.

## Measurement rules
Readiness is our versioned checklist, not an AI-engine score. Unknown checks are reported as unknown. Completing a task does not inflate scores. Manual samples are not representative market visibility. Mentions, website citations, referrals, and sales remain separate. All uplift claims require real evidence.

## Out of scope
Automatic site publishing, social posting, ecommerce feeds, local-map tracking, enterprise permissions, guaranteed rankings, and automated content farms.

## Acceptance / release gates
- A signed-in user creates a brand, runs a real audit, receives evidence-backed fixes, rescans, and exports a report; records survive reloads.
- Another user cannot read or modify those records; invalid/private URLs and oversized requests are rejected.
- Monitoring has an honest empty/disconnected state until real observations exist.
- **Private working build:** project/audit/action/report loop and manual evidence capture.
- **Paid MVP:** additionally requires tested live collection, weekly jobs, billing, quotas, and account lifecycle. These are not represented as complete in the private build.

## Pilot success
Recruit three paying pilots, check whether they complete fixes and reuse the report, then measure renewal. Pricing is a test hypothesis, not a committed commercial offer.
