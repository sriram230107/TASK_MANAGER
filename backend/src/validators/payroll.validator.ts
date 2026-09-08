import { z } from 'zod';

export const createPayrollSchema = z.object({
    employeeId: z.string().uuid('Valid employee ID is required'),
    periodStart: z.string().min(1, 'Period start date is required'),
    periodEnd: z.string().min(1, 'Period end date is required'),
    baseSalary: z.number().positive('Base salary must be positive'),
    allowances: z.number().min(0).default(0),
    deductions: z.number().min(0).default(0),
    overtimePay: z.number().min(0).default(0),
    bonuses: z.number().min(0).default(0),
    status: z.enum(['DRAFT', 'PROCESSED', 'PAID']).default('DRAFT'),
    autoComputeOvertime: z.boolean().optional()
});

export const updatePayrollSchema = z.object({
    baseSalary: z.number().positive().optional(),
    allowances: z.number().min(0).optional(),
    deductions: z.number().min(0).optional(),
    overtimePay: z.number().min(0).optional(),
    bonuses: z.number().min(0).optional(),
    status: z.enum(['DRAFT', 'PROCESSED', 'PAID']).optional()
});

export const bulkProcessPayrollSchema = z.object({
    recordIds: z.array(z.string().uuid()).min(1, 'At least one payroll record ID is required'),
    status: z.enum(['PROCESSED', 'PAID'])
});

export const queryPayrollSchema = z.object({
    employeeId: z.string().optional(),
    departmentId: z.string().optional(),
    status: z.enum(['DRAFT', 'PROCESSED', 'PAID']).optional(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional()
});

export type CreatePayrollInput = z.infer<typeof createPayrollSchema>;
export type UpdatePayrollInput = z.infer<typeof updatePayrollSchema>;
export type BulkProcessPayrollInput = z.infer<typeof bulkProcessPayrollSchema>;
export type QueryPayrollInput = z.infer<typeof queryPayrollSchema>;
