Organization Task, Workforce & Performance Management System — Spec
Stack (confirm/correct during audit — do not assume)
Monorepo: existing repository structure — detect actual frontend and backend directory names during P1 audit (could be /frontend+/backend, /client+/server, /web+/api, etc).
Do NOT rename or restructure existing directories merely to match this spec. Record actual detected paths in IMPLEMENTATION_STATUS.md after P1.
Package manager: detect from lockfile (npm/pnpm/yarn).
Styling: confirm actual system in use during audit; do not swap an existing styling system without explicit instruction.
Backend: Express + Prisma + PostgreSQL. Frontend: React.
Auth: JWT.
Objective

Upgrade existing partially-functional Task Manager into a full Organization Task, Workforce & Performance Management Platform. Core = Task Management. Supporting modules: employee profiles, attendance, work hours, leave, performance, goals, payroll/compensation, reports, notifications, documents, audit log, organization settings.

Non-negotiable rules
NO fake functionality: every UI control must call a real backend endpoint that persists to the DB. No dummy stats, no "success" toasts without a confirmed DB write.
NO frontend-only permission checks: every protected endpoint validates auth → role → access scope → payload, server-side (see Access Scope).
NO destructive migrations without inspecting existing data first. If a clean dev DB is genuinely the safest path, document exactly why in IMPLEMENTATION_STATUS.md before doing it.
NO duplicate APIs/components for the same operation — refactor existing code if salvageable, replace cleanly if not.
Every feature flow: DB → backend service → API → RBAC + scope middleware → frontend service call → UI → DB update → UI refresh.
NEVER trust frontend-supplied organizationId, departmentId, teamId, managerId, employeeId, or task ownership. Derive scope from the authenticated user (JWT/session) on the server, always.
Never claim a feature is COMPLETE unless implemented and verified end-to-end (DB write confirmed, API returns correct data, UI reflects it).
Role hierarchy

ADMIN > MANAGER > TEAM_LEAD > EMPLOYEE

Reporting relationships (verify against actual schema in P1)

Organization → Department → Manager → Team → Team Lead → Employee Do not force a Manager into exactly one team if the current data model doesn't require that. Confirm during audit:

User → Department
User → Team
User → Manager
User → Team Lead
Team → Department
Department → Organization
Role capability matrix (scope-qualified; Y* = policy/scope controlled)
Action	ADMIN	MANAGER	TEAM_LEAD	EMPLOYEE
Manage org/dept/roles/settings	Y	-	-	-
Create org/department-level task	Y	Y	-	-
Assign task to Team Lead	Y	Y	-	-
Assign/split task to Employee	Y*	-	Y	-
Update own task progress	-	Y*	Y*	Y
Approve leave	Y	Y*	Y*	-
View/manage payroll	Y	limited	-	own only
View audit log	Y	limited	-	-
Access scope (enforced server-side on every protected resource)

ADMIN → organization-wide MANAGER → assigned department + subordinate teams TEAM_LEAD → assigned team + team members EMPLOYEE → own records + explicitly shared records Rule 6 above applies here without exception.

Task status flow

DRAFT → ASSIGNED → ACCEPTED → IN_PROGRESS → (ON_HOLD) → SUBMITTED → UNDER_REVIEW → COMPLETED | CHANGES_REQUESTED → back to IN_PROGRESS Also: CANCELLED, OVERDUE (derived automatically, never set manually).

Task fields

title, description, priority, status, creator, assigned manager, assigned team lead, assigned employee, department, team, start date, due date, estimated hours, actual hours, progress %, parent task, subtasks, dependencies, comments, attachments, activity history, completion notes, review notes, timestamps.

Core Prisma entities (verify/correct against current schema.prisma)

Organization, Department, Team, User, TeamMember, Task, TaskAssignment, TaskComment, TaskAttachment, TaskHistory, Attendance, WorkSession, LeaveRequest, LeaveBalance, PerformanceReview, Goal, Notification, PayrollRecord, Document, AuditLog Do not add models purely for complexity. Normalize appropriately. Index frequently queried fields.

API convention

Base: /api/v1/{resource} — auth, users, organizations, departments, teams, tasks, attendance, work-hours, leave, performance, goals, payroll, reports, notifications, documents, audit Standard REST verbs (GET/POST/PATCH/DELETE). Consistent { data, error } response shape. No duplicate APIs performing the same operation.

Frontend convention

{detected-frontend-dir}/src/services/*.service.ts — one file per resource. Centralized HTTP client instance with interceptors for auth token + error handling. Components call services only, never construct requests manually.

Role-specific sidebar

ADMIN: Dashboard, Organization, Departments, Teams, Employees, Tasks, Attendance, Leave, Performance, Reports, Payroll, Notifications, Documents, Audit Logs, Settings MANAGER: Dashboard, My Department, Team Leads, Tasks, Attendance, Leave, Performance, Goals, Reports, Notifications, Documents, Profile TEAM_LEAD: Dashboard, My Team, Tasks, Team Attendance, Leave Requests, Performance, Goals, Reports, Notifications, Profile EMPLOYEE: Dashboard, My Tasks, Calendar, Attendance, Work Hours, Leave, Goals, Performance, Notifications, Profile, Settings Only render options the authenticated user's role is actually authorized for.

Attendance

Flow: CHECK IN → WORKING → BREAK → RESUME → CHECK OUT Track: date, check-in, check-out, break duration, total working time, overtime, status, late arrival, early departure, WFH if supported. Statuses: PRESENT, ABSENT, LATE, HALF_DAY, LEAVE, HOLIDAY, WORK_FROM_HOME. Prevent: double check-in, check-out before check-in, editing old records without permission.

Leave management

Flow: Apply → select type → select dates → reason → submit → Team Lead review → Manager review (if required) → Approved/Rejected. Include leave types, balance, pending/approved/rejected history. Prevent overlapping leave requests. Employee cannot approve own leave.

Payroll/compensation

Organization-level compensation records, NOT a legal payroll engine. Fields: base salary, allowances, deductions, overtime, bonuses, net salary, payroll period, payslip record. Employee sees own only. Never expose salary data to unauthorized roles via any API response.

Performance & Goals

Metrics beyond task count: tasks completed/overdue, completion consistency, avg completion time, review results, attendance consistency, goals achieved. Levels: Employee, Team, Department, Organization. Review cadence: monthly/ quarterly/annual where relevant. Goals cascade: Organization → Department → Team → Employee. Fields: title, description, owner, target, deadline, progress, status, review.

Reports

Task report (total/completed/pending/overdue/completion rate), Attendance report (%, late arrivals, absences, hours), Performance report, Workload report (tasks/employee, overloaded/underutilized).

Notifications

Events: task assigned/reassigned, deadline approaching, overdue, completion submitted/approved/rejected, leave submitted/approved/rejected, announcement, attendance reminder. Notification center with unread count, read/unread state, history. Do not fake email delivery — only implement it if actually wired to a real provider.

Documents & Audit Log

Documents: task attachments, employee documents, org policies, announcements — access-controlled per role/scope. Audit log: who, action, affected entity, timestamp, metadata. Not visible to ordinary employees.

Organization settings (admin-configurable, not hardcoded)

Org name, departments, teams, roles, working hours, holidays, leave policies, task policies, notification settings, review periods.

Development seed data

Safe, dev-only seed script (never hardcoded in frontend components): 1 organization, multiple departments, managers, team leads, employees, teams, realistic task/reporting relationships. Consumed only through APIs.

UI ↔ API parity requirement

For every interactive frontend feature, verify the full chain: UI control → frontend service method → API endpoint → authentication → authorization → scope check → validation → DB operation → API response → frontend state update. Maintain this feature matrix in IMPLEMENTATION_STATUS.md, updated every phase: | Feature | UI | Service | API | DB | RBAC/Scope | E2E | No feature is COMPLETE until every column passes.

UI/UX requirements

Responsive, clean, professional, accessible, consistent spacing/typography/ components, meaningful empty/loading/error states, confirmation dialogs, toasts, search/filter/sort/pagination where needed. Avoid: excessive gradients, oversized cards, unnecessary animation, fake stats, placeholder buttons, dead navigation, duplicated UI, random colors.

Error handling

Every UI operation handles: loading, success, validation failure, unauthorized, forbidden, not found, server error, network error. User-facing messages must be friendly; never expose raw Prisma/stack errors to the UI. Log technical detail server-side.

Implementation phases

P1 Full audit — NO code changes. Output dependency chain per feature area: Feature → Database → Backend → API → Frontend → RBAC/Scope → Status. Confirm actual frontend/backend directory names. P2 Fix DB schema + org hierarchy + reporting relationships P3 Fix auth + RBAC + access-scope middleware (backend) P4 Fix task backend (services/controllers/routes) P5 Wire task frontend to real APIs, remove mocks P6 Employee profile module P7 Attendance + work hours P8 Leave management P9 Performance + goals P10 Reports/analytics P11 Notifications + comments P12 Payroll/compensation (records only, no tax engine) P13 Documents + audit log + org settings P14 Development seed data script P15 UI/UX pass (all screens — empty/loading/error states, responsiveness) P16 E2E testing (all roles) + negative/scope-violation testing

Per-phase output contract

Each phase, output ONLY:

Files changed/created (path list)
Key diffs or new file contents
Errors found + fixed (build/TS/API/DB/console)
Role + scope permissions verified this phase
Feature matrix rows updated (UI/Service/API/DB/RBAC/E2E)
One-line status: DONE | BLOCKED (+reason) No long explanations. Do not re-print this spec file. ALWAYS update /IMPLEMENTATION_STATUS.md before ending the turn — this is what makes the project resumable after a quota reset.
Scope boundaries
DO NOT touch: .env values, deployment configs, unrelated third-party integrations not listed above.
DO NOT delete data without stating why in the status file first.
DO NOT add npm packages beyond what's already in package.json unless the phase explicitly requires it — state package + reason if adding one.
DO NOT rename existing frontend/backend directories.
DO NOT overbuild: this is not a SAP/Workday replacement. Build features deep enough to be genuinely functional, not dozens of shallow screens.
Final success criteria

Frontend/backend properly integrated; DB relationships correct; hierarchy + RBAC + scope enforced server-side; role-specific UI correct; full task workflow (Manager→Team Lead→Employee, splitting, progress, review) works; attendance, work hours, leave, profiles, performance, goals, reports, notifications, basic payroll, org management, and audit logging all work; no fake UI; unauthorized actions blocked; responsive and professional UI; E2E + negative testing pass.
