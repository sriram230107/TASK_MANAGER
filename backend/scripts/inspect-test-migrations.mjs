/**
 * Read-only listing of applied Prisma migrations on the guarded test database.
 * Uses TEST_DATABASE_URL only. Never prints the connection string.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendDir = path.resolve(__dirname, '..');

dotenv.config({ path: path.join(backendDir, '.env') });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
    console.error('FAIL: TEST_DATABASE_URL is not set.');
    process.exit(1);
}

let parsed;
try {
    parsed = new URL(testUrl);
} catch {
    console.error('FAIL: TEST_DATABASE_URL is not a valid URL.');
    process.exit(1);
}

if (parsed.hostname !== 'localhost' && parsed.hostname !== '127.0.0.1') {
    console.error(`FAIL: Refusing non-local host: ${parsed.hostname}`);
    process.exit(1);
}

const dbName = parsed.pathname.replace(/^\//, '');
if (!dbName.endsWith('_test')) {
    console.error(`FAIL: Refusing non-test database name: ${dbName}`);
    process.exit(1);
}

const client = new pg.Client({ connectionString: testUrl });
await client.connect();

try {
    const live = await client.query('SELECT current_database() AS db');
    const actualDb = live.rows[0]?.db;
    if (actualDb !== dbName || !actualDb.endsWith('_test')) {
        console.error(`FAIL: Connected to "${actualDb}", expected "${dbName}".`);
        process.exit(1);
    }

    console.log(`Database: ${actualDb}`);
    const table = await client.query(`SELECT to_regclass('public._prisma_migrations') AS reg`);
    if (!table.rows[0]?.reg) {
        console.log('_prisma_migrations does not exist on this database.');
        process.exit(0);
    }

    const rows = await client.query(`
        SELECT migration_name, finished_at, rolled_back_at, applied_steps_count
        FROM _prisma_migrations
        ORDER BY finished_at NULLS LAST, migration_name
    `);

    if (rows.rows.length === 0) {
        console.log('No rows in _prisma_migrations.');
        process.exit(0);
    }

    console.log('Applied migrations:');
    for (const row of rows.rows) {
        console.log(
            `- ${row.migration_name} | finished_at=${row.finished_at ? row.finished_at.toISOString() : 'null'} | rolled_back_at=${row.rolled_back_at ? row.rolled_back_at.toISOString() : 'null'} | steps=${row.applied_steps_count}`
        );
    }
} finally {
    await client.end();
}
