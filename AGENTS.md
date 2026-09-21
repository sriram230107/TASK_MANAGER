# AGENTS.md: standing instructions for AI coding agents

Read this first on every task. Longer material lives in `README.md` and `docs/`.

## What this project is

A self-hosted **company portal** (tasks with review workflow, attendance, leave, performance, payroll,
documents, reports, audit). **One company per installation today**, built so it can later serve many
(`docs/MULTI_COMPANY_READINESS.md`). Portable means: any company installs it and configures it with
environment variables and admin settings, with **no code changes**.

## Owner's own documents

`PROJECT_SPEC.md` and `IMPLEMENTATION_STATUS.md` in the project root are the owner's notes on requirements and current status. Read them at the start of every stage.
If they conflict with this file, `docs/ROADMAP.md` or a workflow, stop and show the conflict to the owner before working.

## Stack and layout

- `backend/` Node 22 or newer, Express 5, TypeScript (CommonJS), Prisma 7 with `@prisma/adapter-pg`, PostgreSQL, zod 4
  - `src/config/env.ts` the only place that reads `process.env` (new code must use `config`)
  - `src/routes` then `src/controllers` then `src/services` then Prisma. Validators in `src/validators` (zod)
  - `src/middleware` (`auth`, `rbac`, `error`), `src/utils` (`hierarchy`, `cookies`, `tokens`, `response`)
  - `prisma/schema.prisma`, `prisma/bootstrap.ts` (first run), `prisma/seed.ts` (destructive demo data)
- `frontend/` React 19.2.x, Vite, TypeScript, axios, three.js with @react-three/fiber
  - `src/config.ts` runtime config, `src/services` API clients, `src/pages`, `src/components`
- `docker-compose.yml`: db (pgvector), api, web (nginx, proxies `/api`), optional mailpit

## Commands

```
backend:  npm run typecheck | build | dev | bootstrap | seed:demo | db:baseline | db:deploy
frontend: npm run build | dev | lint
all:      docker compose up -d --build
```
Before any task is called done: backend `typecheck` and `build` pass; frontend `build` (it runs `tsc`) and `lint` pass.
The backend `test` script is a placeholder until tests are added in Stage 1. Use `npm --prefix backend <script>` and `npm --prefix frontend <script>`; do not chain commands with `&&` (the developer uses Windows PowerShell 5.1).
`prisma generate` needs internet access to download an engine; if it fails offline, say so and continue.

## Hard rules

1. **Never** edit or print `.env` files or secrets. Add new settings to `config/env.ts` **and** `.env.example` **and** `docker-compose.yml`.
2. **Never** run `seed:demo`, `prisma migrate reset`, `db push --accept-data-loss` or delete data on anything but a throwaway local database.
3. **Permissions:** every route uses `authenticate` and `authorize(resource, action)`. Data access goes through the hierarchy helpers. New tables carry `organizationId`.
4. **Money** is `Decimal`, never `Float`. **Dates** are stored in UTC; anything "per day" uses the organization's IANA timezone.
5. **Secrets and tokens** are stored hashed (refresh, invite, reset tokens). Compare in constant time. Never log tokens, passwords or emails in bulk.
6. **Errors** use `errorResponse` and never expose internals. Do not catch and rethrow raw `error.message` from unexpected failures.
7. **Uploads** are validated by content (magic bytes), not by client MIME type, and go through the storage adapter once it exists.
8. **Schema changes** are additive and reversible where possible, delivered as a Prisma migration plus a backfill script that is safe to run twice. Explain data-loss risk before proposing anything destructive.
9. Keep API responses in the `{ data, error }` envelope (`PROJECT_SPEC.md`). Do not add new envelope fields. `backend/src/utils/response.ts` already includes optional `meta` on success and a top-level `message` plus spread of `data` for older clients; do not add more.
10. Do not add a dependency without saying why, and check it supports React 19.2 and Node 22 or newer first.

## AI features (when built)

Follow `docs/ROADMAP.md` "AI guardrails" exactly. In short: AI runs as the signed-in user, writes are confirmed
proposals, sensitive data classes are excluded by default, content is untrusted, everything is audited and
budget-capped, and AI never makes HR decisions. All AI code sits behind `config.aiEnabled`; the app must work
fully with `AI_PROVIDER=none`. Likewise all email code sits behind `config.emailEnabled` with a sensible fallback.

## Frontend and design

- Replace inline `style={{}}` with the design system as pages are migrated. Do not add new inline styles.
- Every page gets a real URL. Data fetching uses TanStack Query once introduced (Phase 2), not ad hoc `useEffect`.
- Accessibility floor: keyboard reachable, visible focus, labelled controls, WCAG AA contrast, `prefers-reduced-motion` respected.
- Copy: sentence case, plain verbs, errors say what happened and how to fix it. No `alert()` or `confirm()`.
- Design with intent: pick a distinctive type pairing and palette for this product. Avoid the generic template look
  (identical rounded cards, gradient washes, all-caps labels, motion on every element). Spend boldness in one place.
- **3D rules:** 3D is decoration or insight, never required to use the product.
  - Always lazy-loaded, behind an error boundary, with a 2D/no-3D fallback.
  - Skip or freeze on no WebGL, `prefers-reduced-motion`, data saver and low-power devices.
  - Budget: the 3D chunk stays under about 250 KB gzipped, target 60 fps on a mid-range laptop, stop rendering when hidden or idle, dispose geometries and materials.
  - Use real data where it makes sense (org chart, task dependency graph). Never block a task on a 3D view.
- React must stay on **19.2.x** until `@react-three/fiber` supports 19.3 (check the peer range before upgrading).

## Testing and "done"

A change is done when: types and build pass in both apps; new behavior has tests (Vitest and Supertest for the API,
Playwright for critical UI flows once set up); permissions are tested for each role; docs and `.env.example` are updated;
and you have verified it running (`/verify-phase`). Report what you could **not** verify.

## Working agreement

- Start every phase with a written implementation plan and wait for approval before large or risky changes.
- Prefer small, reviewable steps. One concern per change.
- Preserve existing behavior unless the task says otherwise. Existing files use Windows line endings; keep them.
- If something in these instructions conflicts with the request, stop and ask.

## Staged delivery protocol

These rules apply while we deliver the roadmap in stages (stage list and status: `docs/PROGRESS.md`; details: `.agents/workflows/`).
For a small one-off request from me outside a stage, apply only sections C, D and E.

RULES OF ENGAGEMENT (these override anything else about process)

A. Order and gates
1. Stages run strictly in the order listed in docs/PROGRESS.md. Never start a stage until I reply "continue" (or clearly equivalent). Never combine stages.
2. Starting a stage: read AGENTS.md, docs/PROGRESS.md and the stage's workflow file. Create a git branch named stage-<N>-<short-name>. Write a plan: files to change, data migrations, risks, tests, rollback.
   If the stage is marked PLAN REVIEW, stop and wait for my approval of the plan. Otherwise start, unless the plan contains anything destructive, in which case ask first.
3. Before writing the plan, ask me the stage's "Ask first" questions (at most 3 at a time). If I have not decided, propose a safe default and say what it is.
4. Work in small steps. Commit after each meaningful step. After each step run the relevant checks.

B. Finishing a stage (the gate)
5. Run the checklist in .agents/workflows/verify-phase.md. Update docs/PROGRESS.md (status, branch, report, decisions, backlog).
6. Post a STAGE REPORT with these headings: What changed / How to run and try it (exact commands) / Verification evidence (commands run and results, screenshots for UI) /
   NOT verified and why / Risks and follow-ups / How to roll back / Decisions I need to make.
7. End with exactly: "Stage N is complete. Reply 'continue' to start Stage N+1 (<name>), 'changes: <what>' to adjust this stage, 'skip' (allowed only for Stage 9), or 'stop'."
   Then STOP and wait. Do nothing further until I answer.

C. Honesty
8. Never say a check passed unless you ran it and saw it pass. If something fails or cannot run (no internet, no Docker, no browser), say so plainly. Never mark a stage complete with failing checks.
9. Never invent credentials, API keys or provider behaviour. Use environment placeholders and mocked providers until I supply real values through .env myself.

D. Safety
10. Follow the hard rules in AGENTS.md. Never read, print or edit .env files. No destructive database commands (reset, drop, force push, seed --force) except on a throwaway local database that I have confirmed.
    Tell me before installing global software or changing system settings. Justify every new dependency.
11. Existing behaviour must keep working. At the end of every stage the app builds and the Docker install path works.

E. Scope and environment
12. Do only the current stage. If you find a problem elsewhere, add it to the Backlog in docs/PROGRESS.md. Fix it now only if it blocks the current stage or is a security issue, and then tell me.
13. I use Windows with PowerShell 5.1. Do not chain commands with && ; run them separately or use "npm --prefix backend <script>" and "npm --prefix frontend <script>".
    Keep existing files' line endings (mostly CRLF). Shell scripts, Dockerfiles and config for containers must stay LF (see .gitattributes).

F. Memory
14. The source of truth is git plus docs/PROGRESS.md, not chat memory. If this conversation gets long or restarts, re-read docs/PROGRESS.md and continue from the first incomplete stage.
    Tell me in five lines where we are, then wait for "continue".
