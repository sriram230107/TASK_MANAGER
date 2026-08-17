// @ts-nocheck
import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';

export const getEmployeeDashboard = async (user: User) => {
    const tasks = await prisma.task.findMany({
        take: 500,
        where: {
            organizationId: user.organizationId,
            assignedToId: user.id,
            deletedAt: null
        },
        include: {
            parentTask: {
                select: {
                    id: true,
                    title: true
                }
            },
            updates: {
                orderBy: {
                    createdAt: 'desc'
                }
            },
            team: {
                select: {
                    name: true,
                    teamLead: {
                        select: {
                            name: true
                        }
                    }
                }
            }
        },
        orderBy: {
            dueDate: 'asc'
        }
    });

    const profile = await prisma.user.findUnique({
        where: {
            id: user.id
        },
        include: {
            manager: {
                select: {
                    name: true
                }
            }
        }
    });

    const now = new Date();

    const stats = tasks.reduce(
        (acc, t) => {
            if (t.status === 'COMPLETED') {
                acc.completed++;
            } else if (
                t.dueDate &&
                t.dueDate < now &&
                t.status !== 'CANCELLED'
            ) {
                acc.overdue++;
            } else if (t.status === 'BLOCKED') {
                acc.blocked++;
            } else {
                acc.active++;
            }

            return acc;
        },
        {
            active: 0,
            completed: 0,
            overdue: 0,
            blocked: 0
        }
    );

    return {
        profile,
        stats,
        tasks
    };
};

export const getTeamLeadDashboard = async (user: User) => {
    const teams = await prisma.team.findMany({
        where: {
            organizationId: user.organizationId,
            teamLeadId: user.id
        },
        include: {
            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                }
            }
        }
    });

    const teamIds = teams.map(t => t.id);

    const employeeIds = teams.flatMap(
        team => team.members.map(member => member.userId)
    );

    const allTasks = await prisma.task.findMany({
        take: 500,
        where: {
            organizationId: user.organizationId,
            teamId: {
                in: teamIds
            },
            deletedAt: null
        },
        include: {
            updates: {
                orderBy: {
                    createdAt: 'desc'
                }
            }
        }
    });

    const now = new Date();

    const overall = {
        active: 0,
        completed: 0,
        overdue: 0,
        blocked: 0
    };

    const employeesMap = new Map();

    employeeIds.forEach(id => {
        employeesMap.set(id, {
            active: 0,
            completed: 0,
            tasks: []
        });
    });

    allTasks.forEach(task => {
        if (task.status === 'COMPLETED') {
            overall.completed++;
        } else if (
            task.dueDate &&
            task.dueDate < now &&
            task.status !== 'CANCELLED'
        ) {
            overall.overdue++;
        } else if (task.status === 'BLOCKED') {
            overall.blocked++;
        } else {
            overall.active++;
        }

        if (employeesMap.has(task.assignedToId)) {
            const employeeData = employeesMap.get(
                task.assignedToId
            );

            employeeData.tasks.push(task);

            if (task.status === 'COMPLETED') {
                employeeData.completed++;
            } else {
                employeeData.active++;
            }
        }
    });

    const employees = teams.flatMap(team =>
        team.members.map(member => ({
            ...member.user,
            teamId: team.id,
            teamName: team.name,
            stats: employeesMap.get(member.userId)
        }))
    );

    const pendingReview = await prisma.task.findMany({
        where: {
            organizationId: user.organizationId,
            teamId: {
                in: teamIds
            },
            status: 'PENDING_REVIEW',
            deletedAt: null
        },
        include: {
            assignedTo: {
                select: {
                    name: true
                }
            }
        }
    });

    const activityFeed = await prisma.activityLog.findMany({
        take: 15,
        where: {
            userId: {
                in: employeeIds
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        include: {
            user: {
                select: {
                    name: true
                }
            }
        }
    });

    return {
        teams,
        overall,
        employees,
        pendingReview,
        activityFeed
    };
};

export const getManagerDashboard = async (user: User) => {
    const teams = await prisma.team.findMany({
        where: {
            organizationId: user.organizationId,
            teamLead: {
                managerId: user.id
            }
        },
        include: {
            teamLead: {
                select: {
                    name: true,
                    id: true
                }
            },
            members: {
                select: {
                    userId: true
                }
            },
            tasks: {
                where: {
                    organizationId: user.organizationId,
                    deletedAt: null
                },
                select: {
                    status: true,
                    dueDate: true,
                    assignedToId: true
                }
            }
        }
    });

    const employeeIds = teams.flatMap(
        team => team.members.map(member => member.userId)
    );

    const aggregated = {
        totalTeams: teams.length,
        totalTasks: 0,
        completed: 0,
        overdue: 0,
        blocked: 0
    };

    const now = new Date();

    const teamBreakdown = teams.map(team => {
        const stats = {
            total: team.tasks.length,
            completed: 0,
            overdue: 0,
            blocked: 0,
            completionRate: 0
        };

        aggregated.totalTasks += team.tasks.length;

        team.tasks.forEach(task => {
            if (task.status === 'COMPLETED') {
                stats.completed++;
                aggregated.completed++;
            } else if (
                task.dueDate &&
                task.dueDate < now &&
                task.status !== 'CANCELLED'
            ) {
                stats.overdue++;
                aggregated.overdue++;
            } else if (task.status === 'BLOCKED') {
                stats.blocked++;
                aggregated.blocked++;
            }
        });

        if (stats.total > 0) {
            stats.completionRate = Math.round(
                (stats.completed / stats.total) * 100
            );
        }

        return {
            id: team.id,
            name: team.name,
            teamLead: team.teamLead,
            memberCount: team.members.length,
            stats
        };
    });

    const activityFeed = await prisma.activityLog.findMany({
        take: 15,
        where: {
            userId: {
                in: [
                    user.id,
                    ...employeeIds
                ]
            }
        },
        orderBy: {
            createdAt: 'desc'
        },
        include: {
            user: {
                select: {
                    name: true
                }
            }
        }
    });

    return {
        aggregated,
        teamBreakdown,
        activityFeed
    };
};