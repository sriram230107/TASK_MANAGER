# Roadmap

Sizes are relative (S, M, L, XL). Phases depend on the ones before them. Each has a matching Antigravity
workflow in `.agents/workflows/` (run it by typing `/name` in the agent chat).

| Phase | Workflow | Focus | Size | Status |
|---|---|---|---|---|
| 0 | `/phase-0-finish` | Foundation: config, Docker, bootstrap, security basics, migrations, storage adapter, Decimal money, timezone, tests, CI | M | Partial (Stage 1): Decimal payroll migration still waiting for inspection numbers |
| 1 | `/phase-1-identity` | Invite onboarding, password reset, lockout, 2FA, SSO, sessions, cookie-only auth, email service | L | Planned |
| 2 | `/phase-2-design-system` | New UI: design system, theming and branding, real routing, command palette, accessibility, PWA, i18n, 3D | L | Planned |
| 3 | `/phase-3-task-engine` | Task model v2, Kanban, calendar, timeline, task drawer, recurring, automation, real-time | XL | Planned |
| 4 | `/phase-4-ai-foundation` | AI gateway, guardrails, natural-language tasks, breakdown, summaries, semantic search | M | Planned |
| 5 | `/phase-5-business-layer` | Projects, clients, timesheets, workload | L | Planned |
| 5b | `/phase-5b-collaboration` | Company feed, chat, shared calendar and room booking, approvals, knowledge base | L | Planned (needs Phase 3) |
| 5c | `/phase-5c-crm-lite` | Optional CRM: contacts, companies, leads, deals, pipelines, forms, funnel reports | L | Planned, optional |
| 6 | `/phase-6-hr-modernization` | Leave calendar, attendance, payslips with configurable rules, goals and reviews, document versioning | L | Planned |
| 7 | `/phase-7-ai-advanced` | Assistant chat, risk prediction, smart assignment, reports in plain language, review drafting, anomaly flags | L | Planned |
| 8 | `/phase-8-scale` | Caching, monitoring, backups, load tests, webhooks, public API, push | M | Planned |
| any | `/tenant-ready` | Preparation for many companies (see `docs/MULTI_COMPANY_READINESS.md`) | M | In progress (Stage 2, branch stage-2-tenant-ready) |
| any | `/verify-phase` | Checklist to run at the end of every phase | S | Ready |

## Phase 0 status

**Not complete.** Stage 1 delivered the items below, but the Float to Decimal payroll migration is still waiting for the owner's inspection numbers and must be done before Stage 10. Do not treat Phase 0 as finished.

Delivered in Stage 1:
- Baselined migration `0_init` created with `npm run db:baseline`.
- Storage adapter (`LocalStorageDriver`) with content-based binary magic bytes inspection (`magic-bytes.ts`) rejecting executables (PE, ELF, Mach-O), and path-traversal guard.
- Legacy download paths secured inside `UPLOAD_DIR`, sending `Content-Disposition: attachment` for non-images.
- Organization IANA timezone validation with native `Intl`, UTC code default, Asia/Kolkata backfill script for existing org, and `--timezone` bootstrap flag.
- Test database isolation harness targeting `portal_test` exclusively via `TEST_DATABASE_URL` with live `SELECT current_database()` verification.
- 24 Vitest automated integration tests across auth, hierarchy, task status transitions, storage, timezone, and payroll.
- Synthetic Float to Decimal migration tested on `portal_test` with zero data loss.
- GitHub Actions CI pipeline (`.github/workflows/ci.yml`).
- Structured logging with Pino, strict redaction of sensitive credentials, and `pino-http` request tracking.
- Excluded `passwordHash` from `req.user` in auth middleware and verified with automated test.

## AI features by phase

| Feature | Phase | Risk |
|---|---|---|
| Natural-language task creation, task breakdown, summaries and digests, semantic search, duplicate detection | 4 | Low |
| Policy assistant with confirmed actions, deadline risk prediction, assignee suggestions | 7 | Medium |
| Workload signals, plain-language reports | 7 | Medium |
| Review drafting, anomaly flags in attendance, audit and payroll | 7 | High (human decides, always) |

## AI guardrails (apply to every AI feature)

1. The AI acts **as the signed-in user**, through the same services and permission checks. Never a service account.
2. Any write is a **proposal** the user confirms.
3. Payroll, salary, confidential documents and performance reviews are **excluded by default**; an admin enables them per feature.
4. AI never approves leave, sets ratings or changes pay. It drafts and suggests; a person decides.
5. Comments, documents and uploaded text are **untrusted input**. They can never trigger a tool call on their own.
6. Every call is logged (user, feature, model, tokens, cost). Budget caps, per-feature switches and a global kill switch exist.
7. Each feature ships with test cases against a mocked provider.
