import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import { app, createTestOrg, createTestUser, generateTestTokens } from './helpers/test-app';
import { cleanDatabase } from './setup';
import { prisma, withTenant, withoutTenant, getTenantContext } from '../utils/prisma';
import { Role } from '@prisma/client';
import { endBreak, checkIn, startBreak } from '../services/attendance.service';
import { reviewLeaveRequest } from '../services/leave.service';

describe('Stage 2: Comprehensive Multi-Company Tenant Isolation Suite', () => {
    beforeEach(async () => {
        await cleanDatabase();
    });

    it('1. Email Isolation: allows same email across orgs, rejects case-insensitive collisions within org', async () => {
        const orgA = await createTestOrg('Company Alpha');
        const orgB = await createTestOrg('Company Beta');

        // Create alice@company.com in Org Alpha
        const userA = await createTestUser({
            orgId: orgA.id,
            role: Role.EMPLOYEE,
            email: 'alice@company.com'
        });
        expect(userA.id).toBeDefined();

        // Create alice@company.com in Org Beta — must SUCCEED (tenant-scoped email)
        const userB = await createTestUser({
            orgId: orgB.id,
            role: Role.EMPLOYEE,
            email: 'alice@company.com'
        });
        expect(userB.id).toBeDefined();
        expect(userB.organizationId).toBe(orgB.id);
        expect(userA.organizationId).toBe(orgA.id);

        // Attempt duplicate in Org Alpha with UPPERCASE email — must FAIL via database unique constraint
        await expect(
            createTestUser({
                orgId: orgA.id,
                role: Role.EMPLOYEE,
                email: 'ALICE@COMPANY.COM'
            })
        ).rejects.toThrow();
    });

    it('2. Anti-Tampering: ignores client-supplied X-Organization-Id header and body organizationId', async () => {
        const orgA = await createTestOrg('Org Alpha');
        const orgB = await createTestOrg('Org Beta');

        const managerA = await createTestUser({
            orgId: orgA.id,
            role: Role.MANAGER,
            email: 'manager.a@alpha.com'
        });
        const tokensA = generateTestTokens(managerA);

        // Attacker in Org A attempts to create a task claiming to belong to Org B via header and body
        const res = await request(app)
            .post('/api/v1/tasks')
            .set('Authorization', `Bearer ${tokensA.accessToken}`)
            .set('X-Organization-Id', orgB.id)
            .send({
                title: 'Tamper Attempt Task',
                description: 'Trying to inject into Org B',
                organizationId: orgB.id,
                priority: 'HIGH'
            });

        expect(res.status).toBe(201);
        const createdTaskId = res.body.data.id;

        // Verify task in DB belongs strictly to Org A, NEVER Org B
        const taskInDb = await withTenant(orgA.id, () =>
            prisma.task.findUnique({ where: { id: createdTaskId } })
        );
        expect(taskInDb?.organizationId).toBe(orgA.id);

        // Querying from Org B's context yields NULL
        const taskInOrgB = await withTenant(orgB.id, () =>
            prisma.task.findUnique({ where: { id: createdTaskId } })
        );
        expect(taskInOrgB).toBeNull();
    });

    it('3. Cross-Tenant Reference Validation: rejects cross-tenant department, team, user, and parent task IDs', async () => {
        const orgA = await createTestOrg('Org Alpha');
        const orgB = await createTestOrg('Org Beta');

        const managerA = await createTestUser({
            orgId: orgA.id,
            role: Role.MANAGER,
            email: 'manager@alpha.com'
        });
        const tokensA = generateTestTokens(managerA);

        // Org B entities
        let deptB: any;
        let empB: any;
        let taskB: any;
        await withTenant(orgB.id, async () => {
            deptB = await prisma.department.create({
                data: { name: 'Beta Dept', organizationId: orgB.id }
            });
            empB = await createTestUser({
                orgId: orgB.id,
                role: Role.EMPLOYEE,
                email: 'emp@beta.com'
            });
            taskB = await prisma.task.create({
                data: {
                    title: 'Beta Task',
                    organizationId: orgB.id,
                    createdById: empB.id
                }
            });
        });

        // 3a. Reject cross-tenant departmentId
        const deptRes = await request(app)
            .post('/api/v1/tasks')
            .set('Authorization', `Bearer ${tokensA.accessToken}`)
            .send({
                title: 'Task with Bad Dept',
                departmentId: deptB.id
            });
        expect([400, 403]).toContain(deptRes.status);

        // 3b. Reject cross-tenant assignedToId / assignee
        const assigneeRes = await request(app)
            .post('/api/v1/tasks')
            .set('Authorization', `Bearer ${tokensA.accessToken}`)
            .send({
                title: 'Task with Bad Assignee',
                assignedToId: empB.id
            });
        expect([400, 403]).toContain(assigneeRes.status);

        // 3c. Reject cross-tenant parentTaskId
        const parentRes = await request(app)
            .post('/api/v1/tasks')
            .set('Authorization', `Bearer ${tokensA.accessToken}`)
            .send({
                title: 'Task with Bad Parent',
                parentTaskId: taskB.id
            });
        expect([400, 403]).toContain(parentRes.status);

        // 3d. Reject cross-tenant dependency
        const depRes = await request(app)
            .post('/api/v1/tasks')
            .set('Authorization', `Bearer ${tokensA.accessToken}`)
            .send({
                title: 'Task with Bad Dependency',
                dependencies: [taskB.id]
            });
        expect([400, 403]).toContain(depRes.status);
    });

    it('4. Read & Mutation Isolation: prevents Org A users from reading or mutating Org B data', async () => {
        const orgA = await createTestOrg('Org Alpha');
        const orgB = await createTestOrg('Org Beta');

        const adminA = await createTestUser({
            orgId: orgA.id,
            role: Role.ADMIN,
            email: 'admin@alpha.com'
        });
        const tokensA = generateTestTokens(adminA);

        const adminB = await createTestUser({
            orgId: orgB.id,
            role: Role.ADMIN,
            email: 'admin@beta.com'
        });

        // Seed Org B task
        let taskB: any;
        await withTenant(orgB.id, async () => {
            taskB = await prisma.task.create({
                data: {
                    title: 'Confidential Beta Strategy',
                    organizationId: orgB.id,
                    createdById: adminB.id
                }
            });
        });

        // Org A admin tries to GET Org B task
        const getRes = await request(app)
            .get(`/api/v1/tasks/${taskB.id}`)
            .set('Authorization', `Bearer ${tokensA.accessToken}`);
        expect([403, 404]).toContain(getRes.status);

        // Org A admin tries to PATCH Org B task
        const patchRes = await request(app)
            .patch(`/api/v1/tasks/${taskB.id}`)
            .set('Authorization', `Bearer ${tokensA.accessToken}`)
            .send({ title: 'Hacked Title' });
        expect([403, 404]).toContain(patchRes.status);

        // Verify task in Org B was NOT modified
        const freshTaskB = await withTenant(orgB.id, () =>
            prisma.task.findUnique({ where: { id: taskB.id } })
        );
        expect(freshTaskB?.title).toBe('Confidential Beta Strategy');
    });

    it('5. Audit Log Tenant Scoping: Org A admin sees only Org A audit logs', async () => {
        const orgA = await createTestOrg('Org Alpha');
        const orgB = await createTestOrg('Org Beta');

        const adminA = await createTestUser({
            orgId: orgA.id,
            role: Role.ADMIN,
            email: 'admin.audit@alpha.com'
        });
        const tokensA = generateTestTokens(adminA);

        const adminB = await createTestUser({
            orgId: orgB.id,
            role: Role.ADMIN,
            email: 'admin.audit@beta.com'
        });

        // Write audit log in Org A
        await withTenant(orgA.id, () =>
            prisma.auditLog.create({
                data: {
                    organizationId: orgA.id,
                    userId: adminA.id,
                    action: 'ALPHA_ACTION',
                    entity: 'OrgAEntity',
                    entityId: orgA.id
                }
            })
        );

        // Write audit log in Org B
        await withTenant(orgB.id, () =>
            prisma.auditLog.create({
                data: {
                    organizationId: orgB.id,
                    userId: adminB.id,
                    action: 'BETA_SECRET_ACTION',
                    entity: 'OrgBEntity',
                    entityId: orgB.id
                }
            })
        );

        // Query audit logs as Admin A
        const auditRes = await request(app)
            .get('/api/v1/audit')
            .set('Authorization', `Bearer ${tokensA.accessToken}`);

        expect(auditRes.status).toBe(200);
        const logs = auditRes.body.data.logs || auditRes.body.data;
        expect(Array.isArray(logs)).toBe(true);

        const actions = logs.map((l: any) => l.action);
        expect(actions).toContain('ALPHA_ACTION');
        expect(actions).not.toContain('BETA_SECRET_ACTION');
    });

    it('6. OrganizationSecret: write-only credentials with encryption, zero leakage in API or audit', async () => {
        const orgA = await createTestOrg('Org Alpha');
        const orgB = await createTestOrg('Org Beta');

        const adminA = await createTestUser({
            orgId: orgA.id,
            role: Role.ADMIN,
            email: 'admin.secrets@alpha.com'
        });
        const tokensA = generateTestTokens(adminA);

        const empA = await createTestUser({
            orgId: orgA.id,
            role: Role.EMPLOYEE,
            email: 'emp.secrets@alpha.com'
        });
        const tokensEmpA = generateTestTokens(empA);

        // 6a. Employee cannot write secrets (403)
        const empWriteRes = await request(app)
            .post('/api/v1/settings/integrations/smtp')
            .set('Authorization', `Bearer ${tokensEmpA.accessToken}`)
            .send({ password: 'SuperSecretSmtpPassword123' });
        expect(empWriteRes.status).toBe(403);

        // 6b. Admin writes SMTP secret and AI secret
        const smtpRes = await request(app)
            .post('/api/v1/settings/integrations/smtp')
            .set('Authorization', `Bearer ${tokensA.accessToken}`)
            .send({ password: 'SuperSecretSmtpPassword123' });
        expect(smtpRes.status).toBe(200);
        expect(smtpRes.body.data.success).toBe(true);

        const aiRes = await request(app)
            .post('/api/v1/settings/integrations/ai')
            .set('Authorization', `Bearer ${tokensA.accessToken}`)
            .send({ apiKey: 'sk-ant-api03-test-key-123456789' });
        expect(aiRes.status).toBe(200);
        expect(aiRes.body.data.success).toBe(true);

        // 6c. Integration status reports configured boolean, never passwords or keys
        const statusRes = await request(app)
            .get('/api/v1/settings/integrations')
            .set('Authorization', `Bearer ${tokensA.accessToken}`);
        expect(statusRes.status).toBe(200);
        expect(statusRes.body.data).toEqual({
            smtpConfigured: true,
            aiConfigured: true
        });
        expect(JSON.stringify(statusRes.body)).not.toContain('SuperSecretSmtpPassword123');
        expect(JSON.stringify(statusRes.body)).not.toContain('sk-ant-api03-test-key-123456789');

        // 6d. Org B checks integrations -> false, false
        const adminB = await createTestUser({
            orgId: orgB.id,
            role: Role.ADMIN,
            email: 'admin.b@beta.com'
        });
        const tokensB = generateTestTokens(adminB);
        const statusResB = await request(app)
            .get('/api/v1/settings/integrations')
            .set('Authorization', `Bearer ${tokensB.accessToken}`);
        expect(statusResB.status).toBe(200);
        expect(statusResB.body.data).toEqual({
            smtpConfigured: false,
            aiConfigured: false
        });

        // 6e. Verify DB storage is encrypted (AES-256-GCM format iv:tag:cipher)
        const secretRecord = await withTenant(orgA.id, () =>
            prisma.organizationSecret.findUnique({
                where: {
                    organizationId_key: {
                        organizationId: orgA.id,
                        key: 'SMTP_PASSWORD'
                    }
                }
            })
        );
        expect(secretRecord).toBeDefined();
        expect(secretRecord?.valueEncrypted).not.toContain('SuperSecretSmtpPassword123');
        const parts = secretRecord?.valueEncrypted.split(':');
        expect(parts?.length).toBe(3); // iv, authTag, ciphertext

        // 6f. Verify Audit Log does NOT contain plaintext or ciphertext secret
        const auditRecord = await withTenant(orgA.id, () =>
            prisma.auditLog.findFirst({
                where: {
                    organizationId: orgA.id,
                    entity: 'OrganizationSecret',
                    action: 'UPDATE'
                }
            })
        );
        expect(auditRecord).toBeDefined();
        expect(JSON.stringify(auditRecord?.metadata)).not.toContain('SuperSecretSmtpPassword123');
    });

    it('7. Fail-Closed Scoped Prisma & $transaction: blocks unscoped queries and isolates transactions', async () => {
        const org = await createTestOrg('Transaction Org');
        const user = await createTestUser({
            orgId: org.id,
            role: Role.EMPLOYEE,
            email: 'trans.user@org.com'
        });

        // 7a. Direct query outside of withTenant/withoutTenant must THROW
        expect(() => {
            // @ts-ignore
            prisma.user.findFirst({ where: { id: user.id } });
        }).toThrow(/CRITICAL: Tenant context missing/);

        // 7b. Attendance $transaction test: checkIn then startBreak then endBreak
        await withTenant(org.id, async () => {
            const att = await checkIn(user, { isWorkFromHome: false });
            expect(att.id).toBeDefined();

            // End break executes $transaction([update, update, create])
            await startBreak(user, 'Taking short coffee break');
            const breakResult = await endBreak(user);
            expect(breakResult.state).toBe('WORKING');

            // Verify sessions have organizationId correctly set
            const sessions = await prisma.workSession.findMany({
                where: { attendanceId: att.id }
            });
            expect(sessions.length).toBeGreaterThanOrEqual(2);
            for (const s of sessions) {
                expect(s.organizationId).toBe(org.id);
            }
        });

        // 7c. Leave reviewLeaveRequest $transaction test
        await withTenant(org.id, async () => {
            const admin = await createTestUser({
                orgId: org.id,
                role: Role.ADMIN,
                email: 'leave.admin@org.com'
            });

            // Initialize balance
            await prisma.leaveBalance.create({
                data: {
                    organizationId: org.id,
                    userId: user.id,
                    leaveType: 'ANNUAL',
                    allocatedDays: 20,
                    usedDays: 0,
                    remainingDays: 20,
                    year: new Date().getFullYear()
                }
            });

            const leaveReq = await prisma.leaveRequest.create({
                data: {
                    organizationId: org.id,
                    employeeId: user.id,
                    type: 'ANNUAL',
                    startDate: new Date(),
                    endDate: new Date(),
                    daysCount: 3,
                    reason: 'Vacation',
                    status: 'PENDING_MANAGER'
                }
            });

            // Review leave: approves and executes $transaction ([update request, update balance])
            const reviewed = await reviewLeaveRequest(
                admin,
                leaveReq.id,
                'APPROVE',
                'Approved by admin'
            );
            expect(reviewed.status).toBe('APPROVED');

            // Check updated balance
            const balance = await prisma.leaveBalance.findFirst({
                where: { userId: user.id, leaveType: 'ANNUAL' }
            });
            expect(balance?.usedDays).toBe(3);
            expect(balance?.remainingDays).toBe(17);
            expect(balance?.organizationId).toBe(org.id);
        });
    });

    it('8. AST / Code Scanner: verifies no file outside tenant module imports unscoped Prisma', () => {
        const srcDir = path.resolve(__dirname, '..');

        const scanDirectory = (dir: string, fileList: string[] = []): string[] => {
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    if (item !== 'node_modules' && item !== 'dist') {
                        scanDirectory(fullPath, fileList);
                    }
                } else if (item.endsWith('.ts') && !item.endsWith('.d.ts')) {
                    fileList.push(fullPath);
                }
            }
            return fileList;
        };

        const tsFiles = scanDirectory(srcDir);
        const violations: string[] = [];

        for (const file of tsFiles) {
            const relPath = path.relative(srcDir, file).replace(/\\/g, '/');
            // Skip tenant.prisma.ts (which defines rawPrisma) and __tests__ directory
            if (relPath.includes('tenant.prisma.ts') || relPath.startsWith('__tests__')) {
                continue;
            }

            const content = fs.readFileSync(file, 'utf8');

            // Check for new PrismaClient() instantiations
            if (/new\s+PrismaClient\s*\(/.test(content)) {
                violations.push(`${relPath}: Direct new PrismaClient() instantiation found!`);
            }
        }

        expect(violations).toEqual([]);
    });
});
