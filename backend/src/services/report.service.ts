// @ts-nocheck
import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';

export const getAggregatedReport = async (user: User, filters: any) => {
    let whereMap: any = { deletedAt: null };

    if (filters.targetType === 'EMPLOYEE') {
        whereMap.assignedToId = filters.targetId;
    } else if (filters.targetType === 'TEAM') {
        whereMap.teamId = filters.targetId;
    } else if (filters.targetType === 'MANAGER') {
        whereMap.team = { teamLead: { managerId: filters.targetId } };
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
