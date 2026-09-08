import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { teamSchema, assignRoleSchema, addTeamMemberSchema, assignTeamLeadSchema } from '../validators/admin.validator';

export const createTeam = async (admin: any, data: z.infer<typeof teamSchema>) => {
    // Validate team lead belongs to same org and is a TEAM_LEAD.
    const teamLead = await prisma.user.findFirst({
        where: { id: data.teamLeadId, deletedAt: null },
        select: { organizationId: true, role: true }
    });
    if (!teamLead) throw new Error('Team lead not found');
    if (teamLead.organizationId !== admin.organizationId) throw new Error('Team lead belongs to another organization');
    if (teamLead.role !== 'TEAM_LEAD') throw new Error('Team lead must have role TEAM_LEAD');

    return prisma.team.create({
        data: {
            name: data.name,
            organizationId: admin.organizationId,
            teamLeadId: data.teamLeadId
        }
    });
};

export const assignTeamLead = async (admin: any, teamId: string, data: z.infer<typeof assignTeamLeadSchema>) => {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { organizationId: true } });
    if (!team) throw new Error('Team not found');
    if (team.organizationId !== admin.organizationId) throw new Error('Team belongs to another organization');

    const teamLead = await prisma.user.findFirst({
        where: { id: data.teamLeadId, deletedAt: null },
        select: { organizationId: true, role: true }
    });
    if (!teamLead) throw new Error('Team lead not found');
    if (teamLead.organizationId !== admin.organizationId) throw new Error('Team lead belongs to another organization');
    if (teamLead.role !== 'TEAM_LEAD') throw new Error('Team lead must have role TEAM_LEAD');

    return prisma.team.update({
        where: { id: teamId },
        data: { teamLeadId: data.teamLeadId }
    });
};

export const addTeamMember = async (admin: any, teamId: string, data: z.infer<typeof addTeamMemberSchema>) => {
    const team = await prisma.team.findUnique({ where: { id: teamId }, select: { organizationId: true } });
    if (!team) throw new Error('Team not found');
    if (team.organizationId !== admin.organizationId) throw new Error('Team belongs to another organization');

    const user = await prisma.user.findFirst({
        where: { id: data.userId, deletedAt: null },
        select: { organizationId: true, role: true }
    });
    if (!user) throw new Error('User not found');
    if (user.organizationId !== admin.organizationId) throw new Error('User belongs to another organization');
    if (user.role !== 'EMPLOYEE') throw new Error('Only employees can be added as team members');

    return prisma.teamMember.create({
        data: { teamId, userId: data.userId }
    });
};

export const assignRole = async (admin: any, userId: string, data: z.infer<typeof assignRoleSchema>) => {
    const target = await prisma.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: { organizationId: true }
    });
    if (!target) throw new Error('User not found');
    if (target.organizationId !== admin.organizationId) throw new Error('User belongs to another organization');

    const updateData: any = { role: data.role };
    // ADMIN and MANAGER are top-level roles — clear managerId.
    if (data.role === 'ADMIN' || data.role === 'MANAGER') {
        updateData.managerId = null;
    }

    return prisma.user.update({
        where: { id: userId },
        data: updateData
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
