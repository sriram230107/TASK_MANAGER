---
description: Task engine v2 (participants, checklists, Kanban, calendar, timeline, recurring, automation, real-time)
---
# Phase 3: task engine v2

Context: read `AGENTS.md`, `backend/prisma/schema.prisma` (Task and related models), `services/task.service.ts`, `routes/task.routes.ts`,
`frontend/src/components/TaskManagementPanel.tsx`, `TaskCard.tsx`, `Calendar.tsx`.
Known problems: list-only UI; four assignee columns plus `TaskAssignment`; 14 overlapping statuses; `dependencies` is a plain string array; subtasks and
dependencies exist in the API but no UI; recurrence rule is stored but nothing creates the repeats; nodemailer never used; no real-time; `node-cron` runs in every instance.
Write an implementation plan first, including the **data migration plan**, and wait for approval.

## Steps

1. **Data model (migration and idempotent backfill).**
   - `TaskParticipant` (taskId, userId, role: RESPONSIBLE | CO_EXECUTOR | OBSERVER | CREATOR) replaces `assignedManagerId`, `assignedTeamLeadId`, `assignedEmployeeId`,
     `assignedToId`. Keep old columns until the frontend is switched, then remove in a later migration.
   - Statuses reduced to about 8: `DRAFT, TODO, IN_PROGRESS, BLOCKED, IN_REVIEW, CHANGES_REQUESTED, DONE, CANCELLED` (overdue is **derived** from the due date, not a status).
     Provide a mapping table from all 14 old values and a per-organization configurable workflow (stages, order, whether review is required).
   - New: `Checklist`, `ChecklistItem`, `TaskDependency` (predecessor, successor, type), `Tag` and `TaskTag`, `TimeEntry` (userId, start, end, note, billable), `SavedView`, `TaskWatcher`.
     Every table carries `organizationId` and useful indexes.
2. **API.** Cursor pagination, filters (status, assignee, tag, due range, text), sorting, grouping, bulk update, reorder within a stage, dependency validation (no cycles),
   timer start/stop, review accept/reject with reason. Keep existing endpoints working during the transition. Permission tests per role.
3. **Views (build on the Phase 2 shell).** List (saved filters), **Kanban** (drag and drop with `dnd-kit`, optimistic), Calendar, Timeline/Gantt (dependencies drawn),
   "My day" planner. Task **drawer** with description, checklist, subtasks, dependencies, tags, time, files, comments, history. Keyboard shortcuts. Bulk actions.
4. **Collaboration.** Comments with @mentions and notifications, watchers, attachment previews (via storage adapter), activity feed from `TaskHistory`.
5. **Background jobs.** Redis and BullMQ replace `node-cron` (add `redis` to compose). Jobs: recurring-task generator (respect `RecurrenceRule`, skip missed duplicates), reminders,
   overdue escalation to the manager, daily and weekly digest emails (behind `config.emailEnabled`). Only workers run jobs, so several API instances are safe.
6. **Real-time.** Socket.IO (or SSE) authenticated with the session cookie; rooms per organization and per task; task, comment and notification events update open screens live.
7. **Automation rules.** JSON rules `{trigger, conditions, actions}` with a safe interpreter (no code execution): triggers (status changed, due soon, overdue, assigned),
   actions (notify, assign, add checklist, change status, create subtask). Admin UI, dry-run mode, audit trail.
8. **Templates.** Task templates with checklists and default participants; "create from template".
9. **Performance.** Indexes verified with `EXPLAIN` on the main queries; a seeded dataset of 50,000 tasks must keep list and Kanban under 300 ms server time.

## Acceptance criteria

- Migration converts a copy of existing data with zero loss (write a verification script that compares before and after). Old API clients keep working until removed.
- Tests: permissions per role and hierarchy, status workflow, dependency cycle rejection, recurring generation (including timezone and month-end), automation dry run, job idempotency.
- Playwright: create, drag between stages, open drawer, add checklist item, mention a user, and see the live update in a second browser context.
- Run `/verify-phase`.
