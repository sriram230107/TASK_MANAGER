---
description: Prepare the codebase so it can serve many companies later (still runs as one company today)
---
# Prepare for multiple companies

Read `docs/MULTI_COMPANY_READINESS.md` and `AGENTS.md`. Behavior for a single company must not change. Write an implementation plan first and wait for approval.

## Steps

1. Add `organizationId` (indexed, NOT NULL after backfill) to every business table that lacks it (18 of 25 at the time of writing; re-check the schema). Backfill from the owning user or parent. Idempotent script plus verification counts.
2. Add a Prisma client extension that injects `organizationId` into all reads and writes for the current request, and refuses queries without one except in an explicit `withoutTenant()` for system jobs. Route every service through it.
3. Change email uniqueness to `@@unique([organizationId, email])`. Sign-in resolves the company first (subdomain, custom domain or an organization code), then the user.
4. Prefix stored files with `org/<organizationId>/` (storage adapter) and migrate existing keys.
5. Move SMTP and AI credentials into a per-organization settings table (secrets encrypted), with environment variables as the default fallback.
6. Add tenant-resolution middleware. In single-company mode it returns the only organization so nothing changes for users.
7. Write **cross-company isolation tests**: for every route, company A can never read, list, update or delete company B's data, including files, notifications and AI proposals. Run them in CI.
8. Optional second lock: PostgreSQL row-level security using a per-request setting.

## Acceptance criteria

All isolation tests pass; single-company installs behave identically; bootstrap can create additional organizations only when an explicit multi-company flag is enabled. Run `/verify-phase`.
