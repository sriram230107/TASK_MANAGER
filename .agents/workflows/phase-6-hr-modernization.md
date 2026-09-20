---
description: Bring attendance, leave, payroll, performance and documents up to the new standard
---
# Phase 6: HR modules modernization

Read `AGENTS.md` and the existing HR services (`attendance`, `leave`, `payroll`, `performance`, `document`). Rebuild their screens on the Phase 2 design system first, then add the features below.
Write an implementation plan first and wait for approval.

## Steps

1. **Attendance.** Configurable shifts and schedules, optional IP or geo rules (off by default, explain privacy impact in settings), regularisation requests with approval, monthly summary, timezone-correct days.
2. **Leave.** Team calendar with clashes and coverage warnings, configurable leave types and accrual rules, carry-over and expiry, half days, holidays by **country and region** chosen in settings (no hardcoded US holidays), delegation when approver is away.
3. **Payroll.** Configurable earnings and deduction components and formulas per organization (statutory items like tax and provident fund are **configuration, not code**), payslip PDF with the company branding, approval before release, employees see only their own, full audit. All arithmetic in `Decimal`. Legal correctness is the customer's responsibility: include a setup checklist and clear labels.
4. **Performance.** Goals and OKRs with alignment to team and organization, review cycles, self, manager and peer input, calibration view for HR. Metrics from tasks are shown as context and **never** produce a rating automatically.
5. **Documents.** Versioning, acknowledgement tracking for policies ("read and accepted"), expiry reminders, e-signature hook, per-document access review. Uses the storage adapter.
6. **People.** Employee profile with job history, emergency contacts, and org chart data feeding the 2D and 3D org chart. Sensitive fields visible by role only.

## Acceptance criteria

Every screen migrated to the new design system with accessibility checks; role-based visibility tests; payroll and leave math tested with edge cases (month ends, leap years, part periods); no hardcoded country data. Run `/verify-phase`.
