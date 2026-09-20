import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, createTestOrg, createTestUser, generateTestTokens } from './helpers/test-app';
import { cleanDatabase } from './setup';
import { prisma } from '../utils/prisma';

describe('Task Status Workflow & Role Permissions', () => {
    beforeEach(async () => {
        await cleanDatabase();
    });

    it('enforces task status transitions and prevents employees from self-approving completion', async () => {
        const org = await createTestOrg('Task Workflow Org');

        const manager = await createTestUser({
            orgId: org.id,
            role: 'MANAGER',
            email: 'manager@workflow.com'
        });

        const emp1 = await createTestUser({
            orgId: org.id,
            role: 'EMPLOYEE',
            email: 'employee1@workflow.com',
            managerId: manager.id
        });

        const emp2 = await createTestUser({
            orgId: org.id,
            role: 'EMPLOYEE',
            email: 'employee2@workflow.com',
            managerId: manager.id
        });

        const managerTokens = generateTestTokens(manager);
        const emp1Tokens = generateTestTokens(emp1);
        const emp2Tokens = generateTestTokens(emp2);

        // Manager creates task assigned to Employee 1
        const task = await prisma.task.create({
            data: {
                title: 'Build Authentication',
                status: 'ASSIGNED',
                priority: 'HIGH',
                organizationId: org.id,
                createdById: manager.id,
                assignedToId: emp1.id,
                assignedEmployeeId: emp1.id,
                assignedManagerId: manager.id
            }
        });

        // 1. Employee 2 cannot update Employee 1's task
        const emp2Res = await request(app)
            .patch(`/api/v1/tasks/${task.id}/status`)
            .set('Authorization', `Bearer ${emp2Tokens.accessToken}`)
            .send({ status: 'ACCEPTED' });
        expect(emp2Res.status).toBe(403);

        // 2. Employee 1 accepts task: ASSIGNED -> ACCEPTED
        const acceptRes = await request(app)
            .patch(`/api/v1/tasks/${task.id}/status`)
            .set('Authorization', `Bearer ${emp1Tokens.accessToken}`)
            .send({ status: 'ACCEPTED' });
        expect(acceptRes.status).toBe(200);
        expect(acceptRes.body.data.status).toBe('ACCEPTED');

        // 3. Employee 1 begins work: ACCEPTED -> IN_PROGRESS
        const progressRes = await request(app)
            .patch(`/api/v1/tasks/${task.id}/status`)
            .set('Authorization', `Bearer ${emp1Tokens.accessToken}`)
            .send({ status: 'IN_PROGRESS', progressPercent: 50 });
        expect(progressRes.status).toBe(200);
        expect(progressRes.body.data.status).toBe('IN_PROGRESS');

        // 4. Employee 1 tries to approve / complete own task: IN_PROGRESS -> COMPLETED (MUST FAIL)
        const completeAttemptRes = await request(app)
            .patch(`/api/v1/tasks/${task.id}/status`)
            .set('Authorization', `Bearer ${emp1Tokens.accessToken}`)
            .send({ status: 'COMPLETED' });
        expect([400, 403]).toContain(completeAttemptRes.status);
        expect(completeAttemptRes.body.error).toBeDefined();

        // 5. Employee 1 submits for review: IN_PROGRESS -> SUBMITTED
        const submitRes = await request(app)
            .patch(`/api/v1/tasks/${task.id}/status`)
            .set('Authorization', `Bearer ${emp1Tokens.accessToken}`)
            .send({ status: 'SUBMITTED', progressPercent: 100 });
        expect(submitRes.status).toBe(200);
        expect(submitRes.body.data.status).toBe('SUBMITTED');

        // 6. Manager approves completion: SUBMITTED -> COMPLETED
        const managerCompleteRes = await request(app)
            .patch(`/api/v1/tasks/${task.id}/status`)
            .set('Authorization', `Bearer ${managerTokens.accessToken}`)
            .send({
                status: 'COMPLETED',
                completionNotes: 'Well done, passes QA.'
            });
        expect(managerCompleteRes.status).toBe(200);
        expect(managerCompleteRes.body.data.status).toBe('COMPLETED');
        expect(managerCompleteRes.body.data.progressPercent).toBe(100);
        expect(managerCompleteRes.body.data.completedAt).toBeDefined();
    });
});
