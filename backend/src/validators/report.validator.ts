import { z } from 'zod';

export const reportQuerySchema = z.object({
    type: z.enum(['overview', 'tasks', 'attendance', 'performance', 'workload']).default('overview'),
    scope: z.enum(['ORGANIZATION', 'DEPARTMENT', 'TEAM', 'EMPLOYEE']).optional(),
    scopeId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    format: z.enum(['json', 'csv', 'pdf']).default('json')
});

export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
