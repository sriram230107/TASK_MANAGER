---
description: Optional CRM-lite for companies that sell to clients (contacts, companies, leads, deals, pipelines)
---
# Phase 5c: CRM-lite (optional module)

Only for companies that need it; the whole module is off by default and switchable per organization.
Reuse the Phase 3 task engine, Phase 5 clients and Phase 5b feed and chat. Read `AGENTS.md`. Write an implementation plan first and wait for approval.

## Steps

1. **Schema.** `Company`, `Contact`, `Lead`, `Deal`, `Pipeline` and `Stage` (configurable, several pipelines), `Activity` (call, meeting, email note, task), `Product` and `DealLine` (optional), custom fields on each entity.
   Every table carries `organizationId`. Link the existing `Client` from Phase 5 to `Company` without duplicating data.
2. **Pipelines.** Kanban by stage with drag and drop, deal value and probability, expected close date, win or lose with reason, lead to deal conversion, duplicate detection on create and import.
3. **Timeline.** One history per record (notes, calls, emails, stage changes, tasks, files) reusing the comment and activity components.
4. **Ownership and permissions.** Owner per record; managers see their team's records; sales-specific roles configurable. Sensitive fields (prices, margins) visible by role.
5. **Import and export.** CSV import with mapping and dry run, export, bulk actions.
6. **Forms.** Public web-to-lead form builder with spam protection and rate limits, creating leads and a task for the owner.
7. **Reports.** Funnel conversion, pipeline value by stage and owner, win rate, average cycle time, forecast. CSV and PDF export.
8. **Automation.** Reuse the Phase 3 rules engine: stage change creates a task, stale deal reminder, assign new leads round-robin.
9. **AI hooks (only after Phase 4, behind the guardrails).** Summarize a record's timeline and draft a follow-up note as a proposal the user edits and sends.

## Acceptance criteria

Import handles bad rows without partial corruption; permissions tested per role and owner; funnel math tested with edge cases; public form cannot read or write anything except creating a lead; module off hides everything. Run `/verify-phase`.
