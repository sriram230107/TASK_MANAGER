import { z } from 'zod';

export const auditQuerySchema = z.object({
    entity: z.string().optional(),
    action: z.string().optional(),
    userId: z.string().uuid('Invalid user ID').optional(),
    startDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    endDate: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(30)
});

export type AuditQueryParams = z.infer<typeof auditQuerySchema>;
