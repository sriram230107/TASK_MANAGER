---
description: Projects, clients, timesheets and workload
---
# Phase 5: business layer

Optional module, switchable per organization. Read `AGENTS.md`, the Task and TimeEntry models from Phase 3.
Write an implementation plan first and wait for approval.

## Steps

1. **Schema.** `Client`, `Project` (client, owner, dates, budget hours, billable flag, status), tasks belong to a project; `Timesheet` (user, week, status) with `TimeEntry` linked to project and task; `Holiday` and capacity from organization settings.
2. **Timesheets.** Weekly grid entry, timer integration, submit, manager approve or reject with reason, lock after approval, audit trail. Reminders for missing timesheets (jobs).
3. **Projects.** List and detail pages: progress, burn-down of budget hours, billable versus non-billable, milestones, member list, health indicator computed from schedule and effort.
4. **Workload.** Capacity per person per week (working hours minus leave and holidays) versus assigned estimated hours; overload highlighted; drag to rebalance with confirmation.
5. **Reports.** Hours by project, client and person; utilisation; export to CSV and PDF. Permissions follow the hierarchy (managers see their reports only).
6. **Feature switch.** Organization setting to turn the whole module on or off; navigation and API respect it.

## Acceptance criteria

Timesheet approval workflow tested per role; utilisation math tested with leave, holidays and part weeks; no cross-organization leakage; module off hides everything. Run `/verify-phase`.
