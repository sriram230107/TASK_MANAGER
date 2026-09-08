import { z } from 'zod';

export const createLeaveRequestSchema = z.object({
    type: z.enum([
        'ANNUAL',
        'SICK',
        'CASUAL',
        'UNPAID',
        'MATERNITY',
        'PATERNITY',
        'BEREAVEMENT'
    ]),
    startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}/)),
    reason: z.string().min(3, 'Reason must be at least 3 characters').max(1000)
});

export const reviewLeaveRequestSchema = z.object({
    action: z.enum(['APPROVE', 'REJECT']),
    notes: z.string().max(1000).optional()
});

export const leaveQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    status: z.enum([
        'PENDING_LEAD',
        'PENDING_MANAGER',
        'APPROVED',
        'REJECTED',
        'CANCELLED'
    ]).optional(),
    type: z.enum([
        'ANNUAL',
        'SICK',
        'CASUAL',
        'UNPAID',
        'MATERNITY',
        'PATERNITY',
        'BEREAVEMENT'
    ]).optional(),
    employeeId: z.string().optional(),
    pendingReview: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional()
});
