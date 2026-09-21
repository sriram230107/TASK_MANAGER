-- Multi-Company Readiness: Atomic Migration with SQL Backfill and Orphan Guard
-- Step 1: Add nullable organizationId columns to 17 business tables
ALTER TABLE "TeamMember" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "TaskAssignment" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "TaskUpdate" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "TaskComment" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "TaskAttachment" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "TaskHistory" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "RecurrenceRule" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Attendance" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "WorkSession" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "LeaveRequest" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "LeaveBalance" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "PerformanceReview" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "PayrollRecord" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "Notification" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "ActivityLog" ADD COLUMN "organizationId" TEXT;
ALTER TABLE "RefreshToken" ADD COLUMN "organizationId" TEXT;

-- Step 2: Create OrganizationSecret table
CREATE TABLE "OrganizationSecret" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "valueEncrypted" TEXT NOT NULL,
    "keyVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationSecret_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "OrganizationSecret_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OrganizationSecret_organizationId_key_key" ON "OrganizationSecret"("organizationId", "key");
CREATE INDEX "OrganizationSecret_organizationId_idx" ON "OrganizationSecret"("organizationId");

-- Step 3: Backfill organizationId from parents in SQL
UPDATE "TeamMember" tm
SET "organizationId" = t."organizationId"
FROM "Team" t
WHERE tm."teamId" = t.id AND tm."organizationId" IS NULL;

UPDATE "TaskAssignment" ta
SET "organizationId" = t."organizationId"
FROM "Task" t
WHERE ta."taskId" = t.id AND ta."organizationId" IS NULL;

UPDATE "TaskUpdate" tu
SET "organizationId" = t."organizationId"
FROM "Task" t
WHERE tu."taskId" = t.id AND tu."organizationId" IS NULL;

UPDATE "TaskComment" tc
SET "organizationId" = t."organizationId"
FROM "Task" t
WHERE tc."taskId" = t.id AND tc."organizationId" IS NULL;

UPDATE "TaskAttachment" ta
SET "organizationId" = t."organizationId"
FROM "Task" t
WHERE ta."taskId" = t.id AND ta."organizationId" IS NULL;

UPDATE "TaskHistory" th
SET "organizationId" = t."organizationId"
FROM "Task" t
WHERE th."taskId" = t.id AND th."organizationId" IS NULL;

UPDATE "RecurrenceRule" rr
SET "organizationId" = t."organizationId"
FROM "Task" t
WHERE rr."taskId" = t.id AND rr."organizationId" IS NULL;

UPDATE "Attendance" a
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE a."userId" = u.id AND a."organizationId" IS NULL;

UPDATE "WorkSession" ws
SET "organizationId" = a."organizationId"
FROM "Attendance" a
WHERE ws."attendanceId" = a.id AND ws."organizationId" IS NULL;

UPDATE "LeaveRequest" lr
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE lr."employeeId" = u.id AND lr."organizationId" IS NULL;

UPDATE "LeaveBalance" lb
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE lb."userId" = u.id AND lb."organizationId" IS NULL;

UPDATE "PerformanceReview" pr
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE pr."employeeId" = u.id AND pr."organizationId" IS NULL;

UPDATE "PayrollRecord" pr
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE pr."employeeId" = u.id AND pr."organizationId" IS NULL;

UPDATE "Notification" n
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE n."userId" = u.id AND n."organizationId" IS NULL;

UPDATE "AuditLog" al
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE al."userId" = u.id AND al."organizationId" IS NULL;

UPDATE "ActivityLog" al
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE al."userId" = u.id AND al."organizationId" IS NULL;

UPDATE "RefreshToken" rt
SET "organizationId" = u."organizationId"
FROM "User" u
WHERE rt."userId" = u.id AND rt."organizationId" IS NULL;

-- Step 4: Automated Rollback Guard (DO block)
-- If ANY organizationId is still NULL (e.g. dangling orphan row), raise exception and roll back transaction.
DO $$
DECLARE
    orphan_count integer;
    tables text[] := ARRAY[
        'TeamMember', 'TaskAssignment', 'TaskUpdate', 'TaskComment',
        'TaskAttachment', 'TaskHistory', 'RecurrenceRule', 'Attendance',
        'WorkSession', 'LeaveRequest', 'LeaveBalance', 'PerformanceReview',
        'PayrollRecord', 'Notification', 'AuditLog', 'ActivityLog', 'RefreshToken'
    ];
    t_name text;
    unresolved_info text := '';
BEGIN
    FOREACH t_name IN ARRAY tables LOOP
        EXECUTE format('SELECT count(*) FROM %I WHERE "organizationId" IS NULL', t_name) INTO orphan_count;
        IF orphan_count > 0 THEN
            unresolved_info := unresolved_info || format('Table "%s" has %s row(s) with NULL organizationId; ', t_name, orphan_count);
        END IF;
    END LOOP;

    IF length(unresolved_info) > 0 THEN
        RAISE EXCEPTION 'MIGRATION HALTED: Unresolved orphan rows detected! % Transaction rolling back. Please resolve dangling references before applying.', unresolved_info;
    END IF;
END $$;

-- Step 5: Enforce NOT NULL, foreign keys (ON DELETE RESTRICT), and indexes
ALTER TABLE "TeamMember" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TeamMember_organizationId_idx" ON "TeamMember"("organizationId");

ALTER TABLE "TaskAssignment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TaskAssignment" ADD CONSTRAINT "TaskAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TaskAssignment_organizationId_idx" ON "TaskAssignment"("organizationId");

ALTER TABLE "TaskUpdate" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TaskUpdate" ADD CONSTRAINT "TaskUpdate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TaskUpdate_organizationId_idx" ON "TaskUpdate"("organizationId");

ALTER TABLE "TaskComment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TaskComment_organizationId_idx" ON "TaskComment"("organizationId");

ALTER TABLE "TaskAttachment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TaskAttachment_organizationId_idx" ON "TaskAttachment"("organizationId");

ALTER TABLE "TaskHistory" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TaskHistory" ADD CONSTRAINT "TaskHistory_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "TaskHistory_organizationId_idx" ON "TaskHistory"("organizationId");

ALTER TABLE "RecurrenceRule" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "RecurrenceRule" ADD CONSTRAINT "RecurrenceRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "RecurrenceRule_organizationId_idx" ON "RecurrenceRule"("organizationId");

ALTER TABLE "Attendance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Attendance_organizationId_idx" ON "Attendance"("organizationId");

ALTER TABLE "WorkSession" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "WorkSession" ADD CONSTRAINT "WorkSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "WorkSession_organizationId_idx" ON "WorkSession"("organizationId");

ALTER TABLE "LeaveRequest" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "LeaveRequest_organizationId_idx" ON "LeaveRequest"("organizationId");

ALTER TABLE "LeaveBalance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveBalance" ADD CONSTRAINT "LeaveBalance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "LeaveBalance_organizationId_idx" ON "LeaveBalance"("organizationId");

ALTER TABLE "PerformanceReview" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PerformanceReview_organizationId_idx" ON "PerformanceReview"("organizationId");

ALTER TABLE "PayrollRecord" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PayrollRecord" ADD CONSTRAINT "PayrollRecord_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "PayrollRecord_organizationId_idx" ON "PayrollRecord"("organizationId");

ALTER TABLE "Notification" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Notification_organizationId_idx" ON "Notification"("organizationId");

ALTER TABLE "AuditLog" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "AuditLog_organizationId_idx" ON "AuditLog"("organizationId");

ALTER TABLE "ActivityLog" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ActivityLog_organizationId_idx" ON "ActivityLog"("organizationId");

ALTER TABLE "RefreshToken" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "RefreshToken_organizationId_idx" ON "RefreshToken"("organizationId");

-- Step 6: Email uniqueness migration
DROP INDEX IF EXISTS "User_email_key";

-- Lowercase existing emails
UPDATE "User" SET "email" = LOWER("email");

-- Prisma compound unique index
CREATE UNIQUE INDEX "User_organizationId_email_key" ON "User"("organizationId", "email");

-- PostgreSQL functional expression index for case-insensitive uniqueness
CREATE UNIQUE INDEX "User_organizationId_lower_email_idx" ON "User"("organizationId", LOWER("email"));
