// @ts-nocheck

import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';

const getTaskStats = (tasks: any[]) => {
    const now = new Date();

    return tasks.reduce(
        (acc, task) => {
            if (task.status === 'COMPLETED') {
                acc.completed++;
            } else if (
                task.dueDate &&
                task.dueDate < now &&
                task.status !== 'CANCELLED'
            ) {
                acc.overdue++;
            } else if (task.status === 'BLOCKED') {
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
};


/* =========================================================
   EMPLOYEE DASHBOARD
   ========================================================= */

export const getEmployeeDashboard = async (
    user: User
) => {
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
                    id: true,
                    name: true,

                    teamLead: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            },

            assignedTo: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            }
        },

        orderBy: {
            dueDate: 'asc'
        }
    });

    const profile =
        await prisma.user.findUnique({
            where: {
                id: user.id
            },

            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                managerId: true,
                organizationId: true,
                createdAt: true,
                updatedAt: true,
                deletedAt: true,

                manager: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

    const stats = getTaskStats(tasks);

    return {
        profile,
        stats,
        tasks
    };
};


/* =========================================================
   TEAM LEAD DASHBOARD
   ========================================================= */

export const getTeamLeadDashboard = async (
    user: User
) => {

    /*
     * STEP 1
     * Find only teams directly led by this Team Lead.
     */

    const teams = await prisma.team.findMany({
        where: {
            organizationId: user.organizationId,
            teamLeadId: user.id
        },

        include: {
            teamLead: {
                select: {
                    id: true,
                    name: true,
                    email: true
                }
            },

            members: {
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true,
                            role: true,
                            managerId: true
                        }
                    }
                }
            }
        },

        orderBy: {
            name: 'asc'
        }
    });

    const teamIds = teams.map(
        team => team.id
    );

    /*
     * STEP 2
     * Get all employees belonging to those teams.
     */

    const employeeIds = [
        ...new Set(
            teams.flatMap(team =>
                team.members.map(
                    member => member.userId
                )
            )
        )
    ];

    /*
     * STEP 3
     * IMPORTANT:
     * Fetch ALL tasks belonging to the Team Lead's teams.
     *
     * This is what ensures assigned tasks appear
     * in the Team Lead dashboard.
     */

    const allTasks = await prisma.task.findMany({
        take: 1000,

        where: {
            organizationId: user.organizationId,

            teamId: {
                in: teamIds
            },

            deletedAt: null
        },

        include: {
            assignedTo: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true
                }
            },

            createdBy: {
                select: {
                    id: true,
                    name: true,
                    role: true
                }
            },

            team: {
                select: {
                    id: true,
                    name: true
                }
            },

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
            }
        },

        orderBy: [
            {
                dueDate: 'asc'
            },
            {
                createdAt: 'desc'
            }
        ]
    });

    /*
     * STEP 4
     * Overall team statistics.
     */

    const overall =
        getTaskStats(allTasks);

    /*
     * STEP 5
     * Build employee-level task data.
     *
     * Every employee gets their assigned tasks.
     */

    const employeesMap = new Map();

    employeeIds.forEach(
        employeeId => {
            employeesMap.set(
                employeeId,
                {
                    active: 0,
                    completed: 0,
                    overdue: 0,
                    blocked: 0,
                    total: 0,
                    tasks: []
                }
            );
        }
    );

    allTasks.forEach(task => {

        /*
         * Only put a task into an employee's
         * dashboard section if that employee
         * belongs to one of the Team Lead's teams.
         */

        if (
            !employeesMap.has(
                task.assignedToId
            )
        ) {
            return;
        }

        const employeeData =
            employeesMap.get(
                task.assignedToId
            );

        employeeData.total++;

        employeeData.tasks.push(task);

        if (
            task.status ===
            'COMPLETED'
        ) {
            employeeData.completed++;

        } else if (
            task.dueDate &&
            task.dueDate < new Date() &&
            task.status !== 'CANCELLED'
        ) {
            employeeData.overdue++;

        } else if (
            task.status ===
            'BLOCKED'
        ) {
            employeeData.blocked++;

        } else {
            employeeData.active++;
        }
    });

    /*
     * STEP 6
     * Return employees with their assigned tasks.
     */

    const employees =
        teams.flatMap(team =>
            team.members.map(
                member => {

                    const stats =
                        employeesMap.get(
                            member.userId
                        ) || {
                            total: 0,
                            active: 0,
                            completed: 0,
                            overdue: 0,
                            blocked: 0,
                            tasks: []
                        };

                    return {
                        ...member.user,

                        teamId:
                            team.id,

                        teamName:
                            team.name,

                        stats
                    };
                }
            )
        );

    /*
     * STEP 7
     * Tasks waiting for Team Lead review.
     */

    const pendingReview =
        allTasks.filter(
            task =>
                task.status ===
                'PENDING_REVIEW'
        );

    /*
     * STEP 8
     * Recent activity generated by
     * employees in the Team Lead's teams.
     */

    const activityFeed =
        await prisma.activityLog.findMany({
            take: 20,

            where: {
                userId: {
                    in: [
                        ...employeeIds,
                        user.id
                    ]
                }
            },

            orderBy: {
                createdAt: 'desc'
            },

            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                }
            }
        });

    return {
        teams,

        overall,

        employees,

        /*
         * Also return ALL team tasks directly.
         * This gives the frontend a reliable task list
         * instead of forcing it to reconstruct tasks
         * from employee objects.
         */

        tasks: allTasks,

        pendingReview,

        activityFeed
    };
};


/* =========================================================
   MANAGER DASHBOARD
   ========================================================= */

export const getManagerDashboard = async (
    user: User
) => {

    /*
     * Manager can see:
     *
     * Manager
     *   └── Team Lead
     *        └── Team
     *             └── Employees
     *                  └── Tasks
     */

    const teams =
        await prisma.team.findMany({

            where: {
                organizationId:
                    user.organizationId,

                teamLead: {
                    managerId:
                        user.id
                }
            },

            include: {

                teamLead: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },

                members: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true,
                                managerId: true
                            }
                        }
                    }
                },

                tasks: {
                    where: {
                        organizationId:
                            user.organizationId,

                        deletedAt:
                            null
                    },

                    include: {
                        assignedTo: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                role: true
                            }
                        },

                        createdBy: {
                            select: {
                                id: true,
                                name: true,
                                role: true
                            }
                        },

                        team: {
                            select: {
                                id: true,
                                name: true
                            }
                        }
                    },

                    orderBy: {
                        createdAt:
                            'desc'
                    }
                }
            },

            orderBy: {
                name: 'asc'
            }
        });

    const allTasks =
        teams.flatMap(
            team => team.tasks
        );

    const employeeIds = [
        ...new Set(
            teams.flatMap(
                team =>
                    team.members.map(
                        member =>
                            member.userId
                    )
            )
        )
    ];

    const overall =
        getTaskStats(allTasks);

    const aggregated = {
        totalTeams:
            teams.length,

        totalTasks:
            allTasks.length,

        completed:
            overall.completed,

        overdue:
            overall.overdue,

        blocked:
            overall.blocked
    };

    /*
     * Team-by-team manager view.
     */

    const teamBreakdown =
        teams.map(team => {

            const stats =
                getTaskStats(
                    team.tasks
                );

            const total =
                team.tasks.length;

            const completionRate =
                total > 0
                    ? Math.round(
                          (stats.completed /
                              total) *
                              100
                      )
                    : 0;

            return {
                id:
                    team.id,

                name:
                    team.name,

                teamLead:
                    team.teamLead,

                memberCount:
                    team.members.length,

                stats: {
                    total,

                    active:
                        stats.active,

                    completed:
                        stats.completed,

                    overdue:
                        stats.overdue,

                    blocked:
                        stats.blocked,

                    completionRate
                },

                tasks:
                    team.tasks
            };
        });

    /*
     * Manager activity feed.
     */

    const activityFeed =
        await prisma.activityLog.findMany({

            take: 20,

            where: {
                userId: {
                    in: [
                        user.id,
                        ...employeeIds
                    ]
                }
            },

            orderBy: {
                createdAt:
                    'desc'
            },

            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        role: true
                    }
                }
            }
        });

    return {
        aggregated,

        teamBreakdown,

        /*
         * Direct task list for manager.
         */

        tasks:
            allTasks,

        activityFeed
    };
};