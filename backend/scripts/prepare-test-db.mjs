import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import pg from 'pg';

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
    console.error('ERROR: TEST_DATABASE_URL is not defined in environment or backend/.env.');
    console.error('Please create your test database (e.g. portal_test) and set TEST_DATABASE_URL.');
    process.exit(1);
}

let parsed;
try {
    parsed = new URL(testUrl);
} catch (err) {
    console.error('ERROR: TEST_DATABASE_URL is not a valid URL.');
    process.exit(1);
}

const hostname = parsed.hostname;
if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    console.error(`ERROR: TEST_DATABASE_URL host must be localhost or 127.0.0.1 (got "${hostname}").`);
    process.exit(1);
}

const dbName = parsed.pathname.replace(/^\//, '');
if (!dbName.endsWith('_test')) {
    console.error(`ERROR: TEST_DATABASE_URL database name must end with "_test" (got "${dbName}").`);
    process.exit(1);
}

// Live query guard: verify connected database actually ends with _test
const client = new pg.Client({ connectionString: testUrl });
try {
    await client.connect();
    const res = await client.query('SELECT current_database() AS db');
    const actualDb = res.rows[0]?.db;
    if (!actualDb || !actualDb.endsWith('_test')) {
        console.error(`CRITICAL ABORT: Connected database is "${actualDb}", which does NOT end with "_test".`);
        process.exit(1);
    }
    if (actualDb !== dbName) {
        console.error(`CRITICAL ABORT: Connected database "${actualDb}" does not match configured test database "${dbName}".`);
        process.exit(1);
    }
    console.log(`Verified test database connection: "${actualDb}" on ${hostname}.`);
} catch (err) {
    console.error(`ERROR: Could not connect to test database at ${testUrl}: ${err.message}`);
    process.exit(1);
} finally {
    await client.end();
}

console.log(`Deploying migrations to test database "${dbName}"...`);

// Spawn Prisma with an environment where DATABASE_URL is strictly TEST_DATABASE_URL
const env = {
    ...process.env,
    DATABASE_URL: testUrl,
    NODE_ENV: 'test',
};

const isWindows = process.platform === 'win32';
const cmd = isWindows ? 'npx.cmd' : 'npx';

const result = spawnSync(cmd, ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    env,
    cwd: process.cwd(),
    shell: true,
});

if (result.status !== 0) {
    if (result.error) {
        console.error('Spawn error:', result.error);
    }
    console.error('ERROR: Failed to deploy migrations to test database.');
    process.exit(result.status ?? 1);
}

console.log(`Test database "${dbName}" prepared successfully.`);
