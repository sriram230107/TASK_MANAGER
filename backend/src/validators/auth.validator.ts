import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required')
});

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required')
});

export const adminCreateUserSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
    role: z.enum(['ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE']),
    departmentId: z.string().uuid().optional(),
    managerId: z.string().uuid().optional(),
    teamLeadId: z.string().uuid().optional()
});
