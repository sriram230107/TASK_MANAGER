---
description: Finish Phase 0 foundation (migrations, storage adapter, Decimal money, timezone, tests, CI, logging)
---
# Phase 0: finish the foundation

Context: read `AGENTS.md`, `README.md`, `docs/ROADMAP.md` ("Phase 0 status"). Much of Phase 0 is already done
(config, helmet, rate limits, error handler, Docker, bootstrap). Do only the remaining items below.
Start by writing an implementation plan and wait for my approval.

## Steps

1. **Baseline migration.** Run `npm run db:baseline` in `backend/` (needs internet). Verify it on a **throwaway empty database only**: apply the migrations (`npm run db:deploy`), then confirm the database matches `schema.prisma` with
   `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code` (exit code 0 means no difference). Check `prisma/migrations`
   and the Prisma CLI docs for exact flags in this Prisma version rather than guessing.
   Update the Docker entrypoint note in the README if behavior changes.
2. **Storage adapter.** Create `src/services/storage/` with an interface `StorageDriver { save, getStream, delete }`
   and two drivers: `local` (uses `config.UPLOAD_DIR`) and `s3` (`@aws-sdk/client-s3`; add `S3_*` settings to `config/env.ts`,
   `.env.example`, `docker-compose.yml`). Keys look like `org/<organizationId>/<yyyy>/<uuid>-<safe-name>`.
   Replace the direct multer `diskStorage` in `task.routes.ts` and `document.routes.ts` with memory storage plus the adapter.
   Validate files by **magic bytes** (`file-type` package) against an allow-list, not by client MIME type. Serve downloads only through an
   authenticated endpoint that re-checks access. Migrate existing `fileUrl` values without breaking old files.
3. **Money as Decimal.** Change `PayrollRecord` money fields from `Float` to `Decimal(12,2)`. Write the migration, update `payroll.service.ts`
   arithmetic (use `Prisma.Decimal`), update serializers so the API still returns numbers or strings consistently, and add unit tests
   for rounding, overtime and net pay.
4. **Timezone.** Add `Organization.timezone` (IANA, default `UTC`, editable in settings and set by `bootstrap`). Compute "the day" for attendance,
   overdue scans and reports in that timezone (use `date-fns-tz`). Add tests around midnight and daylight saving.
5. **`req.user` without secrets.** Ensure `passwordHash` is never loaded into `req.user` (select explicitly) or returned by any endpoint.
6. **Structured logging.** Add `pino` with request ids and redaction of `authorization`, cookies, `password`, tokens. Replace `console.*` in services and middleware.
7. **Tests.** Set up Vitest and Supertest with a test database (docker compose service or `TEST_DATABASE_URL`). Write first tests for:
   login (wrong password, unknown email, case-insensitive email, lockout of the failed-login limiter), refresh rotation, the RBAC permission matrix per role,
   hierarchy scoping (team lead cannot read another team), and task status transitions for each role.
8. **CI.** Add `.github/workflows/ci.yml`: install, typecheck, build, test for backend; install, lint, build for frontend; `docker compose config` validation.
9. **Frontend build hygiene.** Enable route-level code splitting later (Phase 2); for now only make sure the build is warning-free apart from chunk size.

## Acceptance criteria

- `npm run typecheck`, `npm run build`, `npm test` pass in `backend/`; `npm run build` and `npm run lint` pass in `frontend/`.
- A fresh `docker compose up -d --build` followed by `bootstrap` gives a working portal; upgrading an existing database applies migrations with no data loss.
- No `Float` money fields remain; no client-supplied MIME type is trusted; `passwordHash` never leaves the database layer.
- Report anything you could not verify, then run `/verify-phase`.
