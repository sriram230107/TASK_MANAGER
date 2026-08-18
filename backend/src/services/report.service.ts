import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';

export const getAggregatedReport = async (user: User, filters: any) => {
    // Base filter: always scoped to requesting user's organization
    const whereMap: any = { deletedAt: null, organizationId: user.organizationId };

    // Role-based scope: limit what targetType/targetId combinations are allowed
    if (user.role === 'EMPLOYEE') {
        // Employees can only see their own assigned tasks
        whereMap.assignedToId = user.id;
    } else if (user.role === 'TEAM_LEAD') {
        // Team Lead can only query their own teams
        if (filters.targetType === 'EMPLOYEE') {
            // Verify the targetId employee is in one of this TL's teams
            const membership = await prisma.teamMember.findFirst({
                where: { userId: filters.targetId, team: { teamLeadId: user.id, organizationId: user.organizationId } }
            });
            if (!membership) throw new Error('Forbidden: Target employee is not in your team');
            whereMap.assignedToId = filters.targetId;
        } else if (filters.targetType === 'TEAM') {
            const team = await prisma.team.findFirst({ where: { id: filters.targetId, teamLeadId: user.id, organizationId: user.organizationId } });
            if (!team) throw new Error('Forbidden: That team is not yours');
            whereMap.teamId = filters.targetId;
        } else {
            // Default: show all tasks in TL's teams
            whereMap.team = { teamLeadId: user.id, organizationId: user.organizationId };
        }
    } else if (user.role === 'MANAGER') {
        if (filters.targetType === 'EMPLOYEE') {
            // Verify employee belongs to a team under this manager
            const membership = await prisma.teamMember.findFirst({
                where: { userId: filters.targetId, team: { teamLead: { managerId: user.id }, organizationId: user.organizationId } }
            });
            if (!membership) throw new Error('Forbidden: Target employee is not under your management');
            whereMap.assignedToId = filters.targetId;
        } else if (filters.targetType === 'TEAM') {
            const team = await prisma.team.findFirst({ where: { id: filters.targetId, teamLead: { managerId: user.id }, organizationId: user.organizationId } });
            if (!team) throw new Error('Forbidden: That team is not under your management');
            whereMap.teamId = filters.targetId;
        } else {
            // Default: all tasks in manager's teams
            whereMap.team = { teamLead: { managerId: user.id }, organizationId: user.organizationId };
        }
    } else if (user.role === 'ADMIN') {
        // Admin can query by any filter within their org
        if (filters.targetType === 'EMPLOYEE') {
            whereMap.assignedToId = filters.targetId;
        } else if (filters.targetType === 'TEAM') {
            whereMap.teamId = filters.targetId;
        } else if (filters.targetType === 'MANAGER') {
            whereMap.team = { teamLead: { managerId: filters.targetId } };
        }
    } else {
        throw new Error('Forbidden: You are not authorized to access reports');
    }

    const tasks = await prisma.task.findMany({
        where: whereMap,
        include: {
            assignedTo: { select: { name: true } },
            team: { select: { name: true } }
        }
    });

    let completed = 0;
    let onTime = 0;
    let overdue = 0;
    let totalHours = 0;
    const now = new Date();

    tasks.forEach(t => {
        if (t.status === 'COMPLETED') {
            completed++;
            if (t.completedAt && t.dueDate && t.completedAt <= t.dueDate) onTime++;
            if (t.actualHours) totalHours += t.actualHours;
        } else if (t.dueDate && t.dueDate < now) {
            overdue++;
        }
    });

    const completionRate = tasks.length > 0 ? (completed / tasks.length) * 100 : 0;
    const onTimeRate = completed > 0 ? (onTime / completed) * 100 : 0;
    const averageHours = completed > 0 ? (totalHours / completed) : 0;

    return {
        totalTasks: tasks.length,
        completedTasks: completed,
        overdueCount: overdue,
        completionRate: completionRate.toFixed(2),
        onTimeRate: onTimeRate.toFixed(2),
        averageCompletionTimeHours: averageHours.toFixed(2),
        rawData: tasks.map(t => ({
            title: t.title,
            status: t.status,
            assignee: t.assignedTo?.name || 'Unassigned',
            team: t.team?.name || 'No Team',
            dueDate: t.dueDate ? t.dueDate.toISOString() : 'N/A',
            completedAt: t.completedAt ? t.completedAt.toISOString() : 'N/A'
        }))
    };
};
