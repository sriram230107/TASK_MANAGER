# Moving from one company to many

**Short answer:** yes, it is a moderate change rather than a rewrite, but only if the preparation below is
done while there is little or no production data. Today's code is single-company by design, and it is *partly* ready.

## What already helps

- `Organization` exists, and `organizationId` is on the tables that matter most.
- The signed-in user and access token carry `organizationId`.
- The permission helpers (`hierarchy.ts`) and most services already check that a target belongs to the requester's organization.
- Organization settings (holidays, leave policy, working hours) are stored per organization.

## What is missing (found by reading the schema)

| Gap | Detail |
|---|---|
| **18 of 25 tables have no `organizationId`** | Only Department, Team, User, Task, Goal, Document and TaskTemplate have it. Attendance, LeaveRequest, LeaveBalance, PerformanceReview, PayrollRecord, Notification, AuditLog, ActivityLog, RefreshToken, TaskComment, TaskHistory, and others reach the organization only through a user join. That makes isolation easy to get wrong and impossible to enforce in one place |
| **Email is globally unique** | The same person cannot exist in two companies, and one company can block another's address |
| **Queries scope by hand** | Each query must remember `organizationId`. One missed filter is a data leak between companies |
| **Files** | Uploads share one folder, with no per-company prefix |
| **Email and AI credentials** | Read from environment variables, so one set for the whole installation |
| **No company resolution** | Nothing decides which company a request belongs to (subdomain, domain, header) |
| **Seed and bootstrap** | Assume one organization |

## Preparation to do now (small while data is small)

1. **Add `organizationId` to every business table** with an index, backfilled from the user or owner. Denormalized on purpose.
2. **Enforce scoping in one place:** a Prisma client extension that injects `organizationId` into every query for the current request. Optionally add PostgreSQL row-level security as a second lock.
3. **Make email unique per company** (`@@unique([organizationId, email])`), and keep sign-in resolving the company first.
4. **Prefix stored files** with `org/<organizationId>/...` in the storage adapter.
5. **Move email and AI credentials into a per-company settings table** (secrets encrypted), with environment variables as the default.
6. **Add a tenant resolver** middleware. In single-company mode it always returns the only organization, so behaviour does not change today.
7. **Write cross-company isolation tests** (company A can never read or change company B). These are the safety net for every later change.

## Verdict

| When you do it | Effort |
|---|---|
| Now, before real data exists | Small to medium |
| Later, with live data | Medium to large: backfills, downtime planning, and a security review of every query |

The Antigravity workflow `/tenant-ready` (in `.agents/workflows/`) contains these steps as an executable prompt.
