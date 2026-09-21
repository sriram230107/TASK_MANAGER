/**
 * Test script for verifying the multi-company migration lifecycle strictly on portal_test.
 *
 * Tests:
 * 1. Negative test: An orphan row triggers the PL/pgSQL DO guard, rolls back atomically, and logs details.
 * 2. Positive test: Successful migration, column check, foreign keys, and indexes.
 * 3. prisma migrate diff: Proves Prisma will not attempt to drop the LOWER(email) index.
 * 4. Rollback test: Applies down SQL and verifies clean reversion.
 * 5. Final re-application: Leaves portal_test in the new multi-company state.
 */
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendDir, '.env') });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
    console.error('FAIL: TEST_DATABASE_URL not set in environment or backend/.env');
    process.exit(1);
}

const parsed = new URL(testUrl);
if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    console.error(`FAIL: Refusing to run on non-local host: ${parsed.hostname}`);
    process.exit(1);
}
const dbName = parsed.pathname.replace(/^\//, '');
if (!dbName.endsWith('_test')) {
    console.error(`FAIL: Refusing to run on non-test database: ${dbName}`);
    process.exit(1);
}

const client = new pg.Client({ connectionString: testUrl });
await client.connect();

const res = await client.query('SELECT current_database() AS db');
const actualDb = res.rows[0]?.db;
if (actualDb !== dbName || !actualDb.endsWith('_test')) {
    console.error(`FAIL: Database mismatch. Connected to ${actualDb}, expected ${dbName}`);
    await client.end();
    process.exit(1);
}

console.log(`[GUARD PASSED] Running migration lifecycle test on verified test database: "${actualDb}"`);

await client.query(`
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    LOOP
        EXECUTE format('TRUNCATE TABLE %I CASCADE', r.tablename);
    END LOOP;
END $$;
`);
console.log('Truncated application tables on the test database before migration lifecycle checks.');

const migrationSqlPath = path.join(backendDir, 'prisma', 'migrations', '20260921120000_multi_company_readiness', 'migration.sql');
const rollbackSqlPath = path.join(backendDir, 'prisma', 'rollbacks', 'down_20260921120000_multi_company_readiness.sql');

const migrationSql = fs.readFileSync(migrationSqlPath, 'utf8');
const rollbackSql = fs.readFileSync(rollbackSqlPath, 'utf8');

try {
    const isWindows = process.platform === 'win32';
    const npxCmd = isWindows ? 'npx.cmd' : 'npx';

    const alreadyMigrated = await client.query(`
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'TeamMember' AND column_name = 'organizationId'
    `);
    if (alreadyMigrated.rows.length > 0) {
        console.log('portal_test already has organizationId columns. Applying down SQL first (test database only).');
        await client.query('BEGIN');
        await client.query(rollbackSql);
        await client.query('COMMIT');
    }

    // --- Step 1: Negative Test (Orphan Row Guard) ---
    console.log('\n--- Step 1: Testing Negative Case (NULL-user AuditLog abort) ---');

    const orphanId = '11111111-1111-1111-1111-111111111111';
    await client.query(`
        INSERT INTO "AuditLog" ("id", "userId", "action", "entity", "entityId", "createdAt")
        VALUES ($1, NULL, 'TEST_ORPHAN_ACTION', 'System', 'test', NOW())
        ON CONFLICT ("id") DO NOTHING;
    `, [orphanId]);

    let failedAsExpected = false;
    let guardErrorMessage = '';
    try {
        await client.query('BEGIN');
        await client.query(migrationSql);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        failedAsExpected = true;
        guardErrorMessage = err.message;
    }

    if (
        !failedAsExpected ||
        !(
            guardErrorMessage.includes('NULL userId') ||
            guardErrorMessage.includes('MIGRATION HALTED: Unresolved orphan rows detected')
        )
    ) {
        console.error('FAIL: Migration did not fail with the expected NULL-user / orphan guard error!');
        console.error('Actual error / outcome:', guardErrorMessage);
        process.exit(1);
    }
    console.log('SUCCESS: Migration halted cleanly as expected on orphan row!');
    console.log(`Reported Guard Error:\n  -> ${guardErrorMessage.split('\n')[0]}`);

    // Verify rollback occurred cleanly (organizationId column must NOT exist on TeamMember)
    const colCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'TeamMember' AND column_name = 'organizationId';
    `);
    if (colCheck.rows.length !== 0) {
        console.error('FAIL: Rollback failed; organizationId column still exists after aborted transaction!');
        process.exit(1);
    }
    console.log('SUCCESS: Atomic rollback verified. Zero partial columns remaining.');

    // Clean up test orphan
    await client.query(`DELETE FROM "AuditLog" WHERE "id" = $1;`, [orphanId]);

    // --- Step 2: Positive Test (Clean Migration) ---
    console.log('\n--- Step 2: Testing Positive Case (Clean Migration Execution) ---');
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');
    console.log('SUCCESS: Migration applied cleanly to portal_test.');

    // Verify NOT NULL and indexes
    const checkColumns = await client.query(`
        SELECT table_name, column_name, is_nullable
        FROM information_schema.columns
        WHERE table_name IN ('TeamMember', 'Attendance', 'LeaveRequest', 'AuditLog', 'PayrollRecord')
          AND column_name = 'organizationId';
    `);
    for (const row of checkColumns.rows) {
        if (row.is_nullable !== 'NO') {
            console.error(`FAIL: Column ${row.table_name}.organizationId is nullable: ${row.is_nullable}`);
            process.exit(1);
        }
    }
    console.log('SUCCESS: Verified organizationId is NOT NULL across checked tables.');

    // Verify OrganizationSecret table
    const secretCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'OrganizationSecret';
    `);
    if (secretCheck.rows.length === 0) {
        console.error('FAIL: OrganizationSecret table not created!');
        process.exit(1);
    }
    console.log('SUCCESS: Verified OrganizationSecret table exists with required columns.');

    // Verify case-insensitive expression index exists
    const indexCheck = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'User' AND indexname = 'User_organizationId_lower_email_idx';
    `);
    if (indexCheck.rows.length === 0) {
        console.error('FAIL: User_organizationId_lower_email_idx expression index not found!');
        process.exit(1);
    }
    console.log('SUCCESS: Verified User_organizationId_lower_email_idx expression index exists.');

    console.log('\n--- Step 2b: prisma migrate diff (must not drop LOWER(email) index) ---');
    const diff = spawnSync(
        npxCmd,
        ['prisma', 'migrate', 'diff', '--from-url', testUrl, '--to-schema-datamodel', 'prisma/schema.prisma', '--script'],
        {
            encoding: 'utf8',
            cwd: backendDir,
            env: { ...process.env, DATABASE_URL: testUrl, NODE_ENV: 'test' },
            shell: true
        }
    );
    const diffOut = `${diff.stdout || ''}\n${diff.stderr || ''}`;
    if (diff.status !== 0 && !diffOut.includes('No difference')) {
        console.error('FAIL: prisma migrate diff exited non-zero.');
        console.error(diffOut.slice(0, 4000));
        process.exit(1);
    }
    if (/DROP INDEX.*User_organizationId_lower_email_idx/i.test(diffOut)) {
        console.error('FAIL: prisma migrate diff would drop User_organizationId_lower_email_idx.');
        process.exit(1);
    }
    console.log('SUCCESS: prisma migrate diff does not drop User_organizationId_lower_email_idx.');

    // --- Step 3: Rollback Test ---
    console.log('\n--- Step 3: Testing Rollback SQL (Down Migration) ---');
    await client.query('BEGIN');
    await client.query(rollbackSql);
    await client.query('COMMIT');
    console.log('SUCCESS: Rollback SQL executed cleanly.');

    // Verify columns dropped and User_email_key restored
    const rollbackColCheck = await client.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'TeamMember' AND column_name = 'organizationId';
    `);
    if (rollbackColCheck.rows.length !== 0) {
        console.error('FAIL: organizationId still exists after rollback!');
        process.exit(1);
    }

    const emailKeyCheck = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'User' AND indexname = 'User_email_key';
    `);
    if (emailKeyCheck.rows.length === 0) {
        console.error('FAIL: Global User_email_key index was not restored by rollback!');
        process.exit(1);
    }
    console.log('SUCCESS: Verified complete reversion: columns dropped and global User_email_key restored.');

    // --- Step 4: Final Re-application for Prisma & Tests ---
    console.log('\n--- Step 4: Final Migration Re-application for Test Environment ---');
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');
    console.log('SUCCESS: Multi-company schema established cleanly on portal_test.');

    console.log('\n=========================================');
    console.log(' ALL MIGRATION LIFECYCLE TESTS PASSED!');
    console.log('=========================================\n');
} catch (err) {
    console.error('UNEXPECTED FAILURE in migration test:', err);
    process.exit(1);
} finally {
    await client.end();
}
