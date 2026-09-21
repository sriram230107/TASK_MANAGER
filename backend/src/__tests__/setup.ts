import dotenv from 'dotenv';
import path from 'node:path';
import pg from 'pg';

// 1. Load dotenv before reading TEST_DATABASE_URL
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// 2. Read TEST_DATABASE_URL and set DATABASE_URL BEFORE any app module loads
const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
    throw new Error(
        'CRITICAL ABORT: TEST_DATABASE_URL is not set in environment or backend/.env.\n' +
        'Please create your test database (e.g. portal_test) and configure TEST_DATABASE_URL.\n' +
        'See README.md for test database setup instructions.'
    );
}

process.env.DATABASE_URL = testUrl;
process.env.NODE_ENV = 'test';

// 3. Static URL validations
let parsed: URL;
try {
    parsed = new URL(testUrl);
} catch (err: any) {
    throw new Error(`CRITICAL ABORT: TEST_DATABASE_URL is not a valid URL: ${err.message}`);
}

const hostname = parsed.hostname;
if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    throw new Error(`CRITICAL ABORT: TEST_DATABASE_URL host must be localhost or 127.0.0.1 (got "${hostname}").`);
}

const dbName = parsed.pathname.replace(/^\//, '');
if (!dbName.endsWith('_test')) {
    throw new Error(`CRITICAL ABORT: TEST_DATABASE_URL database name must end with "_test" (got "${dbName}").`);
}

// 4. Live database verification guard
let verifiedDatabaseName = '';

const verifyTestDatabase = async () => {
    if (process.env.NODE_ENV !== 'test') {
        throw new Error(`CRITICAL ABORT: NODE_ENV must be "test" (got "${process.env.NODE_ENV}").`);
    }

    const client = new pg.Client({ connectionString: testUrl });
    try {
        await client.connect();
        const res = await client.query('SELECT current_database() AS db');
        const actualDb = res.rows[0]?.db;
        if (!actualDb || !actualDb.endsWith('_test')) {
            throw new Error(`CRITICAL ABORT: Connected database is "${actualDb}", which does NOT end with "_test"!`);
        }
        if (actualDb !== dbName) {
            throw new Error(`CRITICAL ABORT: Connected database "${actualDb}" does not match configured test database "${dbName}"!`);
        }
        verifiedDatabaseName = actualDb;
    } finally {
        await client.end().catch(() => {});
    }
};

// 5. Database cleaner helper (only runs after guard passed)
export const cleanDatabase = async () => {
    if (!verifiedDatabaseName || !verifiedDatabaseName.endsWith('_test')) {
        throw new Error('CRITICAL ABORT: Cannot clean database without verified _test database.');
    }
    const { clearSingleOrgCache } = await import('../middleware/tenant.middleware');
    clearSingleOrgCache();
    const { withoutTenant } = await import('../utils/prisma');
    await withoutTenant(async (unscoped) => {
        const tablenames = await unscoped.$queryRaw<Array<{ tablename: string }>>`
            SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename != '_prisma_migrations';
        `;
        const tables = tablenames
            .map(({ tablename }) => `"${tablename}"`)
            .join(', ');
        if (tables.length > 0) {
            await unscoped.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
        }
    });
};

import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
    await verifyTestDatabase();
});

afterAll(async () => {
    const { prisma } = await import('../utils/prisma');
    await prisma.$disconnect().catch(() => {});
});
