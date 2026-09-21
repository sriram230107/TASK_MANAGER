/**
 * Read-only inspection and dry-run reporting tool for multi-company organizationId readiness.
 *
 * Usage:
 *   npx tsx scripts/backfill-organization-id.ts
 *   npx tsx scripts/backfill-organization-id.ts --system-org-id <uuid> --confirm-count <n>
 *
 * Rule: NEVER guesses an organization. NEVER deletes or truncates data.
 * Reports orphan records and unassociated audit logs.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendDir, '.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.error('ERROR: DATABASE_URL not set in environment or backend/.env');
    process.exit(1);
}

const arg = (name) => {
    const idx = process.argv.indexOf(`--${name}`);
    return idx > -1 ? process.argv[idx + 1] : undefined;
};

const systemOrgId = arg('system-org-id');
const confirmCount = arg('confirm-count');

const client = new pg.Client({ connectionString: dbUrl });
await client.connect();

try {
    const res = await client.query('SELECT current_database() AS db');
    console.log(`\n========================================================================`);
    console.log(` MULTI-COMPANY BACKFILL REPORTING TOOL (DRY-RUN / AUDIT)`);
    console.log(` Connected Database: ${res.rows[0].db}`);
    console.log(`========================================================================\n`);

    // 1. Verify system-org-id if provided
    if (systemOrgId) {
        const orgCheck = await client.query('SELECT id, name FROM "Organization" WHERE id = $1', [systemOrgId]);
        if (orgCheck.rows.length === 0) {
            console.error(`ERROR: Specified --system-org-id "${systemOrgId}" was NOT found in "Organization" table.`);
            process.exit(1);
        }
        console.log(`Validated System Target Organization: "${orgCheck.rows[0].name}" (${systemOrgId})`);
    }

    // 2. Check for case-insensitive email collisions within the same organization
    console.log(`--- Checking for Case-Insensitive Email Collisions ---`);
    const emailCollisions = await client.query(`
        SELECT "organizationId", LOWER("email") AS normalized_email, COUNT(*) AS count, ARRAY_AGG("email") AS original_emails
        FROM "User"
        GROUP BY "organizationId", LOWER("email")
        HAVING COUNT(*) > 1;
    `);
    if (emailCollisions.rows.length > 0) {
        console.error(`[COLLISION DETECTED] Found ${emailCollisions.rows.length} case-insensitive email collision(s):`);
        console.table(emailCollisions.rows);
        console.error(`Please deduplicate these emails before applying the multi-company migration.`);
    } else {
        console.log(`[PASS] Zero case-insensitive email collisions detected.`);
    }

    // 3. Check for dangling parent references across tables
    console.log(`\n--- Checking for Orphan / Dangling Parent Records ---`);
    const orphanChecks = [
        {
            table: 'TeamMember.teamId / userId',
            query: `SELECT tm.id, tm."userId", tm."teamId" FROM "TeamMember" tm LEFT JOIN "Team" t ON tm."teamId" = t.id LEFT JOIN "User" u ON tm."userId" = u.id WHERE t.id IS NULL OR u.id IS NULL`
        },
        {
            table: 'TaskAssignment.taskId / userId',
            query: `SELECT ta.id, ta."taskId", ta."userId" FROM "TaskAssignment" ta LEFT JOIN "Task" t ON ta."taskId" = t.id LEFT JOIN "User" u ON ta."userId" = u.id WHERE t.id IS NULL OR u.id IS NULL`
        },
        {
            table: 'TaskUpdate.taskId / userId',
            query: `SELECT tu.id FROM "TaskUpdate" tu LEFT JOIN "Task" t ON tu."taskId" = t.id LEFT JOIN "User" u ON tu."userId" = u.id WHERE t.id IS NULL OR u.id IS NULL`
        },
        {
            table: 'TaskComment.taskId / userId',
            query: `SELECT tc.id FROM "TaskComment" tc LEFT JOIN "Task" t ON tc."taskId" = t.id LEFT JOIN "User" u ON tc."userId" = u.id WHERE t.id IS NULL OR u.id IS NULL`
        },
        {
            table: 'TaskAttachment.taskId / uploadedById',
            query: `SELECT ta.id FROM "TaskAttachment" ta LEFT JOIN "Task" t ON ta."taskId" = t.id LEFT JOIN "User" u ON ta."uploadedById" = u.id WHERE t.id IS NULL OR u.id IS NULL`
        },
        {
            table: 'TaskHistory.taskId / userId',
            query: `SELECT th.id FROM "TaskHistory" th LEFT JOIN "Task" t ON th."taskId" = t.id LEFT JOIN "User" u ON th."userId" = u.id WHERE t.id IS NULL OR u.id IS NULL`
        },
        {
            table: 'RecurrenceRule.taskId',
            query: `SELECT rr.id FROM "RecurrenceRule" rr LEFT JOIN "Task" t ON rr."taskId" = t.id WHERE t.id IS NULL`
        },
        {
            table: 'Attendance.userId',
            query: `SELECT a.id, a."userId" FROM "Attendance" a LEFT JOIN "User" u ON a."userId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'WorkSession.attendanceId',
            query: `SELECT ws.id, ws."attendanceId" FROM "WorkSession" ws LEFT JOIN "Attendance" a ON ws."attendanceId" = a.id WHERE a.id IS NULL`
        },
        {
            table: 'LeaveRequest.employeeId',
            query: `SELECT lr.id, lr."employeeId" FROM "LeaveRequest" lr LEFT JOIN "User" u ON lr."employeeId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'LeaveRequest.teamLeadReviewerId',
            query: `SELECT lr.id, lr."teamLeadReviewerId" FROM "LeaveRequest" lr LEFT JOIN "User" u ON lr."teamLeadReviewerId" = u.id WHERE lr."teamLeadReviewerId" IS NOT NULL AND u.id IS NULL`
        },
        {
            table: 'LeaveRequest.managerReviewerId',
            query: `SELECT lr.id, lr."managerReviewerId" FROM "LeaveRequest" lr LEFT JOIN "User" u ON lr."managerReviewerId" = u.id WHERE lr."managerReviewerId" IS NOT NULL AND u.id IS NULL`
        },
        {
            table: 'LeaveBalance.userId',
            query: `SELECT lb.id, lb."userId" FROM "LeaveBalance" lb LEFT JOIN "User" u ON lb."userId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'PerformanceReview.employeeId',
            query: `SELECT pr.id, pr."employeeId" FROM "PerformanceReview" pr LEFT JOIN "User" u ON pr."employeeId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'PerformanceReview.reviewerId',
            query: `SELECT pr.id, pr."reviewerId" FROM "PerformanceReview" pr LEFT JOIN "User" u ON pr."reviewerId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'PayrollRecord.employeeId',
            query: `SELECT pr.id, pr."employeeId" FROM "PayrollRecord" pr LEFT JOIN "User" u ON pr."employeeId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'Notification.userId / taskId',
            query: `SELECT n.id, n."userId", n."taskId" FROM "Notification" n LEFT JOIN "User" u ON n."userId" = u.id LEFT JOIN "Task" t ON n."taskId" = t.id WHERE u.id IS NULL OR (n."taskId" IS NOT NULL AND t.id IS NULL)`
        },
        {
            table: 'AuditLog.userId (dangling, userId IS NOT NULL)',
            query: `SELECT al.id, al."userId", al.action FROM "AuditLog" al LEFT JOIN "User" u ON al."userId" = u.id WHERE al."userId" IS NOT NULL AND u.id IS NULL`
        },
        {
            table: 'ActivityLog.userId',
            query: `SELECT al.id, al."userId", al.action FROM "ActivityLog" al LEFT JOIN "User" u ON al."userId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'RefreshToken.userId',
            query: `SELECT rt.id, rt."userId" FROM "RefreshToken" rt LEFT JOIN "User" u ON rt."userId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'Department.managerId',
            query: `SELECT d.id, d."managerId" FROM "Department" d LEFT JOIN "User" u ON d."managerId" = u.id WHERE d."managerId" IS NOT NULL AND u.id IS NULL`
        },
        {
            table: 'Team.departmentId / teamLeadId',
            query: `SELECT t.id, t."departmentId", t."teamLeadId" FROM "Team" t LEFT JOIN "Department" d ON t."departmentId" = d.id LEFT JOIN "User" u ON t."teamLeadId" = u.id WHERE (t."departmentId" IS NOT NULL AND d.id IS NULL) OR (t."teamLeadId" IS NOT NULL AND u.id IS NULL)`
        },
        {
            table: 'User.departmentId / managerId / teamLeadId',
            query: `SELECT u.id, u."departmentId", u."managerId", u."teamLeadId" FROM "User" u LEFT JOIN "Department" d ON u."departmentId" = d.id LEFT JOIN "User" m ON u."managerId" = m.id LEFT JOIN "User" tl ON u."teamLeadId" = tl.id WHERE (u."departmentId" IS NOT NULL AND d.id IS NULL) OR (u."managerId" IS NOT NULL AND m.id IS NULL) OR (u."teamLeadId" IS NOT NULL AND tl.id IS NULL)`
        },
        {
            table: 'Task.createdById / assigned* / departmentId / teamId / parentTaskId',
            query: `SELECT t.id FROM "Task" t LEFT JOIN "User" c ON t."createdById" = c.id LEFT JOIN "User" am ON t."assignedManagerId" = am.id LEFT JOIN "User" al ON t."assignedTeamLeadId" = al.id LEFT JOIN "User" ae ON t."assignedEmployeeId" = ae.id LEFT JOIN "User" ato ON t."assignedToId" = ato.id LEFT JOIN "Department" d ON t."departmentId" = d.id LEFT JOIN "Team" tm ON t."teamId" = tm.id LEFT JOIN "Task" p ON t."parentTaskId" = p.id WHERE c.id IS NULL OR (t."assignedManagerId" IS NOT NULL AND am.id IS NULL) OR (t."assignedTeamLeadId" IS NOT NULL AND al.id IS NULL) OR (t."assignedEmployeeId" IS NOT NULL AND ae.id IS NULL) OR (t."assignedToId" IS NOT NULL AND ato.id IS NULL) OR (t."departmentId" IS NOT NULL AND d.id IS NULL) OR (t."teamId" IS NOT NULL AND tm.id IS NULL) OR (t."parentTaskId" IS NOT NULL AND p.id IS NULL)`
        },
        {
            table: 'Goal.ownerId / departmentId / teamId',
            query: `SELECT g.id, g."ownerId", g."departmentId", g."teamId" FROM "Goal" g LEFT JOIN "User" u ON g."ownerId" = u.id LEFT JOIN "Department" d ON g."departmentId" = d.id LEFT JOIN "Team" t ON g."teamId" = t.id WHERE (g."ownerId" IS NOT NULL AND u.id IS NULL) OR (g."departmentId" IS NOT NULL AND d.id IS NULL) OR (g."teamId" IS NOT NULL AND t.id IS NULL)`
        },
        {
            table: 'Document.uploadedById / departmentId',
            query: `SELECT doc.id, doc."uploadedById", doc."departmentId" FROM "Document" doc LEFT JOIN "User" u ON doc."uploadedById" = u.id LEFT JOIN "Department" d ON doc."departmentId" = d.id WHERE u.id IS NULL OR (doc."departmentId" IS NOT NULL AND d.id IS NULL)`
        }
    ];

    let totalOrphans = 0;
    for (const check of orphanChecks) {
        const result = await client.query(check.query);
        if (result.rows.length > 0) {
            console.error(`[ORPHAN DETECTED] Table "${check.table}" has ${result.rows.length} dangling row(s):`);
            console.table(result.rows.slice(0, 10));
            totalOrphans += result.rows.length;
        }
    }

    if (totalOrphans === 0) {
        console.log(`[PASS] Zero dangling foreign reference records found across all inspected business tables.`);
    }

    // 4. Check for unassociated AuditLog records (userId IS NULL)
    console.log(`\n--- Checking for Unassociated System AuditLog Records (userId IS NULL) ---`);
    const nullUserAuditLogs = await client.query(`
        SELECT id, action, entity, "entityId", "createdAt", "ipAddress"
        FROM "AuditLog"
        WHERE "userId" IS NULL;
    `);

    if (nullUserAuditLogs.rows.length > 0) {
        console.warn(`[ATTENTION] Found ${nullUserAuditLogs.rows.length} unassociated system AuditLog record(s) where userId IS NULL:`);
        console.table(nullUserAuditLogs.rows.slice(0, 10));

        if (systemOrgId && confirmCount === String(nullUserAuditLogs.rows.length)) {
            const col = await client.query(`
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = 'public' AND table_name = 'AuditLog' AND column_name = 'organizationId'
            `);
            if (col.rows.length === 0) {
                console.error('Cannot persist organizationId: the column does not exist yet. The migration never guesses. Fix or remove these rows before migrate deploy.');
                process.exit(1);
            }
            const updated = await client.query(
                `UPDATE "AuditLog" SET "organizationId" = $1 WHERE "userId" IS NULL`,
                [systemOrgId]
            );
            console.log(`[AUTHORIZED] Reassigned ${updated.rowCount} AuditLog NULL-user rows to organization "${systemOrgId}".`);
        } else {
            console.warn(`To authorize mapping these ${nullUserAuditLogs.rows.length} system logs to a primary organization, pass:`);
            console.warn(`  --system-org-id <org-uuid> --confirm-count ${nullUserAuditLogs.rows.length}\n`);
            console.warn('The migration will abort while these NULL userId rows remain. It never guesses.');
        }
    } else {
        console.log(`[PASS] Zero AuditLog records with NULL userId.`);
    }

    console.log(`\n========================================================================`);
    console.log(` DRY-RUN REPORT COMPLETE`);
    console.log(`========================================================================\n`);
} catch (err) {
    console.error('Error during dry-run report:', err);
    process.exit(1);
} finally {
    await client.end();
}
