# Resume state (handover from the previous tool)

Saved 2026-09-21 from the owner's resume prompt. Git and `docs/PROGRESS.md` remain the source of truth. This file is a snapshot of what the previous session claimed; verify against the repository.

## WHERE WE ARE (from the previous tool's session; verify against git and the code)

Stage 1, Foundation finish: finished and committed in 8 commits on branch `stage-1-foundation-finish` (baseline migration `0_init`, pino logging with redaction, storage driver with path-traversal guards and content sniffing, organization timezone, `req.user` without `passwordHash`, Vitest and Supertest with an isolated `portal_test` harness, CI workflow). 24 tests passed at that point.

Stage 2, Multi-company readiness (PLAN REVIEW): the plan was approved by the owner WITH the amendments listed in `docs/plans/stage-2-plan.md`, on branch `stage-2-tenant-ready` (created from the last Stage 1 commit). Implementation amount was unknown at handover; a WIP snapshot of uncommitted Stage 2 code was later committed as `f42d714` (message `...`). Do not rewrite or amend that commit.

Stage 1 items that were NEVER confirmed (verify each; fix gaps as `fix(stage-1): ...`):

- (a) Upload validation is an ALLOW-LIST (PDF, PNG, JPEG, WEBP, TXT, CSV, DOC, DOCX) by file content, not a deny-list of executables. HTML and SVG uploads are rejected. Everything except PNG, JPEG and WEBP is served as an attachment. An `.exe` renamed to `.pdf` is rejected (there is a test).
- (b) Document and task upload routes use the storage adapter with keys `org/<organizationId>/<yyyy>/<uuid>-<safe-name>`. `GET /api/v1/documents/:id/download` was extended, not duplicated.
- (c) `backend/scripts/backfill-timezone.ts` dry-runs by default and only writes with `--apply`. No organization name is hardcoded.
- (d) README documents how to create `portal_test`, how `TEST_DATABASE_URL` is set, and how to upgrade a real database.

## Decisions already made

See `docs/PROGRESS.md` under Decisions. Highlights:

- Timezone lives in `Organization.settings` JSON (`settings.timezone`). Code default UTC. This installation's organization is `Asia/Kolkata` via the backfill script. Bootstrap accepts `--timezone`.
- Storage driver: local. S3 is deferred; `@aws-sdk/client-s3` is not added yet.
- Test database: `portal_test`, created by the owner. `TEST_DATABASE_URL` is in `backend/.env`. Agents never read `.env` and never run `CREATE DATABASE`.
- The Float to Decimal payroll migration is NOT done. It waits for payroll inspection numbers. It MUST be done before Stage 10. Do not generate it until those numbers are sent.
- Stage 5 must preserve the task lifecycle in `PROJECT_SPEC.md` (DRAFT, ASSIGNED, ACCEPTED, IN_PROGRESS, ON_HOLD, SUBMITTED, UNDER_REVIEW, COMPLETED, CHANGES_REQUESTED, CANCELLED; OVERDUE is derived). Do not collapse statuses.
- Backlog: pg `client.query` deprecation warning in tests; thin hierarchy and task-status tests; CI workflow never run; Docker never tested (not installed).
- `IMPLEMENTATION_STATUS.md` claims 83 passing tests but no such test files existed at Stage 1 start. Treat its COMPLETE claims as unverified.

## Pending from the owner (do not wait to continue coding; do not apply any migration)

Read-only pre-check results (organization count must be 1, email collisions, orphan rows) and the payroll inspection numbers. Pre-check SQL belongs in the Stage 2 report. The owner applies migrations to the real database after reviewing the SQL.
