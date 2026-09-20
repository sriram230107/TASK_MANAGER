# Antigravity: complete staged prompt

Paste **Prompt 1** once. Antigravity then works one stage at a time and stops after every stage to ask whether to continue.
State is kept in `docs/PROGRESS.md` and git, so you can safely start a new conversation with **Prompt 2** whenever the chat gets long.

## One-time setup

1. Unzip the package over your project folder. Open that folder in Antigravity (the one that contains `AGENTS.md`, `backend/` and `frontend/`).
2. Save your current state first. In the terminal run these **as separate commands** (PowerShell 5.1 does not support `&&`): `git init` (only if it is not a repository yet), `git add -A`, `git commit -m "Before staged delivery"`.
3. Copy `.env.example` to `.env` in the project root, and `backend/.env.example` to `backend/.env`. Fill the values yourself. Do not paste secrets into the chat.
4. In Antigravity open **Customizations**. Under Rules check that `AGENTS.md` is listed; under Workflows check that the `phase-*` files appear.
5. Choose **Planning** mode, then paste Prompt 1.

## Prompt 1: paste once

```text
You are the lead engineer on the "Company Portal" project in this workspace. We work in stages. After every stage you must stop and ask me whether to continue.

PROJECT AND MY REQUIREMENTS
This is a self-hosted company portal (tasks with review workflow, attendance, leave, payroll, performance, documents, reports, audit). Backend: Node, Express 5, TypeScript, Prisma 7, PostgreSQL. Frontend: React 19.2, Vite, TypeScript.
What I want:
- One company per installation today, but fully portable: any company installs it and configures it with environment variables and admin settings, with no code changes. It must be able to serve many companies later with modest changes.
- A correct, secure login system. No fixed or demo logins in real use.
- A modern, advanced UI (the current one is old-fashioned), including tasteful 3D.
- A Bitrix24-class work platform: advanced task manager, collaboration, projects and timesheets, HR, and an optional CRM.
- AI built in wherever it is safe and useful. AI and email providers must be configurable and optional. The product must work fully with both switched off.

READ FIRST, completely: PROJECT_SPEC.md and IMPLEMENTATION_STATUS.md (in the project root; they are my own notes on requirements and current status), AGENTS.md, README.md, docs/ROADMAP.md, docs/PROGRESS.md, docs/MULTI_COMPANY_READINESS.md, docs/EMAIL_AND_AI_SETUP.md, backend/prisma/schema.prisma, backend/src/config/env.ts, and every file in .agents/workflows/.
If any of these is missing, stop and tell me. Do not improvise around missing files.
If PROJECT_SPEC.md or IMPLEMENTATION_STATUS.md conflicts with anything in this prompt, AGENTS.md or the stage list, stop and show me the conflict before doing any work. Do not silently choose one.

RULES OF ENGAGEMENT (these override anything else about process)

A. Order and gates
1. Stages run strictly in the order listed. Never start a stage until I reply "continue" (or clearly equivalent). Never combine stages.
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

STAGES (in order). Each has a detailed workflow file; the workflow's steps win over this summary, the rules above win over both.

STAGE 1 - Foundation finish        [.agents/workflows/phase-0-finish.md]        PLAN REVIEW
  Scope: baseline database migration; storage adapter (local and S3) with content-based file validation; money fields to Decimal; organization timezone;
         keep passwordHash out of req.user; structured logging; automated tests (Vitest and Supertest); CI.
  Ask first: default timezone; local disk or S3 storage.
  Done when: backend typecheck, build, test and frontend build, lint pass; a fresh Docker install plus "npm run bootstrap" works; an upgrade of a COPY of existing data loses nothing.

STAGE 2 - Multi-company readiness  [.agents/workflows/tenant-ready.md]          PLAN REVIEW
  Scope: organizationId on every business table; one enforced tenant-scoping layer; email unique per company; per-company file prefixes and email/AI credentials;
         tenant resolver (single-company mode behaves exactly as today); cross-company isolation tests.
  Done when: isolation tests pass and single-company behaviour is unchanged.

STAGE 3 - Login and identity       [.agents/workflows/phase-1-identity.md]      PLAN REVIEW
  Scope: invite onboarding (admins never know passwords); forgot, reset and change password; lockout; 2FA; optional SSO (Google, Microsoft); sessions with refresh-token reuse detection;
         cookie-only auth with CSRF protection; email service with a copy-the-link fallback when email is off. Screens use the current UI style; Stage 4 restyles them.
  Ask first: email provider (or Mailpit for now); which SSO providers; which roles must use 2FA.
  Done when: all identity tests pass; the portal is fully usable with email off; no fixed or demo logins outside DEMO_MODE.

STAGE 4 - Modern UI, design system, 3D  [.agents/workflows/phase-2-design-system.md]  PLAN REVIEW (design plan first)
  Scope: design system and theming (brand color and logo from settings); real URLs and routing; app shell with command palette and notification drawer; accessibility; responsive PWA; i18n;
         migrate screens module by module; 3D per the rules in AGENTS.md (sign-in scene exists; add home task graph and 3D org chart with a 2D default).
  Ask first: brand name, logo and colors or desired feel; default theme; languages needed.
  Done when: no inline styles in migrated screens; deep links and refresh work; accessibility checks pass; screenshots at 360 px and 1280 px for every migrated screen; 3D fallback tested with WebGL off.

STAGE 5 - Task engine v2           [.agents/workflows/phase-3-task-engine.md]   PLAN REVIEW (includes the data migration plan)
  Scope: participants, checklists, dependencies, tags, time entries; about 8 clean statuses; Kanban, calendar, timeline, task drawer; recurring tasks; automation rules;
         Redis and BullMQ jobs; real-time updates; email notifications.
  Ask first: default workflow stage names; whether review is required by default.
  Done when: migration proven on a copy of existing data with a before-and-after comparison; role and hierarchy tests pass; two-browser real-time test passes.

STAGE 6 - AI foundation            [.agents/workflows/phase-4-ai-foundation.md] PLAN REVIEW
  Scope: AI gateway, guardrails, audit and budget; natural-language task creation, task breakdown, summaries, semantic search. Off unless configured.
  Ask first: AI provider (Anthropic API, Claude through my cloud, or self-hosted); monthly budget; what data may be sent; embeddings provider.
  Done when: with AI off nothing AI appears; users cannot get through AI anything they cannot see normally; injection tests pass; every call is audited. Use mocks until I supply real keys.

STAGE 7 - Projects, clients, timesheets [.agents/workflows/phase-5-business-layer.md]
  Ask first: do we bill clients and need timesheets.

STAGE 8 - Collaboration            [.agents/workflows/phase-5b-collaboration.md]
  Scope: company feed, chat, shared calendar and room booking, approvals, knowledge base. Ask first: which modules to enable.

STAGE 9 - CRM-lite (OPTIONAL)      [.agents/workflows/phase-5c-crm-lite.md]
  Ask me at the start whether I need it. I may reply "skip".

STAGE 10 - HR modernization        [.agents/workflows/phase-6-hr-modernization.md] PLAN REVIEW
  Scope: attendance, leave, payroll, performance, documents on the new UI; payroll rules are configuration, not code.
  Ask first: country, currency, payroll components, holiday region, working week.

STAGE 11 - Advanced AI             [.agents/workflows/phase-7-ai-advanced.md]   PLAN REVIEW
  Ask first: which advanced features to enable; my policy on AI touching people data. AI never rates people or decides leave, pay or discipline.

STAGE 12 - Scale and open platform [.agents/workflows/phase-8-scale.md]
  Ask first: expected number of users; hosting environment.

After Stage 12: give a final report (what exists, how to deploy, known risks, what is left) and a release checklist.

START NOW
Begin Stage 1 (this message counts as my "continue" for Stage 1). First do a preflight with no code changes:
(a) confirm the files above exist;
(b) run git status. If this is not a git repository, ask me before running git init. Make sure a baseline commit exists before you change anything;
(c) check node -v (need 22 or newer) and npm -v;
(d) run npm --prefix backend ci, then npm --prefix frontend ci, then npm --prefix backend run prisma:generate;
(e) record the baseline: npm --prefix backend run typecheck, npm --prefix backend run build, npm --prefix frontend run build, npm --prefix frontend run lint, and "docker compose config" if Docker is installed;
(f) write the results in the Baseline section of docs/PROGRESS.md.
Then ask me the Stage 1 "Ask first" questions, write the Stage 1 plan, and stop for my approval.
```

## How a stage runs

1. You say "continue". The agent asks its stage questions, then posts a plan. For stages marked PLAN REVIEW it waits for your approval; otherwise it starts.
2. It works in small commits on a branch named `stage-<N>-<name>`, running checks as it goes.
3. It runs the verification checklist, updates `docs/PROGRESS.md`, posts a **Stage Report**, and asks whether to continue.
4. You review the report and branch. Reply `continue`, `changes: ...`, `skip` (Stage 9 only) or `stop`. Merge the branch yourself when you are happy.

Always read the "NOT verified" part of each report. That is where the agent must admit what it could not test.

## Prompt 2: resume in a new conversation

```text
Continue the Company Portal project. Read AGENTS.md and docs/PROGRESS.md. Follow the "Staged delivery protocol" in AGENTS.md exactly.
Tell me in five lines where we are: the last completed stage, the current stage, its status, the open backlog items, and any decision I still owe you.
Then wait for me to say "continue". Do not change any files until I do.
```

## Tips

- One conversation can hold several stages, but restart with Prompt 2 if the agent starts forgetting things or repeating itself.
- Review by hand any diff that touches money, permissions, authentication or personal data.
- Keep `AI_PROVIDER=none` until Stage 6 is finished and its guardrail tests pass.
- If a stage goes wrong, `git checkout` the previous branch. Each stage is on its own branch, and the report explains how to roll back.
