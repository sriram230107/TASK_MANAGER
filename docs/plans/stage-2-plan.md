# Stage 2 plan: multi-company readiness

Approved by the owner (PLAN REVIEW) with the ten amendments below. Later continue-session additions are listed at the end. Branch: `stage-2-tenant-ready`.

## Approved plan, in short

- Add `organizationId` (indexed, NOT NULL, foreign key) to the 17 tables that lack it: TeamMember, TaskAssignment, TaskUpdate, TaskComment, TaskAttachment, TaskHistory, RecurrenceRule, Attendance, WorkSession, LeaveRequest, LeaveBalance, PerformanceReview, PayrollRecord, Notification, AuditLog, ActivityLog, RefreshToken. Add the new `OrganizationSecret` table (`organizationId`, `key`, `valueEncrypted`, `keyVersion`, unique per organization and key).
- Tenant scoping through a Prisma client extension: `findUnique` and `findUniqueOrThrow` become tenant-scoped `findFirst`; `create` and `createMany` inject `organizationId`; `update`, `updateMany`, `delete`, `deleteMany`, `upsert`, `count`, `aggregate` and `groupBy` inject it into `where`; `$queryRaw` and `$executeRaw` are blocked on the tenant client; `withoutTenant()` is the explicit bypass for jobs. The extension is a failsafe, not the only defence: services also scope explicitly.
- Tenant middleware: with `MULTI_COMPANY_ENABLED=false` it resolves the single organization (cached), returns HTTP 503 "run npm run bootstrap" when there are zero organizations, and fails fast with HTTP 500 when there is more than one. With true it uses `req.user.organizationId` after login and ignores client input.
- Email: unique `(organizationId, email)` plus a unique expression index on `(organizationId, LOWER(email))`; emails normalised to lowercase on input.
- Secrets: `ENCRYPTION_KEY` required in production (64 hex characters), an explicit test key in tests, and in development an unset key only errors when something is encrypted or decrypted. `GET /api/v1/settings/integrations` returns only `{ smtpConfigured, aiConfigured }`. No response, log or audit payload ever contains a secret.
- Background jobs (`backend/src/cron/overdueScan.ts`) iterate every organization through `withoutTenant()`; notifications carry `organizationId`.
- Tests: a tenant-isolation suite with two organizations in `portal_test` covering all 16 route files (admin, attendance, audit, auth, dashboard, document, goal, leave, notification, payroll, performance, report, settings, task, template, user), file downloads, integration secrets, and the email index. All earlier tests must keep passing.
- Rollback: honest about Phase A (before a second company exists) versus Phase B (afterwards, needs a database restore).

## Tenant resolution (owner answers)

1. NEVER trust a client-supplied organization header or body field (`PROJECT_SPEC.md` forbids it). Default `MULTI_COMPANY_ENABLED=false`. In multi-company mode a company code or subdomain is used ONLY before login to choose which company is being signed into; after login the tenant always comes from the authenticated user's record.
2. `AuditLog.organizationId` is strictly NOT NULL. Background jobs iterate per organization. Global events go to the pino application log, not AuditLog.
3. Per-company SMTP and AI credentials go in a dedicated `OrganizationSecret` table (not the settings JSON). Write-only through the API, AES-256-GCM with a key from an environment variable.

## How each organizationId is derived (backfill)

| Table | Source |
|---|---|
| TeamMember | `Team.organizationId` via `teamId` |
| TaskAssignment, TaskUpdate, TaskComment, TaskAttachment, TaskHistory, RecurrenceRule | `Task.organizationId` via `taskId` |
| Attendance | `User.organizationId` via `userId` |
| WorkSession | `Attendance.organizationId` via `attendanceId` (after Attendance is backfilled) |
| LeaveRequest | `User.organizationId` via `employeeId` |
| LeaveBalance | `User.organizationId` via `userId` |
| PerformanceReview | `User.organizationId` via `employeeId` (never from `reviewerId`) |
| PayrollRecord | `User.organizationId` via `employeeId` |
| Notification | `User.organizationId` via `userId` |
| AuditLog | `User.organizationId` via `userId` when the user exists. Rows with NULL `userId` or a dangling `userId` abort the migration; never guess. |
| ActivityLog | `User.organizationId` via `userId` |
| RefreshToken | `User.organizationId` via `userId` |

Orphans are not only AuditLog. Halt and report for dangling `LeaveRequest.employeeId`, `PerformanceReview.employeeId` and `reviewerId`, `ActivityLog.userId`, `AuditLog.userId`, and every other unconstrained ID column. Never guess, never delete.

## Amendments required by the owner (all must be done)

1. The owner applies migrations with a single `prisma migrate deploy`, which runs pending migrations back to back, so a manual backfill between two migrations cannot work. Make the migration self-contained and atomic: add nullable columns, backfill in SQL through each table's parent, a guard (DO block that raises an exception if any `organizationId` is still NULL, including AuditLog NULL-user rows), then SET NOT NULL, foreign keys and indexes. If the guard fails everything rolls back with a clear message. Keep `backfill-organization-id.ts` only as a dry-run report tool. Test it on `portal_test`, including a run that must fail cleanly because of an orphan row.
2. Orphans are not only AuditLog. Halt and report for all unconstrained IDs (never guess, never delete). List table by table how each `organizationId` is derived (table above).
3. Fail closed: export a scoped prisma that reads the tenant from AsyncLocalStorage and throws when there is no tenant context. Scope the Organization model itself (`id` = tenant). Test the `$transaction` call sites. Add a test that fails if any file outside the tenant module imports the unscoped client.
4. `admin.validator.ts` `teamSchema` must not require a client-supplied `organizationId`. Grep the other validators. Test that `organizationId` in any body, query or header is ignored. Auth refresh and logout take the tenant from the refresh token's user.
5. Client-supplied IDs that reference other records (`assignedToId`, `departmentId`, `teamId`, `parentTaskId`, the dependencies string array) must be verified to belong to the caller's organization. List each and test with cross-tenant IDs.
6. Email: drop the existing global `@unique` on `User.email`, lowercase existing emails in the migration (only valid after the collision pre-check passes), and prove with `prisma migrate diff` that Prisma will not try to drop the `LOWER(email)` index later.
7. Use `onDelete: Restrict`, not Cascade, for `organizationId` foreign keys (`OrganizationSecret` may cascade). Deleting an organization must never silently wipe payroll and audit data.
8. Commit real down-migration SQL files under `prisma/rollbacks/` (Prisma has none), tested on `portal_test`.
9. Secrets: ADMIN-only write, a `keyVersion` column for key rotation, `ENCRYPTION_KEY` and `MULTI_COMPANY_ENABLED` added to `.env.example` and `docker-compose.yml`.
10. Do not claim anything about which database earlier manual SQL checks ran against.

## Continue-session additions (2026-09-21)

1. Do not rewrite history or amend the WIP snapshot commit. Commit on top of it.
2. AuditLog NULL-user rows: the migration must never assign or guess. It aborts with a clear message. The dry-run script may reassign ONLY with an explicit `--system-org-id` plus a `--confirm-count` matching the exact number of rows, and the owner runs it before `migrate deploy`. Add `reviewerId` and every other unconstrained ID column to the orphan report.
3. Prove AsyncLocalStorage tenant context cannot bleed between requests (parallel interleaved requests from two organizations with artificial delays in async handlers and inside a `$transaction`). The import scanner must flag any import of the unscoped client outside the tenant module, not only `new PrismaClient()`.
4. Explain how `portal_test` already has the new schema by reading `_prisma_migrations` through the guarded test harness (read-only).
5. Docs: correct PROGRESS, ROADMAP (Phase 0 is not complete because Decimal is pending), MULTI_COMPANY_READINESS, and AGENTS.md (Node 22 or newer). Do not delete IMPLEMENTATION_STATUS text; add a dated note that COMPLETE claims are unverified and record the real test count.
6. Response format: `PROJECT_SPEC.md` says `{ data, error }` and it wins. Correct AGENTS.md rule 9. Add no new envelope fields.
7. Also complete: `ENCRYPTION_KEY` 64-hex enforcement in production, a `teamId` cross-tenant test, HTML and SVG rejection tests, GIF not served inline, and all 16 route files plus file downloads in the isolation suite.
8. Stage report must include paths of final migration SQL and down SQL, plus the read-only pre-check SQL for the real database.

## Files

- Schema and SQL: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20260921120000_multi_company_readiness/migration.sql`, `backend/prisma/rollbacks/down_20260921120000_multi_company_readiness.sql`
- Tenant: `backend/src/utils/tenant.prisma.ts`, `backend/src/utils/prisma.ts`, `backend/src/middleware/tenant.middleware.ts`
- Secrets: `backend/src/utils/crypto.ts`, `backend/src/services/secret.service.ts`
- Scripts: `backend/scripts/backfill-organization-id.ts` (dry-run), `backend/scripts/test-multi-company-migration.mjs` (`portal_test` only)
- Tests: `backend/src/__tests__/tenant-isolation.test.ts` and existing suites

## Risks

- Applying the migration to a database with orphan rows aborts; the owner must run the pre-check SQL first.
- Phase B rollback (after a second company exists) needs a database restore, not only the down SQL.
- Decimal payroll migration is out of scope and still waiting for inspection numbers.

## Tests

Isolation for 16 route files, file downloads, secrets, email uniqueness, ALS non-bleed, `$transaction`, import scanner, HTML/SVG, GIF attachment disposition, `teamId` cross-tenant, migration orphan abort + down SQL on `portal_test`.

## Rollback

- Phase A (single company, before a second org): apply `backend/prisma/rollbacks/down_20260921120000_multi_company_readiness.sql` on a copy first, then the real database if needed; restore global `User.email` unique.
- Phase B (two or more companies): down SQL would violate the restored global email unique index; restore from backup.
