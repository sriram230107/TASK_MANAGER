import { z } from 'zod';

export const loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1, 'Password is required')
});

export const registerSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    name: z.string().min(1, 'Name is required'),
    role: z.enum(['ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE']),
    organizationId: z.string().uuid(),
    managerId: z.string().uuid().optional()
});
