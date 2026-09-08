import { prisma } from '../utils/prisma';
import { User, PayrollStatus } from '@prisma/client';
import { isAuthorizedForTarget } from '../utils/hierarchy';
import { createNotification } from './notification.service';
import { CreatePayrollInput, UpdatePayrollInput } from '../validators/payroll.validator';

export interface QueryPayrollFilters {
    employeeId?: string;
    departmentId?: string;
    status?: PayrollStatus;
    periodStart?: string;
    periodEnd?: string;
    page?: number;
    limit?: number;
}

export const calculateNetSalary = (
    baseSalary: number,
    allowances = 0,
    deductions = 0,
    overtimePay = 0,
    bonuses = 0
): number => {
    return +(baseSalary + allowances + overtimePay + bonuses - deductions).toFixed(2);
};

/**
 * Creates a compensation / payroll record for an employee. (Admin only)
 */
export const createPayrollRecord = async (creator: User, input: CreatePayrollInput) => {
    if (creator.role !== 'ADMIN') {
        throw new Error('Forbidden: Only administrators can create payroll records');
    }

    const employee = await prisma.user.findFirst({
        where: { id: input.employeeId, organizationId: creator.organizationId, deletedAt: null },
        include: { department: true }
    });

    if (!employee) {
        throw new Error('Employee not found in organization');
    }

    const start = new Date(input.periodStart);
    const end = new Date(input.periodEnd);
    if (end < start) {
        throw new Error('Period end date must be after period start date');
    }

    let overtimePay = input.overtimePay || 0;

    // Optional auto-computation of overtime pay from logged Attendance records
    if (input.autoComputeOvertime) {
        const attendances = await prisma.attendance.findMany({
            where: {
                userId: employee.id,
                date: { gte: start, lte: end }
            },
            select: { overtimeMinutes: true }
        });

        const totalOvertimeMinutes = attendances.reduce((acc, a) => acc + (a.overtimeMinutes || 0), 0);
        if (totalOvertimeMinutes > 0) {
            // Standard 160 working hours/month baseline with 1.5x overtime multiplier
            const hourlyRate = input.baseSalary / 160;
            overtimePay = +((totalOvertimeMinutes / 60) * hourlyRate * 1.5).toFixed(2);
        }
    }

    const netSalary = calculateNetSalary(
        input.baseSalary,
        input.allowances,
        input.deductions,
        overtimePay,
        input.bonuses
    );

    const record = await prisma.payrollRecord.create({
        data: {
            employeeId: employee.id,
            periodStart: start,
            periodEnd: end,
            baseSalary: input.baseSalary,
            allowances: input.allowances || 0,
            deductions: input.deductions || 0,
            overtimePay,
            bonuses: input.bonuses || 0,
            netSalary,
            status: input.status || 'DRAFT'
        },
        include: {
            employee: {
                select: { id: true, name: true, email: true, role: true, department: { select: { id: true, name: true } } }
            }
        }
    });

    // Notify employee of payroll generation
    await createNotification(
        employee.id,
        'PAYROLL_GENERATED',
        `Payroll record generated for period ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}. Net Payout: $${netSalary.toLocaleString()}`
    ).catch(() => {});

    return record;
};

/**
 * Lists payroll records with strict server-side access scope.
 * EMPLOYEE -> own records only
 * MANAGER -> department / direct reports only
 * TEAM_LEAD -> blocked (403)
 * ADMIN -> organization-wide
 */
export const listPayrollRecords = async (requestingUser: User, filters: QueryPayrollFilters = {}) => {
    if (requestingUser.role === 'TEAM_LEAD') {
        throw new Error('Forbidden: Team Leads do not have payroll access');
    }

    const where: any = {
        employee: { organizationId: requestingUser.organizationId, deletedAt: null }
    };

    // Access scope enforcement per Rule 6 & Rule 15
    if (requestingUser.role === 'EMPLOYEE') {
        where.employeeId = requestingUser.id;
    } else if (requestingUser.role === 'MANAGER') {
        // Find department members + direct reports
        const deptUsers = await prisma.user.findMany({
            where: {
                organizationId: requestingUser.organizationId,
                deletedAt: null,
                OR: [
                    { departmentId: requestingUser.departmentId },
                    { department: { managerId: requestingUser.id } },
                    { managerId: requestingUser.id }
                ]
            },
            select: { id: true }
        });

        const allowedIds = deptUsers.map((u) => u.id);
        if (filters.employeeId) {
            if (!allowedIds.includes(filters.employeeId)) {
                throw new Error('Forbidden: Target employee is outside your department scope');
            }
            where.employeeId = filters.employeeId;
        } else {
            where.employeeId = { in: allowedIds };
        }
    } else if (requestingUser.role === 'ADMIN') {
        if (filters.employeeId) {
            where.employeeId = filters.employeeId;
        }
        if (filters.departmentId) {
            where.employee.departmentId = filters.departmentId;
        }
    }

    if (filters.status) {
        where.status = filters.status;
    }

    if (filters.periodStart && filters.periodEnd) {
        where.periodStart = { gte: new Date(filters.periodStart) };
        where.periodEnd = { lte: new Date(filters.periodEnd) };
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const [records, total, allMatchingRecords] = await Promise.all([
        prisma.payrollRecord.findMany({
            where,
            skip,
            take: limit,
            orderBy: { periodEnd: 'desc' },
            include: {
                employee: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        department: { select: { id: true, name: true } }
                    }
                }
            }
        }),
        prisma.payrollRecord.count({ where }),
        prisma.payrollRecord.findMany({
            where,
            select: {
                baseSalary: true,
                allowances: true,
                deductions: true,
                overtimePay: true,
                bonuses: true,
                netSalary: true
            }
        })
    ]);

    // Financial KPI aggregation for authorized scope
    const summary = {
        totalRecords: total,
        totalNetPayout: +allMatchingRecords.reduce((acc, r) => acc + r.netSalary, 0).toFixed(2),
        totalBaseSalary: +allMatchingRecords.reduce((acc, r) => acc + r.baseSalary, 0).toFixed(2),
        totalAllowances: +allMatchingRecords.reduce((acc, r) => acc + r.allowances, 0).toFixed(2),
        totalDeductions: +allMatchingRecords.reduce((acc, r) => acc + r.deductions, 0).toFixed(2),
        totalOvertimePay: +allMatchingRecords.reduce((acc, r) => acc + r.overtimePay, 0).toFixed(2),
        totalBonuses: +allMatchingRecords.reduce((acc, r) => acc + r.bonuses, 0).toFixed(2)
    };

    return {
        records,
        summary,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Gets a single payroll record by ID with access verification.
 */
export const getPayrollRecordById = async (requestingUser: User, id: string) => {
    if (requestingUser.role === 'TEAM_LEAD') {
        throw new Error('Forbidden: Team Leads do not have payroll access');
    }

    const record = await prisma.payrollRecord.findUnique({
        where: { id },
        include: {
            employee: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    organizationId: true,
                    department: { select: { id: true, name: true } }
                }
            }
        }
    });

    if (!record) {
        throw new Error('Payroll record not found');
    }

    if (record.employee.organizationId !== requestingUser.organizationId) {
        throw new Error('Forbidden: Record belongs to another organization');
    }

    if (requestingUser.role === 'EMPLOYEE' && record.employeeId !== requestingUser.id) {
        throw new Error('Forbidden: Employees can only view their own payroll records');
    }

    if (requestingUser.role === 'MANAGER') {
        const isAuth = await isAuthorizedForTarget(requestingUser, record.employeeId);
        if (!isAuth) {
            throw new Error('Forbidden: Employee is outside your department scope');
        }
    }

    return record;
};

/**
 * Updates a payroll record. (Admin only)
 */
export const updatePayrollRecord = async (requestingUser: User, id: string, input: UpdatePayrollInput) => {
    if (requestingUser.role !== 'ADMIN') {
        throw new Error('Forbidden: Only administrators can update payroll records');
    }

    const existing = await prisma.payrollRecord.findUnique({
        where: { id },
        include: { employee: true }
    });

    if (!existing) throw new Error('Payroll record not found');
    if (existing.employee.organizationId !== requestingUser.organizationId) {
        throw new Error('Forbidden: Record belongs to another organization');
    }

    const baseSalary = input.baseSalary ?? existing.baseSalary;
    const allowances = input.allowances ?? existing.allowances;
    const deductions = input.deductions ?? existing.deductions;
    const overtimePay = input.overtimePay ?? existing.overtimePay;
    const bonuses = input.bonuses ?? existing.bonuses;

    const netSalary = calculateNetSalary(baseSalary, allowances, deductions, overtimePay, bonuses);

    const updated = await prisma.payrollRecord.update({
        where: { id },
        data: {
            baseSalary,
            allowances,
            deductions,
            overtimePay,
            bonuses,
            netSalary,
            ...(input.status ? { status: input.status } : {})
        },
        include: {
            employee: {
                select: { id: true, name: true, email: true, role: true, department: { select: { id: true, name: true } } }
            }
        }
    });

    if (input.status && input.status !== existing.status) {
        createNotification(
            existing.employeeId,
            'PAYROLL_STATUS_CHANGED',
            `Your payroll status has been updated to: ${input.status}`
        ).catch(() => {});
    }

    return updated;
};

/**
 * Deletes a draft payroll record. (Admin only)
 */
export const deletePayrollRecord = async (requestingUser: User, id: string) => {
    if (requestingUser.role !== 'ADMIN') {
        throw new Error('Forbidden: Only administrators can delete payroll records');
    }

    const existing = await prisma.payrollRecord.findUnique({
        where: { id },
        include: { employee: true }
    });

    if (!existing) throw new Error('Payroll record not found');
    if (existing.employee.organizationId !== requestingUser.organizationId) {
        throw new Error('Forbidden: Record belongs to another organization');
    }

    if (existing.status === 'PAID') {
        throw new Error('Cannot delete a payroll record that has already been marked as PAID');
    }

    await prisma.payrollRecord.delete({ where: { id } });
    return { success: true, message: 'Payroll record deleted successfully' };
};

/**
 * Bulk updates payroll status (e.g. DRAFT -> PROCESSED -> PAID). (Admin only)
 */
export const bulkProcessPayroll = async (
    requestingUser: User,
    recordIds: string[],
    targetStatus: 'PROCESSED' | 'PAID'
) => {
    if (requestingUser.role !== 'ADMIN') {
        throw new Error('Forbidden: Only administrators can process payroll in bulk');
    }

    const records = await prisma.payrollRecord.findMany({
        where: {
            id: { in: recordIds },
            employee: { organizationId: requestingUser.organizationId }
        }
    });

    if (records.length === 0) {
        return { updatedCount: 0, message: 'No matching records found' };
    }

    const updated = await prisma.payrollRecord.updateMany({
        where: { id: { in: records.map((r) => r.id) } },
        data: { status: targetStatus }
    });

    // Notify employees
    for (const r of records) {
        createNotification(
            r.employeeId,
            'PAYROLL_STATUS_CHANGED',
            `Your payroll record has been marked as ${targetStatus}. Net Payout: $${r.netSalary.toLocaleString()}`
        ).catch(() => {});
    }

    return {
        updatedCount: updated.count,
        targetStatus,
        message: `Successfully updated ${updated.count} payroll records to ${targetStatus}`
    };
};

/**
 * Generates formatted HTML payslip document for printing / download.
 */
export const generatePayslipHtml = async (requestingUser: User, id: string): Promise<string> => {
    const record = await getPayrollRecordById(requestingUser, id);

    const org = await prisma.organization.findUnique({
        where: { id: requestingUser.organizationId }
    });

    const periodStartStr = record.periodStart.toISOString().split('T')[0];
    const periodEndStr = record.periodEnd.toISOString().split('T')[0];
    const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Payslip - ${record.employee.name} - ${periodStartStr}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; color: #1e293b; background: #fff; line-height: 1.5; }
        .payslip-box { max-width: 750px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; margin-bottom: 24px; }
        .org-name { font-size: 24px; font-weight: 800; color: #1e293b; }
        .payslip-title { font-size: 18px; font-weight: 700; color: #3b82f6; text-transform: uppercase; letter-spacing: 0.05em; }
        .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; font-size: 14px; background: #f8fafc; padding: 16px; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th, td { padding: 12px 16px; text-align: left; font-size: 14px; border-bottom: 1px solid #f1f5f9; }
        th { background: #f8fafc; font-weight: 600; color: #64748b; text-transform: uppercase; font-size: 12px; }
        .amount-col { text-align: right; }
        .total-row { font-weight: 700; background: #f8fafc; }
        .net-pay-banner { background: #eff6ff; border: 2px solid #bfdbfe; border-radius: 8px; padding: 16px 20px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
        .net-pay-label { font-size: 16px; font-weight: 700; color: #1e40af; }
        .net-pay-val { font-size: 24px; font-weight: 800; color: #1e40af; }
        .status-badge { display: inline-block; padding: 4px 10px; border-radius: 9999px; font-size: 12px; font-weight: 700; background: ${record.status === 'PAID' ? '#dcfce7' : record.status === 'PROCESSED' ? '#dbeafe' : '#f1f5f9'}; color: ${record.status === 'PAID' ? '#166534' : record.status === 'PROCESSED' ? '#1e40af' : '#475569'}; }
        .footer { font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    </style>
</head>
<body>
    <div class="payslip-box">
        <div class="header">
            <div>
                <div class="org-name">${org?.name || 'TaskBot Pro Platform'}</div>
                <div style="font-size: 13px; color: #64748b;">Official Salary Disbursement Record</div>
            </div>
            <div style="text-align: right;">
                <div class="payslip-title">PAYSLIP</div>
                <span class="status-badge">${record.status}</span>
            </div>
        </div>

        <div class="meta-grid">
            <div>
                <div><strong>Employee:</strong> ${record.employee.name}</div>
                <div><strong>Email:</strong> ${record.employee.email}</div>
                <div><strong>Department:</strong> ${record.employee.department?.name || 'General'}</div>
            </div>
            <div>
                <div><strong>Pay Period:</strong> ${periodStartStr} to ${periodEndStr}</div>
                <div><strong>Disbursement ID:</strong> ${record.id}</div>
                <div><strong>Generated Date:</strong> ${generatedDate}</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Earnings Item</th>
                    <th class="amount-col">Amount ($)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Base Regular Salary</td>
                    <td class="amount-col">$${record.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <td>Allowances (Housing / Transport)</td>
                    <td class="amount-col">+$${record.allowances.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <td>Overtime Compensation</td>
                    <td class="amount-col">+$${record.overtimePay.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr>
                    <td>Performance / Project Bonuses</td>
                    <td class="amount-col">+$${record.bonuses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr class="total-row">
                    <td>Total Gross Earnings</td>
                    <td class="amount-col">$${(record.baseSalary + record.allowances + record.overtimePay + record.bonuses).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>

        <table>
            <thead>
                <tr>
                    <th>Deductions Item</th>
                    <th class="amount-col">Amount ($)</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Statutory & Voluntary Deductions</td>
                    <td class="amount-col" style="color: #ef4444;">-$${record.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
                <tr class="total-row">
                    <td>Total Deductions</td>
                    <td class="amount-col" style="color: #ef4444;">-$${record.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
            </tbody>
        </table>

        <div class="net-pay-banner">
            <span class="net-pay-label">NET SALARY PAYOUT</span>
            <span class="net-pay-val">$${record.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>

        <div class="footer">
            Confidential Payroll Document. Generated electronically by ${org?.name || 'TaskBot Pro'} Workforce Management System.
        </div>
    </div>
</body>
</html>
    `.trim();
};
