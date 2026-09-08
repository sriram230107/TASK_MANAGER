import { z } from 'zod';

export const createNotificationSchema = z.object({
    userId: z.string().uuid(),
    type: z.string().min(1).default('GENERAL'),
    message: z.string().min(1, 'Message is required'),
    taskId: z.string().uuid().optional().nullable()
});

export const broadcastNotificationSchema = z.object({
    targetScope: z.enum(['ORGANIZATION', 'DEPARTMENT', 'TEAM']),
    targetId: z.string().optional().nullable(),
    type: z.string().min(1).default('ANNOUNCEMENT'),
    message: z.string().min(1, 'Announcement message is required')
});

export const queryNotificationSchema = z.object({
    isRead: z.enum(['true', 'false']).optional(),
    page: z.string().regex(/^\d+$/).transform(Number).optional(),
    limit: z.string().regex(/^\d+$/).transform(Number).optional()
});

export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
export type BroadcastNotificationInput = z.infer<typeof broadcastNotificationSchema>;
export type QueryNotificationInput = z.infer<typeof queryNotificationSchema>;
