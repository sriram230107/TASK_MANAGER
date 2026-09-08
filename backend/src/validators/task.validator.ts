import { z } from 'zod';

export const recurrenceRuleSchema = z.object({
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'CUSTOM']),
    interval: z.number().min(1).optional(),
    endDate: z.string().datetime().optional()
});

export const createTaskSchema = z.object({
    title: z.string().min(1, 'Title is required'),
    description: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional().default('MEDIUM'),
    status: z.enum([
        'DRAFT',
        'ASSIGNED',
        'ACCEPTED',
        'IN_PROGRESS',
        'ON_HOLD',
        'SUBMITTED',
        'UNDER_REVIEW',
        'COMPLETED',
        'CHANGES_REQUESTED',
        'CANCELLED',
        'OVERDUE',
        // Legacy compatibility
        'NOT_STARTED',
        'BLOCKED',
        'PENDING_REVIEW'
    ]).optional().default('DRAFT'),

    // Assignment targets (hierarchical)
    assignedManagerId: z.string().uuid().optional(),
    assignedTeamLeadId: z.string().uuid().optional(),
    assignedEmployeeId: z.string().uuid().optional(),
    assignedToId: z.string().uuid().optional(), // backward compatibility

    // Scoping
    departmentId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
    parentTaskId: z.string().uuid().optional(),

    // Planning & metrics
    dependencies: z.array(z.string()).optional().default([]),
    estimatedHours: z.number().min(0).optional(),
    startDate: z.string().datetime().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),

    recurrenceRule: recurrenceRuleSchema.optional()
});

export const updateTaskSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    assignedManagerId: z.string().uuid().optional().nullable(),
    assignedTeamLeadId: z.string().uuid().optional().nullable(),
    assignedEmployeeId: z.string().uuid().optional().nullable(),
    assignedToId: z.string().uuid().optional().nullable(),
    departmentId: z.string().uuid().optional().nullable(),
    teamId: z.string().uuid().optional().nullable(),
    dependencies: z.array(z.string()).optional(),
    estimatedHours: z.number().min(0).optional().nullable(),
    actualHours: z.number().min(0).optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    startDate: z.string().datetime().optional().nullable(),
    dueDate: z.string().datetime().optional().nullable(),
    completionNotes: z.string().optional().nullable(),
    reviewNotes: z.string().optional().nullable()
});

export const updateTaskStatusSchema = z.object({
    status: z.enum([
        'DRAFT',
        'ASSIGNED',
        'ACCEPTED',
        'IN_PROGRESS',
        'ON_HOLD',
        'SUBMITTED',
        'UNDER_REVIEW',
        'COMPLETED',
        'CHANGES_REQUESTED',
        'CANCELLED',
        'OVERDUE',
        // Legacy compatibility
        'NOT_STARTED',
        'BLOCKED',
        'PENDING_REVIEW'
    ]),
    comment: z.string().optional(),
    progressPercent: z.number().min(0).max(100).optional(),
    hoursLogged: z.number().min(0).optional(),
    completionNotes: z.string().optional(),
    reviewNotes: z.string().optional()
});

export const taskUpdateSchema = z.object({
    progressPercent: z.number().min(0).max(100),
    comment: z.string().optional(),
    hoursLogged: z.number().min(0).optional()
});

export const taskCommentSchema = z.object({
    content: z.string().optional(),
    comment: z.string().optional()
}).transform((data) => ({
    content: (data.content || data.comment || '').trim()
})).refine((data) => data.content.length > 0, {
    message: 'Comment content cannot be empty',
    path: ['content']
});

export const delegateTaskSchema = z.object({
    assignedTeamLeadId: z.string().uuid().optional(),
    assignedEmployeeId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
    notes: z.string().optional()
});

export const getTasksQuerySchema = z.object({
    page: z.string().regex(/^\d+$/).transform(Number).optional().default(1),
    limit: z.string().regex(/^\d+$/).transform(Number).optional().default(20),
    status: z.string().optional(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
    departmentId: z.string().uuid().optional(),
    teamId: z.string().uuid().optional(),
    assignedTo: z.string().uuid().optional(),
    assignedEmployeeId: z.string().uuid().optional(),
    assignedTeamLeadId: z.string().uuid().optional(),
    assignedManagerId: z.string().uuid().optional(),
    parentTaskId: z.string().uuid().optional(),
    search: z.string().optional(),
    sortBy: z.enum(['dueDate', 'createdAt', 'priority', 'status', 'progressPercent']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
});