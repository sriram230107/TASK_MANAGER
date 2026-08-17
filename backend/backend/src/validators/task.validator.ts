import { z } from 'zod';

export const recurrenceRuleSchema = z.object({
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
    interval: z.number().min(1).optional(),
    endDate: z.string().datetime().optional()
});

export const createTaskSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    assignedToId: z.string().uuid(),
    teamId: z.string().uuid(),
    parentTaskId: z.string().uuid().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    estimatedHours: z.number().optional(),
    startDate: z.string().datetime().optional(),
    dueDate: z.string().datetime().optional(),
    recurrenceRule: recurrenceRuleSchema.optional()
});

export const updateTaskStatusSchema = z.object({
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'ON_HOLD', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED']),
    comment: z.string().optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    hoursLogged: z.number().optional()
});

export const taskUpdateSchema = z.object({
    progressPercent: z.number().min(0).max(100),
    comment: z.string().optional(),
    hoursLogged: z.number().optional()
});

export const getTasksQuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional(),
    status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'BLOCKED', 'ON_HOLD', 'PENDING_REVIEW', 'COMPLETED', 'CANCELLED']).optional(),
    assignedTo: z.string().uuid().optional()
});

export const updateTaskSchema = z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    assignedToId: z.string().uuid().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    estimatedHours: z.number().optional(),
    startDate: z.string().datetime().optional(),
    dueDate: z.string().datetime().optional()
});
