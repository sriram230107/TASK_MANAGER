import { prisma } from './prisma';
import { User } from '@prisma/client';

export const isAuthorizedForTarget = async (requestingUser: User, targetUserId: string): Promise<boolean> => {
    if (requestingUser.id === targetUserId) return true;
    if (requestingUser.role === 'ADMIN') return true;

    if (requestingUser.role === 'TEAM_LEAD') {
        const teamMember = await prisma.teamMember.findFirst({
            where: {
                userId: targetUserId,
                team: { teamLeadId: requestingUser.id }
            }
        });
        return !!teamMember;
    }

    if (requestingUser.role === 'MANAGER') {
        const teamMember = await prisma.teamMember.findFirst({
            where: {
                userId: targetUserId,
                team: {
                    teamLead: { managerId: requestingUser.id }
                }
            }
        });
        const isDirectReporter = await prisma.user.findFirst({
            where: { id: targetUserId, managerId: requestingUser.id }
        });
        return !!teamMember || !!isDirectReporter;
    }

    return false;
};

export const isAuthorizedForTeam = async (requestingUser: User, targetTeamId: string): Promise<boolean> => {
    if (requestingUser.role === 'ADMIN') return true;

    if (requestingUser.role === 'TEAM_LEAD') {
        const team = await prisma.team.findFirst({ where: { id: targetTeamId, teamLeadId: requestingUser.id } });
        return !!team;
    }

    if (requestingUser.role === 'MANAGER') {
        const team = await prisma.team.findFirst({ where: { id: targetTeamId, teamLead: { managerId: requestingUser.id } } });
        return !!team;
    }

    return false;
};
