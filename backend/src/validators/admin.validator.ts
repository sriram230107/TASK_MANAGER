import { z } from 'zod';

export const teamSchema = z.object({
    name: z.string().min(1, 'Team name is required'),
    organizationId: z.string().uuid(),
    teamLeadId: z.string().uuid()
});

export const assignRoleSchema = z.object({
    role: z.enum(['ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE'])
});

export const addTeamMemberSchema = z.object({
    userId: z.string().uuid()
});

export const assignTeamLeadSchema = z.object({
    teamLeadId: z.string().uuid()
});
