import { z } from 'zod';

export const updateUserProfileSchema = z.object({
    name: z.string().min(1, 'Name is required').optional(),
    role: z.enum(['ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE']).optional(),
    departmentId: z.string().optional().nullable(),
    managerId: z.string().optional().nullable(),
    teamLeadId: z.string().optional().nullable()
});

export const userQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    role: z.enum(['ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE']).optional(),
    departmentId: z.string().optional(),
    teamId: z.string().optional(),
    search: z.string().optional()
});

export const createUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
    role: z.enum(['ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE']),
    departmentId: z.string().optional().nullable(),
    managerId: z.string().optional().nullable(),
    teamLeadId: z.string().optional().nullable()
});
