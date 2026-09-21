import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, createTestOrg, createTestUser } from './helpers/test-app';
import { cleanDatabase } from './setup';
import { prisma, withTenant } from '../utils/prisma';
import { hashToken } from '../utils/tokens';

describe('Auth Integration Tests', () => {
    beforeEach(async () => {
        await cleanDatabase();
    });

    it('authenticates user with case-insensitive email', async () => {
        const org = await createTestOrg('Auth Test Org');
        await createTestUser({
            orgId: org.id,
            role: 'EMPLOYEE',
            email: 'john.doe@example.com',
            password: 'StrongPassword123!'
        });

        // Test login with UPPERCASE email
        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'JOHN.DOE@EXAMPLE.COM',
                password: 'StrongPassword123!'
            });

        expect(res.status).toBe(200);
        expect(res.body.data.accessToken).toBeDefined();
        expect(res.body.data.user.email).toBe('john.doe@example.com');
        expect(res.body.data.user.passwordHash).toBeUndefined();
    });

    it('rejects invalid password with 401', async () => {
        const org = await createTestOrg('Auth Test Org');
        await createTestUser({
            orgId: org.id,
            role: 'EMPLOYEE',
            email: 'jane.doe@example.com',
            password: 'CorrectPassword123!'
        });

        const res = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'jane.doe@example.com',
                password: 'WrongPassword123!'
            });

        expect(res.status).toBe(401);
        expect(res.body.error).toBeDefined();
    });

    it('verifies req.user.passwordHash is undefined and not exposed on /me', async () => {
        const org = await createTestOrg('Auth Test Org');
        const user = await createTestUser({
            orgId: org.id,
            role: 'EMPLOYEE',
            email: 'user.safe@example.com',
            password: 'SecretPassword123!'
        });

        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'user.safe@example.com',
                password: 'SecretPassword123!'
            });

        const token = loginRes.body.data.accessToken;

        const meRes = await request(app)
            .get('/api/v1/auth/me')
            .set('Authorization', `Bearer ${token}`);

        expect(meRes.status).toBe(200);
        expect(meRes.body.data.email).toBe('user.safe@example.com');
        expect(meRes.body.data.passwordHash).toBeUndefined();

        // Also check DB record for this user directly via prisma to prove hash is stored,
        // but auth middleware strips it from req.user
        const dbUser = await withTenant(org.id, () => prisma.user.findUnique({ where: { id: user.id } }));
        expect(dbUser?.passwordHash).toBeDefined();
    });

    it('rotates refresh tokens and invalidates the old token', async () => {
        const org = await createTestOrg('Auth Test Org');
        await createTestUser({
            orgId: org.id,
            role: 'EMPLOYEE',
            email: 'rotation.user@example.com',
            password: 'RotationPassword123!'
        });

        const loginRes = await request(app)
            .post('/api/v1/auth/login')
            .send({
                email: 'rotation.user@example.com',
                password: 'RotationPassword123!'
            });

        const cookies = loginRes.headers['set-cookie'] as unknown as string[];
        expect(cookies).toBeDefined();
        const refreshCookie = cookies.find((c: string) => c.startsWith('refreshToken='));
        expect(refreshCookie).toBeDefined();
        const rawRefreshToken = refreshCookie!.split(';')[0].split('=')[1];

        // Perform first refresh
        const refreshRes1 = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', [`refreshToken=${rawRefreshToken}`]);

        expect(refreshRes1.status).toBe(200);
        expect(refreshRes1.body.data.accessToken).toBeDefined();

        const cookies2 = refreshRes1.headers['set-cookie'] as unknown as string[];
        const refreshCookie2 = cookies2.find((c: string) => c.startsWith('refreshToken='));
        expect(refreshCookie2).toBeDefined();
        const rawRefreshToken2 = refreshCookie2!.split(';')[0].split('=')[1];

        // The old refresh token must now be revoked in database
        const oldRecord = await withTenant(org.id, () =>
            prisma.refreshToken.findUnique({
                where: { tokenHash: hashToken(rawRefreshToken) }
            })
        );
        expect(oldRecord?.revokedAt).not.toBeNull();

        // Trying to reuse the OLD refresh token must fail with 401
        const reuseRes = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', [`refreshToken=${rawRefreshToken}`]);

        expect(reuseRes.status).toBe(401);

        // Using the NEW refresh token succeeds
        const refreshRes2 = await request(app)
            .post('/api/v1/auth/refresh')
            .set('Cookie', [`refreshToken=${rawRefreshToken2}`]);

        expect(refreshRes2.status).toBe(200);
    });
});
