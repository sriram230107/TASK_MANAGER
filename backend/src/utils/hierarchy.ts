import { prisma } from './prisma';
import { User } from '@prisma/client';

/**
 * Validates if the requesting user is authorized to access or manage a target user
 * based on the Organization -> Department -> Manager -> Team -> Team Lead -> Employee hierarchy.
 */
export const isAuthorizedForTarget = async (requestingUser: User, targetUserId: string): Promise<boolean> => {
    if (requestingUser.id === targetUserId) return true;
    if (requestingUser.role === 'ADMIN') {
        const target = await prisma.user.findFirst({
            where: { id: targetUserId, organizationId: requestingUser.organizationId }
        });
        return !!target;
    }

    if (requestingUser.role === 'TEAM_LEAD') {
        // Direct reporter or member of a team led by this Team Lead
        const directReporter = await prisma.user.findFirst({
            where: { id: targetUserId, teamLeadId: requestingUser.id, organizationId: requestingUser.organizationId }
        });
        if (directReporter) return true;

        const teamMember = await prisma.teamMember.findFirst({
            where: {
                userId: targetUserId,
                team: {
                    teamLeadId: requestingUser.id,
                    organizationId: requestingUser.organizationId
                }
            }
        });
        return !!teamMember;
    }

    if (requestingUser.role === 'MANAGER') {
        // 1. Direct reporter
        const directReporter = await prisma.user.findFirst({
            where: { id: targetUserId, managerId: requestingUser.id, organizationId: requestingUser.organizationId }
        });
        if (directReporter) return true;

        // 2. Belongs to the same department managed by this manager
        const inManagedDepartment = await prisma.user.findFirst({
            where: {
                id: targetUserId,
                organizationId: requestingUser.organizationId,
                department: {
                    OR: [
                        { managerId: requestingUser.id },
                        ...(requestingUser.departmentId ? [{ id: requestingUser.departmentId }] : [])
                    ]
                }
            }
        });
        if (inManagedDepartment) return true;

        // 3. Belongs to a team whose Team Lead reports to this manager
        const teamMemberUnderLead = await prisma.teamMember.findFirst({
            where: {
                userId: targetUserId,
                team: {
                    organizationId: requestingUser.organizationId,
                    teamLead: { managerId: requestingUser.id }
                }
            }
        });
        return !!teamMemberUnderLead;
    }

    return false;
};

/**
 * Validates if the requesting user is authorized to access or manage a target department.
 */
export const isAuthorizedForDepartment = async (requestingUser: User, targetDepartmentId: string): Promise<boolean> => {
    if (requestingUser.role === 'ADMIN') {
        const dept = await prisma.department.findFirst({
            where: { id: targetDepartmentId, organizationId: requestingUser.organizationId }
        });
        return !!dept;
    }

    if (requestingUser.role === 'MANAGER') {
        const dept = await prisma.department.findFirst({
            where: {
                id: targetDepartmentId,
                organizationId: requestingUser.organizationId,
                OR: [
                    { managerId: requestingUser.id },
                    ...(requestingUser.departmentId ? [{ id: requestingUser.departmentId }] : [])
                ]
            }
        });
        return !!dept;
    }

    return false;
};

/**
 * Validates if the requesting user is authorized to access or manage a target team.
 */
export const isAuthorizedForTeam = async (requestingUser: User, targetTeamId: string): Promise<boolean> => {
    if (requestingUser.role === 'ADMIN') {
        const team = await prisma.team.findFirst({
            where: { id: targetTeamId, organizationId: requestingUser.organizationId }
        });
        return !!team;
    }

    if (requestingUser.role === 'TEAM_LEAD') {
        const team = await prisma.team.findFirst({
            where: {
                id: targetTeamId,
                teamLeadId: requestingUser.id,
                organizationId: requestingUser.organizationId
            }
        });
        return !!team;
    }

    if (requestingUser.role === 'MANAGER') {
        const team = await prisma.team.findFirst({
            where: {
                id: targetTeamId,
                organizationId: requestingUser.organizationId,
                OR: [
                    { teamLead: { managerId: requestingUser.id } },
                    {
                        department: {
                            OR: [
                                { managerId: requestingUser.id },
                                ...(requestingUser.departmentId ? [{ id: requestingUser.departmentId }] : [])
                            ]
                        }
                    }
                ]
            }
        });
        return !!team;
    }

    if (requestingUser.role === 'EMPLOYEE') {
        const membership = await prisma.teamMember.findFirst({
            where: {
                teamId: targetTeamId,
                userId: requestingUser.id
            }
        });
        return !!membership;
    }

    return false;
};

/**
 * Get all user IDs belonging to a specific department
 */
export const getDepartmentMemberIds = async (departmentId: string): Promise<string[]> => {
    const users = await prisma.user.findMany({
        where: { departmentId },
        select: { id: true }
    });
    return users.map((u) => u.id);
};

/**
 * Get all user IDs who directly report to a specific manager or lead
 */
export const getDirectReportIds = async (managerId: string): Promise<string[]> => {
    const users = await prisma.user.findMany({
        where: {
            OR: [
                { managerId },
                { teamLeadId: managerId }
            ]
        },
        select: { id: true }
    });
    return users.map((u) => u.id);
};
