# Progress

The agent updates this file at the end of every stage. It is the source of truth, not chat memory.

## How to resume in a new conversation

Paste the "Resume prompt" from `docs/ANTIGRAVITY_PROMPT.md`.

## Stages

| # | Stage | Workflow file | Plan review | Status | Branch | Completed |
|---|---|---|---|---|---|---|
| 1 | Foundation finish | `.agents/workflows/phase-0-finish.md` | Yes | Partially complete, waiting for payroll inspection | stage-1-foundation-finish | |
| 2 | Multi-company readiness | `.agents/workflows/tenant-ready.md` | Yes | Not started | | |
| 3 | Login and identity | `.agents/workflows/phase-1-identity.md` | Yes | Not started | | |
| 4 | Modern UI, design system, 3D | `.agents/workflows/phase-2-design-system.md` | Yes (design plan) | Not started | | |
| 5 | Task engine v2 | `.agents/workflows/phase-3-task-engine.md` | Yes (data migration) | Not started | | |
| 6 | AI foundation | `.agents/workflows/phase-4-ai-foundation.md` | Yes | Not started | | |
| 7 | Projects, clients, timesheets | `.agents/workflows/phase-5-business-layer.md` | No | Not started | | |
| 8 | Collaboration | `.agents/workflows/phase-5b-collaboration.md` | No | Not started | | |
| 9 | CRM-lite (optional) | `.agents/workflows/phase-5c-crm-lite.md` | No (may skip) | Not started | | |
| 10 | HR modernization | `.agents/workflows/phase-6-hr-modernization.md` | Yes | Not started | | |
| 11 | Advanced AI | `.agents/workflows/phase-7-ai-advanced.md` | Yes | Not started | | |
| 12 | Scale and open platform | `.agents/workflows/phase-8-scale.md` | No | Not started | | |

## Baseline (filled in by the Stage 1 preflight)

| Check | Result |
|---|---|
| Node and npm versions | Node v24.16.0, npm 11.13.0 |
| `npm --prefix backend run typecheck` | Pass (exit code 0) |
| `npm --prefix backend run build` | Pass (exit code 0) |
| `npm --prefix frontend run build` | Pass (exit code 0, client bundle built in 2.47s) |
| `npm --prefix frontend run lint` (12 existing warnings are expected) | Pass (exit code 0, 12 warnings, 0 errors) |
| `docker compose config` | Not available (Docker not installed in local environment) |

## Decisions made

| Date | Stage | Decision | Decided by |
|---|---|---|---|
| 2026-09-20 | 1 | Timezone: UTC schema/code default, Asia/Kolkata for existing org stored in Organization.settings JSON; Storage: local; Test DB: user-managed (*_test via TEST_DATABASE_URL) | User |
| 2026-09-20 | 1 | Defer S3 storage driver (@aws-sdk/client-s3) since local storage is active. Storage adapter interface created with local driver; S3 deferred until cloud storage is requested. | User |
| 2026-09-20 | 5 | Preserve PROJECT_SPEC.md task lifecycle (DRAFT, ASSIGNED, ACCEPTED, IN_PROGRESS, ON_HOLD, SUBMITTED, UNDER_REVIEW, COMPLETED, CHANGES_REQUESTED, CANCELLED; OVERDUE derived). No reduction to 8 statuses. | User |

## Backlog and known issues

| Found in stage | Issue | Severity | Status |
|---|---|---|---|
| Stage 1 preflight | Phase 16 unverified test suite claim documented in IMPLEMENTATION_STATUS.md | Low | Resolved by Stage 1 automated test harness |
| Stage 1 | pg client.query deprecation warning in tests | Low | Open |
| Stage 1 | Thin test coverage for hierarchy and task status (one test each) | Low | Open |
| Stage 1 | Decimal money migration is waiting for real payroll inspection numbers and MUST be done before Stage 10 (HR modernization) | Medium | Open |
| Stage 1 | CI workflow has never been run | Low | Open |
| Stage 1 | Docker has not been tested | Low | Open |

## Stage reports

### Stage 1 Report: Foundation finish

**What changed**
1. **Baselined Database Migration:** Executed `npm run db:baseline` creating `prisma/migrations/0_init/migration.sql` capturing the active database schema cleanly without modifying existing production tables.
2. **Structured Logging (Pino):** Added `pino` and `pino-http` in `backend/src/utils/logger.ts`, mounted in `backend/src/app.ts`. Configured automatic UUID request ID generation and strict redaction of credentials (`*.password`, `*.token`, `*.secret`, `*.email`, authorization/cookie headers).
3. **Storage Adapter & Security:** Created `StorageDriver` interface and `LocalStorageDriver` (`backend/src/services/storage/local.driver.ts`) with path-traversal prevention. Built content-based binary magic bytes sniffer (`magic-bytes.ts`) with strict allow-list (PDF, PNG, JPEG, WEBP, TXT, CSV, DOC, DOCX) rejecting executables (PE, ELF, Mach-O) and explicitly blocking HTML and SVG script execution risks. Secured document and task download endpoints against directory traversal, and set `Content-Disposition: attachment` for non-images (everything except PNG, JPEG, WEBP).
4. **Timezone Support:** Implemented native `Intl.DateTimeFormat` validation (`backend/src/utils/timezone.ts`), setting UTC as system/schema default. Timezone is stored cleanly in `Organization.settings` JSON without schema column modifications. Created `backend/scripts/backfill-timezone.ts` (dry-run by default, writes only with `--apply`) to assign `Asia/Kolkata` to the existing organization. Added `--timezone` flag to `prisma/bootstrap.ts`.
5. **Credential Safety on `req.user`:** Updated `auth.middleware.ts` to omit `passwordHash` when selecting user from the database. Added automated test verifying `req.user.passwordHash` is `undefined`.
6. **Isolated Test Harness:** Configured Vitest in `backend/vitest.config.mts` with strict database isolation guard in `backend/src/__tests__/setup.ts`. Created `backend/scripts/prepare-test-db.mjs` ensuring tests only target localhost `*_test` databases.
7. **Automated Integration Tests:** Implemented 24 tests across 6 suites (`auth.test.ts`, `hierarchy.test.ts`, `task-status.test.ts`, `payroll.test.ts`, `timezone.test.ts`, `storage.test.ts`), covering role scoping, task transitions, token rotation, timezone settings persistence, and storage safety.
8. **Float to Decimal Migration Verification:** Built `backend/scripts/test-decimal-migration.mjs` verifying that migrating `PayrollRecord` Float columns to `DECIMAL(12, 2)` preserves edge-case numbers with zero precision loss.
9. **CI Pipeline:** Created `.github/workflows/ci.yml` targeting `master` and `stage-*` branches to run typecheck, build, lint, and isolated test database suites on Ubuntu with Postgres 16.

**How to run and try it**
- Run test database setup: `npm --prefix backend run test:db:prepare`
- Run test suite: `npm --prefix backend run test`
- Run decimal migration test on test DB: `npm --prefix backend run test:migration:decimal`
- Run typecheck: `npm --prefix backend run typecheck`
- Run backend build: `npm --prefix backend run build`
- Run frontend build: `npm --prefix frontend run build`
- Run frontend lint: `npm --prefix frontend run lint`

**Verification evidence**
- `npm --prefix backend run typecheck`: Exit code 0 (zero errors).
- `npm --prefix backend run build`: Exit code 0 (`tsc -p tsconfig.json` complete).
- `npm --prefix backend run test`: Exit code 0 (6 test files passed, 24 of 24 tests passed).
- `npm --prefix backend run test:migration:decimal`: Exit code 0 (synthetic dataset edge cases verified before and after Decimal conversion with 0 errors).
- `npm --prefix frontend run build`: Exit code 0 (Vite client bundle built in 533ms).
- `npm --prefix frontend run lint`: Exit code 0 (0 errors, 12 expected hook warnings).

**NOT verified and why**
- The CI workflow was never run (remote GitHub Actions environment has not been triggered yet).
- Real payroll data has not been inspected (waiting for developer's read-only inspection query outputs).
- Decimal migration has only been simulated with synthetic values (real database migration will be written once real payroll values are inspected).
- Docker has not been tested / container startup: Docker engine is not installed/running in this local Windows environment.
- Live browser screenshots: UI was unchanged in this backend foundation stage; browser testing is deferred to UI phases (Phase 2).
- Applying migrations to real `DATABASE_URL`: Per user rule, migrations are never applied to the developer's real database by the agent.

**Risks and follow-ups**
- The developer should execute the provided read-only SQL inspection queries on their real database to verify payroll ranges before applying any Decimal migration.
- Once cloud storage is required, `@aws-sdk/client-s3` can be plugged directly into the `StorageDriver` interface.

**How to roll back**
- To roll back this stage, revert the git branch: run `git checkout master` then `git branch -D stage-1-foundation-finish`.

**Decisions I need to make**
- Execute the read-only payroll SQL queries on your real database and review the results when convenient.
