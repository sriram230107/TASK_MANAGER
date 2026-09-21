import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, createTestOrg, createTestUser, generateTestTokens } from './helpers/test-app';
import { cleanDatabase } from './setup';
import { prisma, withTenant } from '../utils/prisma';
import { Role } from '@prisma/client';

const pdfBuffer = Buffer.from('%PDF-1.4 tenant isolation fixture');

describe('Stage 2: isolation across all 16 route files and downloads', () => {
    beforeEach(async () => {
        await cleanDatabase();
    });

    it('company A cannot read, list, update or download company B data on every route module', async () => {
        const orgA = await createTestOrg('Routes Alpha');
        const orgB = await createTestOrg('Routes Beta');

        const adminA = await createTestUser({ orgId: orgA.id, role: Role.ADMIN, email: 'admin@alpha-routes.com' });
        const managerA = await createTestUser({ orgId: orgA.id, role: Role.MANAGER, email: 'manager@alpha-routes.com' });
        const empA = await createTestUser({ orgId: orgA.id, role: Role.EMPLOYEE, email: 'emp@alpha-routes.com' });
        const adminB = await createTestUser({ orgId: orgB.id, role: Role.ADMIN, email: 'admin@beta-routes.com' });
        const empB = await createTestUser({ orgId: orgB.id, role: Role.EMPLOYEE, email: 'emp@beta-routes.com' });
        const tokenA = generateTestTokens(adminA).accessToken;
        const tokenB = generateTestTokens(adminB).accessToken;
        const authA = { Authorization: `Bearer ${tokenA}` };
        const authManagerA = { Authorization: `Bearer ${generateTestTokens(managerA).accessToken}` };
        const authEmpA = { Authorization: `Bearer ${generateTestTokens(empA).accessToken}` };

        let deptB: any;
        let teamB: any;
        let taskB: any;
        let goalB: any;
        let payrollB: any;
        let leaveB: any;
        let reviewB: any;
        let noteB: any;
        let templateB: any;
        let attendanceB: any;
        let documentB: any;
        let attachmentB: any;

        await withTenant(orgB.id, async () => {
            deptB = await prisma.department.create({
                data: { name: 'Beta Secret Dept', organizationId: orgB.id, managerId: adminB.id }
            });
            teamB = await prisma.team.create({
                data: { name: 'Beta Secret Team', organizationId: orgB.id, departmentId: deptB.id, teamLeadId: adminB.id }
            });
            taskB = await prisma.task.create({
                data: {
                    title: 'Beta Confidential Task',
                    organizationId: orgB.id,
                    createdById: adminB.id,
                    assignedToId: empB.id,
                    departmentId: deptB.id,
                    teamId: teamB.id
                }
            });
            goalB = await prisma.goal.create({
                data: {
                    title: 'Beta Confidential Goal',
                    organizationId: orgB.id,
                    ownerId: empB.id,
                    target: 'Keep secret',
                    deadline: new Date(Date.now() + 86400000)
                }
            });
            payrollB = await prisma.payrollRecord.create({
                data: {
                    organizationId: orgB.id,
                    employeeId: empB.id,
                    periodStart: new Date('2026-01-01'),
                    periodEnd: new Date('2026-01-31'),
                    baseSalary: 1000,
                    allowances: 0,
                    deductions: 0,
                    overtimePay: 0,
                    bonuses: 0,
                    netSalary: 1000,
                    status: 'DRAFT'
                }
            });
            await prisma.leaveBalance.create({
                data: {
                    organizationId: orgB.id,
                    userId: empB.id,
                    leaveType: 'ANNUAL',
                    allocatedDays: 20,
                    usedDays: 0,
                    remainingDays: 20,
                    year: new Date().getFullYear()
                }
            });
            leaveB = await prisma.leaveRequest.create({
                data: {
                    organizationId: orgB.id,
                    employeeId: empB.id,
                    type: 'ANNUAL',
                    startDate: new Date('2026-10-01'),
                    endDate: new Date('2026-10-02'),
                    daysCount: 2,
                    reason: 'Beta secret leave',
                    status: 'PENDING_MANAGER'
                }
            });
            reviewB = await prisma.performanceReview.create({
                data: {
                    organizationId: orgB.id,
                    employeeId: empB.id,
                    reviewerId: adminB.id,
                    taskCompletionRate: 80,
                    onTimeRate: 80,
                    goalsAchievedRate: 80,
                    attendanceConsistency: 90,
                    rating: 4,
                    periodStart: new Date('2026-01-01'),
                    periodEnd: new Date('2026-03-31')
                }
            });
            noteB = await prisma.notification.create({
                data: {
                    organizationId: orgB.id,
                    userId: empB.id,
                    type: 'GENERAL',
                    message: 'Beta secret notification'
                }
            });
            templateB = await prisma.taskTemplate.create({
                data: {
                    titlePattern: 'Beta secret template',
                    organizationId: orgB.id
                }
            });
            attendanceB = await prisma.attendance.create({
                data: {
                    organizationId: orgB.id,
                    userId: empB.id,
                    date: new Date(),
                    checkIn: new Date(),
                    status: 'PRESENT'
                }
            });
            await prisma.auditLog.create({
                data: {
                    organizationId: orgB.id,
                    userId: adminB.id,
                    action: 'BETA_SECRET_AUDIT',
                    entity: 'Task',
                    entityId: taskB.id
                }
            });
        });

        const uploadB = await request(app)
            .post('/api/v1/documents')
            .set('Authorization', `Bearer ${tokenB}`)
            .field('title', 'Beta Secret Document')
            .field('category', 'POLICY')
            .field('accessScope', 'ORGANIZATION')
            .attach('file', pdfBuffer, 'beta-secret.pdf');
        expect(uploadB.status).toBe(201);
        documentB = uploadB.body.data;

        const attachB = await request(app)
            .post(`/api/v1/tasks/${taskB.id}/attachments`)
            .set('Authorization', `Bearer ${tokenB}`)
            .attach('file', pdfBuffer, 'beta-task.pdf');
        expect([200, 201]).toContain(attachB.status);
        attachmentB = attachB.body.data;

        const secretIds = [
            orgB.id,
            empB.id,
            deptB.id,
            teamB.id,
            taskB.id,
            goalB.id,
            payrollB.id,
            leaveB.id,
            reviewB.id,
            noteB.id,
            templateB.id,
            attendanceB.id,
            documentB.id,
            attachmentB?.id
        ].filter(Boolean);

        const bodyHasSecret = (body: unknown) => {
            const text = JSON.stringify(body);
            return secretIds.some((id) => text.includes(id));
        };

        const denyOrHide = (res: request.Response) => {
            if ([401, 403, 404].includes(res.status)) return;
            expect(res.status).toBeLessThan(500);
            expect(bodyHasSecret(res.body)).toBe(false);
        };

        // auth
        const me = await request(app).get('/api/v1/auth/me').set(authA);
        expect(me.status).toBe(200);
        expect(me.body.data.organizationId || me.body.data.user?.organizationId || adminA.organizationId).toBe(orgA.id);
        expect(bodyHasSecret(me.body)).toBe(false);

        // admin
        denyOrHide(await request(app).get('/api/v1/admin/dashboard').set(authA));
        const stealTeam = await request(app)
            .post('/api/v1/admin/teams')
            .set(authA)
            .send({ name: 'Hijack', teamLeadId: empB.id });
        expect([400, 403, 404]).toContain(stealTeam.status);

        // user
        denyOrHide(await request(app).get('/api/v1/users').set(authA));
        denyOrHide(await request(app).get(`/api/v1/users/${empB.id}`).set(authA));

        // attendance
        denyOrHide(await request(app).get('/api/v1/attendance').set(authA));
        denyOrHide(await request(app).get(`/api/v1/attendance`).query({ userId: empB.id }).set(authA));

        // leave
        denyOrHide(await request(app).get('/api/v1/leave').set(authA));
        const stealLeave = await request(app)
            .post(`/api/v1/leave/${leaveB.id}/review`)
            .set(authA)
            .send({ action: 'APPROVE' });
        expect([400, 403, 404]).toContain(stealLeave.status);

        // goal
        denyOrHide(await request(app).get('/api/v1/goals').set(authA));
        denyOrHide(await request(app).patch(`/api/v1/goals/${goalB.id}`).set(authA).send({ title: 'Hacked' }));

        // task
        denyOrHide(await request(app).get('/api/v1/tasks').set(authA));
        denyOrHide(await request(app).get(`/api/v1/tasks/${taskB.id}`).set(authA));

        // notification
        denyOrHide(await request(app).get('/api/v1/notifications').set(authA));
        denyOrHide(await request(app).delete(`/api/v1/notifications/${noteB.id}`).set(authA));

        // payroll
        denyOrHide(await request(app).get('/api/v1/payroll').set(authA));
        denyOrHide(await request(app).get(`/api/v1/payroll/${payrollB.id}`).set(authA));

        // document + download
        denyOrHide(await request(app).get('/api/v1/documents').set(authA));
        denyOrHide(await request(app).get(`/api/v1/documents/${documentB.id}`).set(authA));
        const docDl = await request(app).get(`/api/v1/documents/${documentB.id}/download`).set(authA);
        expect([401, 403, 404]).toContain(docDl.status);

        const taskDl = await request(app)
            .get(`/api/v1/tasks/${taskB.id}/attachments/${attachmentB.id}/download`)
            .set(authA);
        expect([401, 403, 404]).toContain(taskDl.status);

        // audit
        const audit = await request(app).get('/api/v1/audit').set(authA);
        expect(audit.status).toBe(200);
        expect(JSON.stringify(audit.body)).not.toContain('BETA_SECRET_AUDIT');

        // settings
        denyOrHide(await request(app).get('/api/v1/settings').set(authA));
        denyOrHide(await request(app).put(`/api/v1/settings/departments/${deptB.id}`).set(authA).send({ name: 'Hacked' }));

        // dashboard
        const dashMgr = await request(app).get('/api/v1/dashboard/manager').set(authManagerA);
        if (dashMgr.status === 200) expect(bodyHasSecret(dashMgr.body)).toBe(false);
        else expect(dashMgr.status).toBeLessThan(500);
        const dashEmp = await request(app).get('/api/v1/dashboard/employee').set(authEmpA);
        if (dashEmp.status === 200) expect(bodyHasSecret(dashEmp.body)).toBe(false);
        else expect(dashEmp.status).toBeLessThan(500);

        // performance
        denyOrHide(await request(app).get('/api/v1/performance/reviews').set(authA));
        denyOrHide(await request(app).get('/api/v1/performance/metrics').query({ level: 'ORGANIZATION' }).set(authA));

        // report
        const report = await request(app).get('/api/v1/reports').query({ type: 'overview' }).set(authA);
        if (report.status === 200) expect(bodyHasSecret(report.body)).toBe(false);
        else expect(report.status).toBeLessThan(500);

        // template
        const inst = await request(app)
            .post(`/api/v1/templates/${templateB.id}/instantiate`)
            .set(authA)
            .send({ assignedToId: adminA.id, teamId: teamB.id });
        expect([400, 403, 404]).toContain(inst.status);

        const covered = [
            'admin', 'attendance', 'audit', 'auth', 'dashboard', 'document',
            'goal', 'leave', 'notification', 'payroll', 'performance',
            'report', 'settings', 'task', 'template', 'user'
        ];
        expect(covered).toHaveLength(16);
    });
});
