import { z } from 'zod';

export const createGoalSchema = z.object({
    title: z.string().min(3, 'Title must be at least 3 characters').max(200),
    description: z.string().max(1000).optional(),
    level: z.enum(['ORGANIZATION', 'DEPARTMENT', 'TEAM', 'EMPLOYEE']).default('EMPLOYEE'),
    ownerId: z.string().optional().nullable(),
    departmentId: z.string().optional().nullable(),
    teamId: z.string().optional().nullable(),
    target: z.string().max(200).optional(),
    targetValue: z.union([z.string(), z.number()]).optional(),
    unit: z.string().optional(),
    parentGoalId: z.string().optional().nullable(),
    deadline: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional()
}).transform((val) => {
    let finalTarget = val.target;
    if (!finalTarget && val.targetValue !== undefined) {
        finalTarget = `${val.targetValue} ${val.unit || ''}`.trim();
    }
    return {
        ...val,
        target: finalTarget || 'Target objective',
        deadline: val.deadline || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    };
});

export const updateGoalSchema = z.object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(1000).optional(),
    target: z.string().max(200).optional(),
    deadline: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)).optional(),
    progress: z.number().min(0).max(100).optional(),
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'MISSED', 'CANCELLED']).optional(),
    reviewNotes: z.string().max(1000).optional()
});

export const goalQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    level: z.enum(['ORGANIZATION', 'DEPARTMENT', 'TEAM', 'EMPLOYEE']).optional(),
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'ACHIEVED', 'MISSED', 'CANCELLED']).optional(),
    ownerId: z.string().optional(),
    departmentId: z.string().optional(),
    teamId: z.string().optional()
});

export const createReviewSchema = z.object({
    employeeId: z.string().min(1, 'Employee ID is required'),
    rating: z.number().min(1).max(5),
    cadence: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']).default('QUARTERLY'),
    comments: z.string().max(2000).optional(),
    periodStart: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    periodEnd: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/))
});

export const metricsQuerySchema = z.object({
    level: z.enum(['ORGANIZATION', 'DEPARTMENT', 'TEAM', 'EMPLOYEE']).default('EMPLOYEE'),
    id: z.string().optional(),
    periodStart: z.string().optional(),
    periodEnd: z.string().optional()
});
