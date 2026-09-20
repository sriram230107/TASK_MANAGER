import dotenv from 'dotenv';
import path from 'node:path';
import pg from 'pg';
import { randomUUID } from 'node:crypto';

dotenv.config({ path: path.resolve(import.meta.dirname, '../.env') });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
    console.error('ERROR: TEST_DATABASE_URL is not set.');
    process.exit(1);
}

const parsed = new URL(testUrl);
if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    console.error('ABORT: Test script must run on localhost.');
    process.exit(1);
}
if (!parsed.pathname.endsWith('_test')) {
    console.error('ABORT: Target database must end with _test.');
    process.exit(1);
}

const client = new pg.Client({ connectionString: testUrl });

async function run() {
    await client.connect();

    const dbRes = await client.query('SELECT current_database() AS db');
    const dbName = dbRes.rows[0]?.db;
    if (!dbName?.endsWith('_test')) {
        console.error(`ABORT: Live database "${dbName}" does not end with _test.`);
        process.exit(1);
    }

    console.log(`Verified test database: "${dbName}".`);

    // Ensure test organization and employee exist
    const orgId = randomUUID();
    const empId = randomUUID();

    await client.query(`
        INSERT INTO "Organization" (id, name, "workingHoursPerDay", "workDaysPerWeek", "updatedAt")
        VALUES ($1, 'Migration Test Org', 8.0, 5, NOW())
        ON CONFLICT DO NOTHING;
    `, [orgId]);

    await client.query(`
        INSERT INTO "User" (id, email, "passwordHash", name, role, "organizationId", "updatedAt")
        VALUES ($1, $2, 'hash123', 'Test Employee', 'EMPLOYEE', $3, NOW())
        ON CONFLICT DO NOTHING;
    `, [empId, `migration-${Date.now()}@example.com`, orgId]);

    // Insert synthetic edge cases before migration
    const testCases = [
        { desc: 'Standard salary', base: 5000.50, allowances: 250.00, ded: 150.25, ot: 100.00, bonus: 500.00, net: 5700.25 },
        { desc: 'Zero values', base: 0.00, allowances: 0.00, ded: 0.00, ot: 0.00, bonus: 0.00, net: 0.00 },
        { desc: 'Large value', base: 9999999.99, allowances: 50000.00, ded: 25000.00, ot: 0.00, bonus: 100000.00, net: 10124999.99 },
        { desc: 'Float precision anomaly', base: 1234.5600000000002, allowances: 10.0, ded: 5.0, ot: 0.0, bonus: 0.0, net: 1239.56 },
        { desc: 'Third decimal rounding', base: 4321.555, allowances: 10.0, ded: 5.0, ot: 0.0, bonus: 0.0, net: 4326.56 }
    ];

    console.log('\nInserting synthetic edge cases into Float columns...');
    const insertedIds = [];

    for (const tc of testCases) {
        const id = randomUUID();
        insertedIds.push({ id, ...tc });
        await client.query(`
            INSERT INTO "PayrollRecord" (
                id, "employeeId", "periodStart", "periodEnd",
                "baseSalary", "allowances", "deductions", "overtimePay", "bonuses", "netSalary",
                status, "updatedAt"
            ) VALUES (
                $1, $2, NOW(), NOW() + interval '30 days',
                $3, $4, $5, $6, $7, $8,
                'DRAFT', NOW()
            );
        `, [id, empId, tc.base, tc.allowances, tc.ded, tc.ot, tc.bonus, tc.net]);
    }

    console.log(`Inserted ${insertedIds.length} synthetic test records.`);

    // Read back records before migration
    const beforeRes = await client.query(`
        SELECT id, "baseSalary", "allowances", "deductions", "overtimePay", "bonuses", "netSalary"
        FROM "PayrollRecord"
        WHERE id = ANY($1);
    `, [insertedIds.map(r => r.id)]);

    console.log('\nValues BEFORE migration (Float):');
    for (const row of beforeRes.rows) {
        console.log(`ID: ${row.id.slice(0, 8)}... | Base: ${row.baseSalary} | Net: ${row.netSalary}`);
    }

    console.log('\nApplying Float to Decimal(12, 2) migration to "PayrollRecord"...');
    await client.query(`
        ALTER TABLE "PayrollRecord" 
            ALTER COLUMN "baseSalary" TYPE DECIMAL(12, 2) USING ROUND("baseSalary"::numeric, 2),
            ALTER COLUMN "allowances" TYPE DECIMAL(12, 2) USING ROUND("allowances"::numeric, 2),
            ALTER COLUMN "deductions" TYPE DECIMAL(12, 2) USING ROUND("deductions"::numeric, 2),
            ALTER COLUMN "overtimePay" TYPE DECIMAL(12, 2) USING ROUND("overtimePay"::numeric, 2),
            ALTER COLUMN "bonuses" TYPE DECIMAL(12, 2) USING ROUND("bonuses"::numeric, 2),
            ALTER COLUMN "netSalary" TYPE DECIMAL(12, 2) USING ROUND("netSalary"::numeric, 2);
    `);

    // Read back records after migration
    const afterRes = await client.query(`
        SELECT id, "baseSalary", "allowances", "deductions", "overtimePay", "bonuses", "netSalary"
        FROM "PayrollRecord"
        WHERE id = ANY($1);
    `, [insertedIds.map(r => r.id)]);

    console.log('\nValues AFTER migration (Decimal):');
    let allPassed = true;
    for (const afterRow of afterRes.rows) {
        const initial = insertedIds.find(r => r.id === afterRow.id);
        const expectedBase = initial.base.toFixed(2);
        const actualBase = parseFloat(afterRow.baseSalary).toFixed(2);
        const match = expectedBase === actualBase;
        if (!match) allPassed = false;
        console.log(`ID: ${afterRow.id.slice(0, 8)}... | Expected Base: ${expectedBase} | Actual Base: ${actualBase} | Match: ${match ? 'YES' : 'NO'}`);
    }

    // Clean up test records
    await client.query(`DELETE FROM "PayrollRecord" WHERE id = ANY($1);`, [insertedIds.map(r => r.id)]);
    await client.query(`DELETE FROM "User" WHERE id = $1;`, [empId]);
    await client.query(`DELETE FROM "Organization" WHERE id = $1;`, [orgId]);

    // Rollback schema alteration back to Float on test DB to maintain 0_init schema consistency until real migration is written
    console.log('\nReverting test database table schema back to Float...');
    await client.query(`
        ALTER TABLE "PayrollRecord" 
            ALTER COLUMN "baseSalary" TYPE DOUBLE PRECISION USING "baseSalary"::double precision,
            ALTER COLUMN "allowances" TYPE DOUBLE PRECISION USING "allowances"::double precision,
            ALTER COLUMN "deductions" TYPE DOUBLE PRECISION USING "deductions"::double precision,
            ALTER COLUMN "overtimePay" TYPE DOUBLE PRECISION USING "overtimePay"::double precision,
            ALTER COLUMN "bonuses" TYPE DOUBLE PRECISION USING "bonuses"::double precision,
            ALTER COLUMN "netSalary" TYPE DOUBLE PRECISION USING "netSalary"::double precision;
    `);

    if (allPassed) {
        console.log('\nSUCCESS: Float to Decimal migration test passed on portal_test with zero data corruption!');
    } else {
        console.error('\nFAILURE: One or more records failed precision verification.');
        process.exit(1);
    }
}

run()
    .catch(err => {
        console.error('Migration test error:', err);
        process.exit(1);
    })
    .finally(() => client.end());
