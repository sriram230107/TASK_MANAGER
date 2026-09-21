/**
 * Read-only inspection and dry-run reporting tool for multi-company organizationId readiness.
 *
 * Usage:
 *   npx tsx scripts/backfill-organization-id.ts
 *   npx tsx scripts/backfill-organization-id.ts --system-org-id <uuid> --confirm-system-log-reassignment <count>
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
const confirmReassignmentCount = arg('confirm-system-log-reassignment');

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
            table: 'TeamMember',
            query: `SELECT tm.id, tm."userId", tm."teamId" FROM "TeamMember" tm LEFT JOIN "Team" t ON tm."teamId" = t.id WHERE t.id IS NULL`
        },
        {
            table: 'TaskAssignment',
            query: `SELECT ta.id, ta."taskId" FROM "TaskAssignment" ta LEFT JOIN "Task" t ON ta."taskId" = t.id WHERE t.id IS NULL`
        },
        {
            table: 'Attendance',
            query: `SELECT a.id, a."userId" FROM "Attendance" a LEFT JOIN "User" u ON a."userId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'WorkSession',
            query: `SELECT ws.id, ws."attendanceId" FROM "WorkSession" ws LEFT JOIN "Attendance" a ON ws."attendanceId" = a.id WHERE a.id IS NULL`
        },
        {
            table: 'LeaveRequest (dangling employeeId)',
            query: `SELECT lr.id, lr."employeeId" FROM "LeaveRequest" lr LEFT JOIN "User" u ON lr."employeeId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'PerformanceReview (dangling employeeId)',
            query: `SELECT pr.id, pr."employeeId" FROM "PerformanceReview" pr LEFT JOIN "User" u ON pr."employeeId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'PayrollRecord (dangling employeeId)',
            query: `SELECT pr.id, pr."employeeId" FROM "PayrollRecord" pr LEFT JOIN "User" u ON pr."employeeId" = u.id WHERE u.id IS NULL`
        },
        {
            table: 'AuditLog (dangling userId)',
            query: `SELECT al.id, al."userId", al.action FROM "AuditLog" al LEFT JOIN "User" u ON al."userId" = u.id WHERE al."userId" IS NOT NULL AND u.id IS NULL`
        },
        {
            table: 'ActivityLog (dangling userId)',
            query: `SELECT al.id, al."userId", al.action FROM "ActivityLog" al LEFT JOIN "User" u ON al."userId" = u.id WHERE u.id IS NULL`
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

        if (systemOrgId && confirmReassignmentCount === String(nullUserAuditLogs.rows.length)) {
            console.log(`[AUTHORIZED] Operator explicitly confirmed reassignment of ${confirmReassignmentCount} system logs to organization "${systemOrgId}".`);
        } else {
            console.warn(`To authorize mapping these ${nullUserAuditLogs.rows.length} system logs to a primary organization, pass:`);
            console.warn(`  --system-org-id <org-uuid> --confirm-system-log-reassignment ${nullUserAuditLogs.rows.length}\n`);
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
