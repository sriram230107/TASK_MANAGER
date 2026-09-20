---
description: AI gateway, guardrails and first AI features (natural-language tasks, breakdown, summaries, semantic search)
---
# Phase 4: AI foundation and quick wins

Context: read `AGENTS.md` (AI section), `docs/ROADMAP.md` ("AI guardrails"), `docs/EMAIL_AND_AI_SETUP.md`, `backend/src/config/env.ts` (AI settings already parsed).
Everything sits behind `config.aiEnabled` and organization feature switches; with `AI_PROVIDER=none` the product must behave exactly as before.
Write an implementation plan first and wait for approval.

## Steps

1. **Gateway.** `src/modules/ai/` with `AiProvider { complete, stream, embed }` and adapters: Anthropic (official `@anthropic-ai/sdk`) and OpenAI-compatible (`AI_BASE_URL`).
   Two model roles from config: **fast** (classification, summaries) and **smart** (assistant, multi-step). Timeouts, retries with backoff, structured (JSON) outputs validated with zod.
2. **Tool framework.** Tools are thin wrappers around **existing service functions** and always receive the acting `User`; they inherit `authorize` and hierarchy checks.
   No tool may bypass a service. Read tools return only what the user may see. **Write tools never write:** they return an `AiProposal` (stored, expiring) that the user confirms in the UI.
3. **Data classes.** Default exclusion of payroll, salary, confidential documents and performance reviews from any AI context. Organization settings to allow a class per feature. Minimise personal data sent (ids and first names where possible).
4. **Untrusted content.** Comments, task text and documents are wrapped in clearly delimited blocks and instructed as data, never instructions. A model output can never trigger a tool call
   because of text inside content; tool calls come only from the user's own request. Add tests with injection strings.
5. **Audit, budget, switches.** `AiInteraction` table (org, user, feature, model, tokens in and out, estimated cost, status, latency). Monthly budget (`AI_MONTHLY_BUDGET_USD`) and per-user rate limits enforced before calling.
   Organization-level global kill switch and per-feature switches in settings. Admin page with usage and cost.
6. **Embeddings and search.** Enable `pgvector` (`CREATE EXTENSION vector` in a migration). `Embedding` table (org, entity type, entity id, content hash, vector). Background job embeds tasks, comments and permitted documents,
   re-embeds on change. Provider from `EMBEDDINGS_*`. Semantic search endpoint that **filters by permission after retrieval**. Duplicate-task detection on create.
7. **Features.**
   - **Natural-language task creation** ("Ask Priya to prepare the Q3 report by Friday, high priority") to a proposal with resolved assignee, date (in the organization's timezone) and priority, shown for confirmation.
   - **Task breakdown**: subtasks, checklist and an effort estimate as a proposal.
   - **Summaries**: long comment thread, "what changed while I was away", daily and weekly team digest.
   - **Semantic search** in the command palette and the tasks page.
8. **UI (needs Phase 2 shell).** Assistant panel (Ctrl+J), clearly marked "AI draft" chips, confirm-and-edit dialogs, thumbs up or down feedback saved for quality review, graceful states when AI is off, over budget, or the provider is down.
9. **Evaluation.** A `evals/` folder with golden cases per feature and a mocked provider so CI runs without network. Track pass rate.

## Acceptance criteria

- With AI off, no AI UI appears and no AI network call is made (test it).
- A user can never obtain data through AI that the same user cannot see through the normal UI (write cross-user and cross-role tests).
- Injection tests pass; write tools cannot execute without a confirmed proposal; every call is audited; budget stops calls.
- Report cost per feature on the eval set. Run `/verify-phase`.
