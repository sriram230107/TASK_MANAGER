# Moving from one company to many

**Short answer:** yes, it is a moderate change rather than a rewrite, but only if the preparation below is
done while there is little or no production data. Today's product still runs as **one company per installation**.
Stage 2 (branch `stage-2-tenant-ready`) is adding the schema and request-scoping so a later multi-company
mode needs modest changes, not a rewrite. Do not enable `MULTI_COMPANY_ENABLED` in production until that
work is finished, reviewed, and the owner has applied the migration.

## What already helps

- `Organization` exists. After Stage 2, `organizationId` is on every business table (indexed, NOT NULL, Restrict delete) plus `OrganizationSecret`.
- The signed-in user and access token carry `organizationId`. After login the tenant always comes from the user record; client-supplied organization headers and body fields are ignored.
- The permission helpers (`hierarchy.ts`) and services check that a target belongs to the requester's organization. A fail-closed Prisma client (AsyncLocalStorage) is a second lock, not the only one.
- Organization settings (holidays, leave policy, working hours) are stored per organization. SMTP and AI secrets belong in `OrganizationSecret` (AES-256-GCM), not in settings JSON.
- Upload keys are prefixed `org/<organizationId>/<yyyy>/...`. Email uniqueness is per organization (`(organizationId, email)` plus `LOWER(email)`).

## What was missing (found by reading the schema before Stage 2)

| Gap | Detail | Stage 2 |
|---|---|---|
| **17 of 25 tables had no `organizationId`** | Only Department, Team, User, Task, Goal, Document and TaskTemplate had it. Child rows reached the organization only through a join | Schema + atomic SQL backfill with an orphan abort guard |
| **Email was globally unique** | The same person could not exist in two companies | Compound unique + expression index |
| **Queries scoped by hand** | One missed filter is a data leak | Tenant Prisma client + explicit service filters |
| **Files** | Uploads shared one folder | `org/<organizationId>/` keys (Stage 1 storage adapter) |
| **Email and AI credentials** | Environment variables only | `OrganizationSecret` table, env as fallback |
| **No company resolution** | Nothing decided which company a request belonged to | Tenant middleware; single-org default; after login, user record only |
| **Seed and bootstrap** | Assume one organization | Unchanged for single-company installs |

## Preparation (this is Stage 2)

1. **Add `organizationId` to every business table** with an index, backfilled from the parent in one atomic migration. Halt on orphans; never guess.
2. **Enforce scoping in one place:** a Prisma client that injects `organizationId` for the current request and refuses queries without a tenant except `withoutTenant()` for system jobs.
3. **Make email unique per company** (`@@unique([organizationId, email])`), and keep sign-in resolving the company first when multi-company is enabled.
4. **Prefix stored files** with `org/<organizationId>/...`.
5. **Move email and AI credentials into `OrganizationSecret`** (encrypted), with environment variables as the default fallback.
6. **Add tenant-resolution middleware.** In single-company mode it returns the only organization so nothing changes for users.
7. **Write cross-company isolation tests** (company A can never read or change company B), including files.

Optional later lock: PostgreSQL row-level security using a per-request setting (not in Stage 2).

## Verdict

| When you do it | Effort |
|---|---|
| Now, before a second company exists | Small to medium (Stage 2) |
| Later, with live data from many companies | Medium to large: backfills, downtime planning, and a security review of every query |

The workflow `.agents/workflows/tenant-ready.md` contains these steps. The approved plan is `docs/plans/stage-2-plan.md`.
