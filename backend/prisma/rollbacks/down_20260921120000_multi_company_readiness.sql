-- Rollback Migration for 20260921120000_multi_company_readiness

-- 1. Drop email compound and expression indexes, and restore global User.email unique index
DROP INDEX IF EXISTS "User_organizationId_lower_email_idx";
DROP INDEX IF EXISTS "User_organizationId_email_key";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- 2. Drop OrganizationSecret table
DROP TABLE IF EXISTS "OrganizationSecret";

-- 3. Drop foreign keys, indexes, and organizationId columns for the 17 tables
ALTER TABLE "TeamMember" DROP CONSTRAINT IF EXISTS "TeamMember_organizationId_fkey";
DROP INDEX IF EXISTS "TeamMember_organizationId_idx";
ALTER TABLE "TeamMember" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "TaskAssignment" DROP CONSTRAINT IF EXISTS "TaskAssignment_organizationId_fkey";
DROP INDEX IF EXISTS "TaskAssignment_organizationId_idx";
ALTER TABLE "TaskAssignment" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "TaskUpdate" DROP CONSTRAINT IF EXISTS "TaskUpdate_organizationId_fkey";
DROP INDEX IF EXISTS "TaskUpdate_organizationId_idx";
ALTER TABLE "TaskUpdate" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "TaskComment" DROP CONSTRAINT IF EXISTS "TaskComment_organizationId_fkey";
DROP INDEX IF EXISTS "TaskComment_organizationId_idx";
ALTER TABLE "TaskComment" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "TaskAttachment" DROP CONSTRAINT IF EXISTS "TaskAttachment_organizationId_fkey";
DROP INDEX IF EXISTS "TaskAttachment_organizationId_idx";
ALTER TABLE "TaskAttachment" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "TaskHistory" DROP CONSTRAINT IF EXISTS "TaskHistory_organizationId_fkey";
DROP INDEX IF EXISTS "TaskHistory_organizationId_idx";
ALTER TABLE "TaskHistory" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "RecurrenceRule" DROP CONSTRAINT IF EXISTS "RecurrenceRule_organizationId_fkey";
DROP INDEX IF EXISTS "RecurrenceRule_organizationId_idx";
ALTER TABLE "RecurrenceRule" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_organizationId_fkey";
DROP INDEX IF EXISTS "Attendance_organizationId_idx";
ALTER TABLE "Attendance" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "WorkSession" DROP CONSTRAINT IF EXISTS "WorkSession_organizationId_fkey";
DROP INDEX IF EXISTS "WorkSession_organizationId_idx";
ALTER TABLE "WorkSession" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "LeaveRequest" DROP CONSTRAINT IF EXISTS "LeaveRequest_organizationId_fkey";
DROP INDEX IF EXISTS "LeaveRequest_organizationId_idx";
ALTER TABLE "LeaveRequest" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "LeaveBalance" DROP CONSTRAINT IF EXISTS "LeaveBalance_organizationId_fkey";
DROP INDEX IF EXISTS "LeaveBalance_organizationId_idx";
ALTER TABLE "LeaveBalance" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "PerformanceReview" DROP CONSTRAINT IF EXISTS "PerformanceReview_organizationId_fkey";
DROP INDEX IF EXISTS "PerformanceReview_organizationId_idx";
ALTER TABLE "PerformanceReview" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "PayrollRecord" DROP CONSTRAINT IF EXISTS "PayrollRecord_organizationId_fkey";
DROP INDEX IF EXISTS "PayrollRecord_organizationId_idx";
ALTER TABLE "PayrollRecord" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_organizationId_fkey";
DROP INDEX IF EXISTS "Notification_organizationId_idx";
ALTER TABLE "Notification" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "AuditLog" DROP CONSTRAINT IF EXISTS "AuditLog_organizationId_fkey";
DROP INDEX IF EXISTS "AuditLog_organizationId_idx";
ALTER TABLE "AuditLog" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "ActivityLog" DROP CONSTRAINT IF EXISTS "ActivityLog_organizationId_fkey";
DROP INDEX IF EXISTS "ActivityLog_organizationId_idx";
ALTER TABLE "ActivityLog" DROP COLUMN IF EXISTS "organizationId";

ALTER TABLE "RefreshToken" DROP CONSTRAINT IF EXISTS "RefreshToken_organizationId_fkey";
DROP INDEX IF EXISTS "RefreshToken_organizationId_idx";
ALTER TABLE "RefreshToken" DROP COLUMN IF EXISTS "organizationId";
