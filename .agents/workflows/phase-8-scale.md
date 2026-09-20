---
description: Scale, reliability, observability, public API and push notifications
---
# Phase 8: scale and open platform

Read `AGENTS.md`. Write an implementation plan first and wait for approval.

## Steps

1. **Caching and load.** Cache permission and settings lookups (Redis) with safe invalidation; remove the per-request user reload where the cache is authoritative. Load test with k6 at the target user count and record baselines.
2. **Observability.** Prometheus metrics, OpenTelemetry traces, error tracking, dashboards and alerts (error rate, latency, queue depth, failed jobs).
3. **Reliability.** Automated PostgreSQL backups with a **tested restore**, file storage backups, zero-downtime deploy notes, `docker compose` production profile with resource limits.
4. **Public API and webhooks.** Scoped API tokens, OpenAPI docs generated from zod, outgoing webhooks with signing and retries, rate limits per token.
5. **Push and mobile.** Web push notifications, PWA polish, optional wrapper for stores.
6. **Security review.** Dependency audit in CI, secret scanning, CSP for the web app, penetration-test checklist, data export and deletion tools for privacy requests.

## Acceptance criteria

Documented capacity numbers; restore drill completed and written up; alerts fire in a test; API docs published from the running app. Run `/verify-phase`.
