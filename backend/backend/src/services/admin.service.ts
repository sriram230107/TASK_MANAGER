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

export const getGlobalDashboard = async (user: any) => {
    const orgId = user.organizationId;
    const totalUsers = await prisma.user.count({ where: { organizationId: orgId, deletedAt: null } });
    const totalTeams = await prisma.team.count({ where: { organizationId: orgId } });
    const totalTasks = await prisma.task.count({ where: { organizationId: orgId, deletedAt: null } });
    const activityCount = await prisma.activityLog.count({ where: { user: { organizationId: orgId } } });

    const users = await prisma.user.findMany({ where: { organizationId: orgId, deletedAt: null }, select: { id: true, name: true, role: true, email: true } });
    const teams = await prisma.team.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, teamLead: { select: { name: true } } } });

    return { totalUsers, totalTeams, totalTasks, activityCount, users, teams };
};
