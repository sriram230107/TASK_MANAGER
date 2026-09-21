import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, createTestOrg, createTestUser, generateTestTokens } from './helpers/test-app';
import { cleanDatabase } from './setup';
import { prisma, withTenant } from '../utils/prisma';

describe('Payroll Permissions and Scoping Tests', () => {
    beforeEach(async () => {
        await cleanDatabase();
    });

    it('denies Team Lead access to payroll with 403 Forbidden', async () => {
        const org = await createTestOrg('Payroll Org');
        const lead = await createTestUser({
            orgId: org.id,
            role: 'TEAM_LEAD',
            email: 'lead@payroll.com'
        });

        const leadTokens = generateTestTokens(lead);

        const res = await request(app)
            .get('/api/v1/payroll')
            .set('Authorization', `Bearer ${leadTokens.accessToken}`);

        expect(res.status).toBe(403);
    });

    it('scopes Employee payroll access strictly to their own records', async () => {
        const org = await createTestOrg('Payroll Org');
        const admin = await createTestUser({
            orgId: org.id,
            role: 'ADMIN',
            email: 'admin@payroll.com'
        });
        const emp1 = await createTestUser({
            orgId: org.id,
            role: 'EMPLOYEE',
            email: 'emp1@payroll.com'
        });
        const emp2 = await createTestUser({
            orgId: org.id,
            role: 'EMPLOYEE',
            email: 'emp2@payroll.com'
        });

        const now = new Date();
        const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59, 999));

        // Create records for emp1 and emp2
        let rec1: any;
        let rec2: any;
        await withTenant(org.id, async () => {
            rec1 = await prisma.payrollRecord.create({
                data: {
                    organizationId: org.id,
                    employeeId: emp1.id,
                    periodStart: startOfMonth,
                    periodEnd: endOfMonth,
                    baseSalary: 5000.0,
                    allowances: 200.0,
                    overtimePay: 100.0,
                    bonuses: 500.0,
                    deductions: 300.0,
                    netSalary: 5500.0,
                    status: 'DRAFT'
                }
            });

            rec2 = await prisma.payrollRecord.create({
                data: {
                    organizationId: org.id,
                    employeeId: emp2.id,
                    periodStart: startOfMonth,
                    periodEnd: endOfMonth,
                    baseSalary: 6000.0,
                    allowances: 300.0,
                    overtimePay: 0.0,
                    bonuses: 600.0,
                    deductions: 400.0,
                    netSalary: 6500.0,
                    status: 'DRAFT'
                }
            });
        });

        const emp1Tokens = generateTestTokens(emp1);
        const adminTokens = generateTestTokens(admin);

        // 1. Employee 1 lists payroll: only sees their own record
        const emp1ListRes = await request(app)
            .get('/api/v1/payroll')
            .set('Authorization', `Bearer ${emp1Tokens.accessToken}`);

        expect(emp1ListRes.status).toBe(200);
        const records = emp1ListRes.body.data.records || emp1ListRes.body.data;
        expect(Array.isArray(records)).toBe(true);
        expect(records.length).toBe(1);
        expect(records[0].id).toBe(rec1.id);

        // 2. Employee 1 can read own record directly
        const emp1GetOwnRes = await request(app)
            .get(`/api/v1/payroll/${rec1.id}`)
            .set('Authorization', `Bearer ${emp1Tokens.accessToken}`);
        expect(emp1GetOwnRes.status).toBe(200);
        expect(emp1GetOwnRes.body.data.id).toBe(rec1.id);

        // 3. Employee 1 CANNOT read Employee 2's record directly -> 403 Forbidden
        const emp1GetOtherRes = await request(app)
            .get(`/api/v1/payroll/${rec2.id}`)
            .set('Authorization', `Bearer ${emp1Tokens.accessToken}`);
        expect(emp1GetOtherRes.status).toBe(403);

        // 4. Admin lists payroll: sees both records
        const adminListRes = await request(app)
            .get('/api/v1/payroll')
            .set('Authorization', `Bearer ${adminTokens.accessToken}`);
        expect(adminListRes.status).toBe(200);
        const adminRecords = adminListRes.body.data.records || adminListRes.body.data;
        expect(adminRecords.length).toBe(2);
    });
});
