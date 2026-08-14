import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { teamSchema, assignRoleSchema, addTeamMemberSchema, assignTeamLeadSchema } from '../validators/admin.validator';

export const createTeam = async (data: z.infer<typeof teamSchema>) => {
    return prisma.team.create({ data });
};

export const assignTeamLead = async (teamId: string, data: z.infer<typeof assignTeamLeadSchema>) => {
    return prisma.team.update({
        where: { id: teamId },
        data: { teamLeadId: data.teamLeadId }
    });
};

export const addTeamMember = async (teamId: string, data: z.infer<typeof addTeamMemberSchema>) => {
    return prisma.teamMember.create({
        data: { teamId, userId: data.userId }
    });
};

export const assignRole = async (userId: string, data: z.infer<typeof assignRoleSchema>) => {
    return prisma.user.update({
        where: { id: userId },
        data: { role: data.role }
    });
};
