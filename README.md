# Company Portal

A self-hosted work portal for one company: tasks with review workflow, attendance,
leave, performance, payroll, documents, reports, notifications and audit log.

- **Backend:** Node.js, Express 5, TypeScript, Prisma 7, PostgreSQL
- **Frontend:** React 19, TypeScript, Vite (3D sign-in scene with three.js)
- **Deployment:** Docker Compose. One build serves any company; branding and settings are configuration, not code.

Each company runs **its own copy** (its own database and files). See `docs/MULTI_COMPANY_READINESS.md`
for how this can later become one installation serving many companies.

## Install with Docker (recommended)

```bash
cp .env.example .env
# Edit .env: set POSTGRES_PASSWORD, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, APP_NAME.
# Generate each secret with:
#   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

docker compose up -d --build

# Create the company and its first admin (run once):
docker compose exec api npm run bootstrap -- --company "Acme Ltd" --name "Asha Rao" --email asha@acme.com
```

Open http://localhost:8080 and sign in. If you did not pass `--password`, a strong one is
printed once by the bootstrap command. Save it.

**HTTPS:** put the portal behind HTTPS (Caddy, Traefik, nginx, or your cloud load balancer) and set
`COOKIE_SECURE=true` and `APP_URL=https://your-domain`. Without HTTPS, browsers will not keep the login cookie if secure cookies are on.

## Run locally for development

```bash
cp .env.example .env                    # project root: fill POSTGRES_PASSWORD and both JWT secrets (compose validates the whole file)
docker compose up -d db                 # PostgreSQL on 127.0.0.1:5432

cd backend
cp .env.example .env                    # put the same POSTGRES_PASSWORD into DATABASE_URL, and set both JWT secrets
npm ci
npx prisma generate
npx prisma db push                      # creates the tables
npm run seed:demo                       # optional: demo company and users (see warning below)
npm run dev                             # API on http://localhost:3000

cd ../frontend
npm ci
npm run dev                             # http://localhost:5173 (demo logins visible, DEMO_MODE via .env.development)
```

Use `npm run bootstrap` instead of `seed:demo` when you want a clean company with only your own admin.

> **Demo data warning:** `seed:demo` deletes every table before inserting sample data, and all demo
> users share the password `password123`. It refuses to run in production or on a database that already
> has users unless you pass `--force` (`npx tsx prisma/seed.ts --force`).

## Database migrations and upgrades

This project uses versioned Prisma migrations (`prisma/migrations`).

### Upgrading a real database
Before applying migrations to an existing database:
1. Verify whether migrations have been tracked:
   ```sql
   SELECT to_regclass('public._prisma_migrations');
   ```
   If this returns `null`, the database was created using `db push` and has no migration history yet.
2. Review the migration SQL files in `backend/prisma/migrations/`.
3. Mark the baseline migration as already applied on your existing database:
   ```bash
   cd backend
   npx prisma migrate resolve --applied 0_init
   ```
4. Deploy subsequent migrations safely:
   ```bash
   npx prisma migrate deploy
   ```

### Test database setup (`portal_test`)
Automated tests require a dedicated, isolated test database ending in `_test`:
1. In PostgreSQL, create the test database:
   ```sql
   CREATE DATABASE portal_test;
   ```
2. In `backend/.env`, add your test database connection string:
   ```
   TEST_DATABASE_URL=postgresql://<user>:<password>@localhost:5432/portal_test
   ```
3. Prepare the test schema:
   ```bash
   npm --prefix backend run test:db:prepare
   ```
4. Run the automated test suite:
   ```bash
   npm --prefix backend test
   ```

## Configuration

All settings are environment variables. `.env.example` (root) documents every one. Highlights:

| Setting | Purpose |
|---|---|
| `APP_NAME`, `APP_TAGLINE` | Branding shown on the login page, sidebar and browser tab. Changed at runtime, no rebuild |
| `APP_URL`, `CORS_ORIGINS` | Where the app is served from |
| `COOKIE_SECURE`, `COOKIE_SAMESITE`, `COOKIE_DOMAIN` | Login cookie behaviour for your HTTPS and domain layout |
| `TRUST_PROXY` | Number of reverse proxies in front of the API (1 with the bundled nginx) |
| `RATE_LIMIT_*`, `AUTH_RATE_LIMIT_MAX` | Global limit, and the stricter limit on failed sign-ins |
| `ENABLE_CRON` | Set `false` on all but one API instance if you ever run several |
| `SMTP_*`, `MAIL_FROM` | Email (optional). See `docs/EMAIL_AND_AI_SETUP.md` |
| `AI_*`, `EMBEDDINGS_*` | AI features (optional, off by default). See `docs/EMAIL_AND_AI_SETUP.md` |

The API refuses to start with missing or unsafe settings and prints exactly what to fix.

## Health checks

`GET /health` (process is up) and `GET /health/ready` (database reachable, returns 503 otherwise).

## What is in this release (Phase 0: foundation)

- Environment-driven, validated configuration (no more hardcoded `localhost` CORS origin)
- Helmet security headers, global and login rate limiting (only failed sign-ins count), error handler, health checks, graceful shutdown
- Case-insensitive, timing-safe sign-in; cookies configurable for any domain layout
- First-run `bootstrap` command; demo seed made safe
- Docker Compose (PostgreSQL with pgvector, API, nginx web, optional Mailpit); runtime frontend config
- Demo login buttons hidden unless `DEMO_MODE=true`; brand name configurable
- Lazy-loaded 3D sign-in scene (respects reduced motion, data saver, low-power devices, no-WebGL)
- React pinned to 19.2.x because `@react-three/fiber` does not support 19.3 yet

## Known limits (planned in `docs/ROADMAP.md`)

Invite and password-reset flows, 2FA and SSO, uploads on local disk only, money stored as floating point,
no automated tests or CI, no timezone setting, and a UI that still needs the design-system rebuild.

## Troubleshooting

- **Signed out after 15 minutes, on HTTP:** set `COOKIE_SECURE=false` or serve over HTTPS.
- **Browser blocks requests (CORS):** add the exact origin to `CORS_ORIGINS`.
- **API exits at start with "Invalid environment configuration":** read the listed variables and fix `.env`.
- **`prisma generate` fails offline:** it downloads an engine binary; run it on a machine with internet access.
