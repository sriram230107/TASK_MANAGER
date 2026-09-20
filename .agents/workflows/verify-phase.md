---
description: End-of-phase verification checklist and report
---
# Verify the phase

Run these and report honestly. Say clearly what you could not verify and why.

1. `backend`: `npm run typecheck`, `npm run build`, `npm test`. `frontend`: `npm run lint`, `npm run build`. Report failures verbatim.
2. `docker compose config` validates; `docker compose up -d --build` starts db, api and web healthy (`/health`, `/health/ready`).
3. Fresh install path: empty database, `bootstrap`, sign in as the new admin, create a user, create a task.
4. Upgrade path: apply the new migrations to a copy of a populated database and compare row counts before and after.
5. Security spot checks: no secrets in logs or responses; protected routes return 401 without a session; a lower role gets 403 on admin routes; cross-user access is denied.
6. Browser check with screenshots (mobile 360 px and desktop 1280 px) of every screen touched: keyboard-only pass, reduced-motion on, WebGL disabled for any 3D screen. Record any console errors.
7. Update `README.md`, `.env.example`, `docker-compose.yml` and `docs/ROADMAP.md` (status column) for anything that changed.
8. Produce a short report: what changed, how to run it, what was verified, what was not, known risks, suggested next step.
