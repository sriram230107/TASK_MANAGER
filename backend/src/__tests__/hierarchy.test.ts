import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, createTestOrg, createTestUser, generateTestTokens } from './helpers/test-app';
import { cleanDatabase } from './setup';
import { prisma, withTenant } from '../utils/prisma';

describe('Hierarchy Scoping & Tenant Isolation Tests', () => {
    beforeEach(async () => {
        await cleanDatabase();
    });

    it('enforces hierarchy access: Team Lead cannot access another team, Manager cannot access another department', async () => {
        // Create Org 1
        const org1 = await createTestOrg('Company One');

        const { dept1, dept2, manager1, manager2, lead1, lead2, emp1A, emp2A } = await withTenant(org1.id, async () => {
            // Create Dept 1 and Dept 2
            const dept1 = await prisma.department.create({
                data: { name: 'Engineering', organizationId: org1.id }
            });
            const dept2 = await prisma.department.create({
                data: { name: 'Marketing', organizationId: org1.id }
            });

            // Manager 1 (Dept 1)
            const manager1 = await createTestUser({
                orgId: org1.id,
                role: 'MANAGER',
                email: 'manager1@company1.com',
                departmentId: dept1.id
            });
            await prisma.department.update({
                where: { id: dept1.id },
                data: { managerId: manager1.id }
            });

            // Manager 2 (Dept 2)
            const manager2 = await createTestUser({
                orgId: org1.id,
                role: 'MANAGER',
                email: 'manager2@company1.com',
                departmentId: dept2.id
            });
            await prisma.department.update({
                where: { id: dept2.id },
                data: { managerId: manager2.id }
            });

            // Team 1 (under Dept 1)
            const lead1 = await createTestUser({
                orgId: org1.id,
                role: 'TEAM_LEAD',
                email: 'lead1@company1.com',
                departmentId: dept1.id,
                managerId: manager1.id
            });
            const team1 = await prisma.team.create({
                data: {
                    name: 'Backend Team',
                    organizationId: org1.id,
                    departmentId: dept1.id,
                    teamLeadId: lead1.id
                }
            });

            // Employee 1A in Team 1
            const emp1A = await createTestUser({
                orgId: org1.id,
                role: 'EMPLOYEE',
                email: 'emp1a@company1.com',
                departmentId: dept1.id,
                managerId: manager1.id,
                teamLeadId: lead1.id
            });
            await prisma.teamMember.create({
                data: { organizationId: org1.id, teamId: team1.id, userId: emp1A.id }
            });

            // Team 2 (under Dept 2)
            const lead2 = await createTestUser({
                orgId: org1.id,
                role: 'TEAM_LEAD',
                email: 'lead2@company1.com',
                departmentId: dept2.id,
                managerId: manager2.id
            });
            const team2 = await prisma.team.create({
                data: {
                    name: 'Growth Team',
                    organizationId: org1.id,
                    departmentId: dept2.id,
                    teamLeadId: lead2.id
                }
            });

            // Employee 2A in Team 2
            const emp2A = await createTestUser({
                orgId: org1.id,
                role: 'EMPLOYEE',
                email: 'emp2a@company1.com',
                departmentId: dept2.id,
                managerId: manager2.id,
                teamLeadId: lead2.id
            });
            await prisma.teamMember.create({
                data: { organizationId: org1.id, teamId: team2.id, userId: emp2A.id }
            });

            return { dept1, dept2, manager1, manager2, lead1, lead2, emp1A, emp2A };
        });

        // Org 2 & External Employee
        const org2 = await createTestOrg('Company Two');
        const empOrg2 = await createTestUser({
            orgId: org2.id,
            role: 'EMPLOYEE',
            email: 'emp@company2.com'
        });

        const lead1Tokens = generateTestTokens(lead1);
        const manager1Tokens = generateTestTokens(manager1);

        // 1. Team Lead 1 CAN read Employee 1A (their own team member)
        const leadReadOwnTeamRes = await request(app)
            .get(`/api/v1/users/${emp1A.id}`)
            .set('Authorization', `Bearer ${lead1Tokens.accessToken}`);
        expect(leadReadOwnTeamRes.status).toBe(200);
        expect(leadReadOwnTeamRes.body.data.id).toBe(emp1A.id);

        // 2. Team Lead 1 CANNOT read Employee 2A (different team / department) -> 403
        const leadReadOtherTeamRes = await request(app)
            .get(`/api/v1/users/${emp2A.id}`)
            .set('Authorization', `Bearer ${lead1Tokens.accessToken}`);
        expect(leadReadOtherTeamRes.status).toBe(403);

        // 3. Manager 1 CAN read Employee 1A (inside their managed Department 1)
        const mgrReadOwnDeptRes = await request(app)
            .get(`/api/v1/users/${emp1A.id}`)
            .set('Authorization', `Bearer ${manager1Tokens.accessToken}`);
        expect(mgrReadOwnDeptRes.status).toBe(200);

        // 4. Manager 1 CANNOT read Employee 2A (inside Department 2) -> 403
        const mgrReadOtherDeptRes = await request(app)
            .get(`/api/v1/users/${emp2A.id}`)
            .set('Authorization', `Bearer ${manager1Tokens.accessToken}`);
        expect(mgrReadOtherDeptRes.status).toBe(403);

        // 5. Cross-tenant: Manager 1 CANNOT read Employee in Company Two -> 403
        const crossTenantRes = await request(app)
            .get(`/api/v1/users/${empOrg2.id}`)
            .set('Authorization', `Bearer ${manager1Tokens.accessToken}`);
        expect(crossTenantRes.status).toBe(403);
    });
});
