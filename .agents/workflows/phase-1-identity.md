---
description: Rebuild login and identity (invites, reset, lockout, 2FA, SSO, sessions, cookie-only auth)
---
# Phase 1: identity and access

Context: read `AGENTS.md`, `backend/src/services/auth.service.ts`, `controllers/auth.controller.ts`, `middleware/auth.middleware.ts`,
`utils/cookies.ts`, `utils/tokens.ts`, `frontend/src/pages/Login.tsx`, `context/AuthContext.tsx`, `api/axios.ts`.
Write an implementation plan first and wait for approval. All email features must work with email disabled (see step 2 fallback).

## Problems being fixed

Admins choose everyone's passwords and there is no invite; no forgot/reset/change password; no lockout, 2FA, SSO, session list or login history;
the access token lives in `localStorage` and in a cookie; refresh tokens have no reuse detection.

## Steps

1. **Schema (migration + backfill).** User: `mustChangePassword`, `failedLoginCount`, `lockedUntil`, `lastLoginAt`, `twoFactorEnabled`, `twoFactorSecret` (encrypted).
   New: `Invitation` (tokenHash, email, role, departmentId, managerId, expiresAt, acceptedAt, invitedById), `PasswordResetToken`, `LoginEvent`
   (userId, ip, userAgent, success, reason, createdAt), `RecoveryCode` (hashed), `ExternalIdentity` (provider, subject, userId).
   Extend `RefreshToken`: `familyId`, `userAgent`, `ip`, `lastUsedAt`. Every new table carries `organizationId`.
2. **Email service** (`nodemailer`, behind `config.emailEnabled`): templates for invite, reset, new-device alert. **Fallback when email is off:**
   the admin sees a one-time invite or reset link to copy, clearly labelled.
3. **Invite onboarding.** Replace "admin sets password" with `POST /users/invite`. The invited person opens the link, sets their own password.
   Tokens are single-use, expire (default 72 h), stored hashed. Keep an admin-set temporary password only when email is off, with `mustChangePassword=true`.
4. **Password reset and change.** `POST /auth/forgot` always answers the same way whether or not the email exists. `POST /auth/reset`, `POST /auth/change-password`.
   Policy in organization settings (default: 12+ characters, no common passwords). Changing a password revokes other sessions.
5. **Attack protection.** Per-account lockout with progressive delay (configurable), constant-time responses (already started), all attempts written to `LoginEvent`,
   alert on new device. Keep the failed-attempts IP limiter.
6. **2FA (TOTP)** with QR setup, recovery codes, and an admin policy to require it per role. Secrets encrypted with a key from config.
7. **SSO** via OpenID Connect (`openid-client`): Google Workspace and Microsoft Entra ID, configured per organization in settings
   (client id, secret encrypted, allowed email domain). Support "SSO only" mode and JIT-provisioning limited to allowed domains.
8. **Sessions.** Refresh-token **reuse detection** (reusing a rotated token revokes the whole family). Page to list devices and revoke, plus "sign out everywhere".
9. **Cookie-only auth.** Remove the `localStorage` token; rely on httpOnly cookies. Add CSRF protection (double-submit token or strict Origin check) for
   state-changing requests. Update `axios.ts` and `AuthContext`. Keep file downloads working.
10. **Frontend screens.** Accept invite, forgot password, reset password, change password (also forced-change), 2FA setup and challenge, sessions, login history,
    SSO buttons (shown only when configured). Branded from `config.APP_NAME`. Never show demo accounts unless `DEMO_MODE`.
11. **Admin settings.** Authentication policy: required 2FA roles, allowed domains, SSO-only, password rules, lockout thresholds, session length.

## Acceptance criteria

- Tests for: invite happy path and expiry, single-use tokens, reset without user enumeration, lockout and unlock, 2FA setup/challenge/recovery,
  refresh reuse detection, CSRF rejection, SSO callback with a mocked provider, permission checks per role.
- No token or secret appears in logs or API responses. `passwordHash` never returned.
- The portal is fully usable with email off. Report anything unverified, then run `/verify-phase`.
