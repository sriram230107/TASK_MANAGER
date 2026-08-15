// @ts-nocheck
import { prisma } from '../utils/prisma';
import { User, TaskStatus } from '@prisma/client';

export const getEmployeeDashboard = async (user: User) => {
    const tasks = await prisma.task.findMany({
        where: { assignedToId: user.id, deletedAt: null },
        include: {
            parentTask: { select: { id: true, title: true } },
            updates: { orderBy: { createdAt: 'desc' } },
            team: { select: { name: true, teamLead: { select: { name: true } } } }
        },
        orderBy: { dueDate: 'asc' }
    });

    const profile = await prisma.user.findUnique({
        where: { id: user.id },
        include: { manager: { select: { name: true } } }
    });

    const now = new Date();
    const stats = tasks.reduce((acc, t) => {
        if (t.status === 'COMPLETED') acc.completed++;
        else if (t.dueDate && t.dueDate < now && t.status !== 'CANCELLED') acc.overdue++;
        else if (t.status === 'BLOCKED') acc.blocked++;
        else acc.active++;
        return acc;
    }, { active: 0, completed: 0, overdue: 0, blocked: 0 });

    return { profile, stats, tasks };
};

export const getTeamLeadDashboard = async (user: User) => {
    // Get teams led by this user
    const teams = await prisma.team.findMany({
        where: { teamLeadId: user.id },
        include: {
            members: {
                include: {
                    user: {
                        select: { id: true, name: true, email: true }
                    }
                }
            }
        }
    });

    const teamIds = teams.map(t => t.id);
    const employeeIds = teams.flatMap(t => t.members.map(m => m.userId));

    // Get all tasks for those employees
    const allTasks = await prisma.task.findMany({
        where: { assignedToId: { in: employeeIds }, deletedAt: null },
        include: { updates: { orderBy: { createdAt: 'desc' } } }
    });

    const now = new Date();
    let overall = { active: 0, completed: 0, overdue: 0, blocked: 0 };

    const employeesMap = new Map();

    employeeIds.forEach(id => {
        employeesMap.set(id, { active: 0, completed: 0, tasks: [] });
    });

    allTasks.forEach(t => {
        // Add to overall
        if (t.status === 'COMPLETED') overall.completed++;
        else if (t.dueDate && t.dueDate < now && t.status !== 'CANCELLED') overall.overdue++;
        else if (t.status === 'BLOCKED') overall.blocked++;
        else overall.active++;

        // Add to employee breakdown
        if (employeesMap.has(t.assignedToId)) {
            const empData = employeesMap.get(t.assignedToId);
            empData.tasks.push(t);
            if (t.status === 'COMPLETED') empData.completed++;
            else empData.active++;
        }
    });

    const employees = teams.flatMap(t => t.members.map(m => ({
        ...m.user,
        teamId: t.id,
        teamName: t.name,
        stats: employeesMap.get(m.userId)
    })));

    const pendingReview = await prisma.task.findMany({
        where: {
            teamId: { in: teamIds },
            status: 'PENDING_REVIEW',
            deletedAt: null
        },
        include: { assignedTo: { select: { name: true } } }
    });

    const activityFeed = await prisma.activityLog.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } }
    });

    return { teams, overall, employees, pendingReview, activityFeed };
};

export const getManagerDashboard = async (user: User) => {
    // A manager oversees Team Leads.
    // We can fetch teams where the team lead has this user as managerId.
    const teams = await prisma.team.findMany({
        where: { teamLead: { managerId: user.id } },
        include: {
            teamLead: { select: { name: true, id: true } },
            members: { select: { userId: true } },
            tasks: {
                where: { deletedAt: null },
                select: { status: true, dueDate: true, assignedToId: true }
            }
        }
    });

    let aggregated = { totalTeams: teams.length, totalTasks: 0, completed: 0, overdue: 0, blocked: 0 };
    const now = new Date();

    const teamBreakdown = teams.map(team => {
        let tStats = { total: team.tasks.length, completed: 0, overdue: 0, blocked: 0, completionRate: 0 };
        aggregated.totalTasks += team.tasks.length;

        team.tasks.forEach(t => {
            if (t.status === 'COMPLETED') { tStats.completed++; aggregated.completed++; }
            else if (t.dueDate && t.dueDate < now && t.status !== 'CANCELLED') { tStats.overdue++; aggregated.overdue++; }
            else if (t.status === 'BLOCKED') { tStats.blocked++; aggregated.blocked++; }
        });

        if (tStats.total > 0) tStats.completionRate = Math.round((tStats.completed / tStats.total) * 100);

        return {
            id: team.id,
            name: team.name,
            teamLead: team.teamLead,
            memberCount: team.members.length,
            stats: tStats
        };
    });

    const activityFeed = await prisma.activityLog.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true } } }
    });

    return { aggregated, teamBreakdown, activityFeed };
};
