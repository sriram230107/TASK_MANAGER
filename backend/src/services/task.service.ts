// @ts-nocheck
import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';
import { addDays, addWeeks, addMonths } from 'date-fns';

const getUserWithHierarchy = async (userId: string) => {
    return prisma.user.findUnique({
        where: { id: userId, deletedAt: null },
        include: {
            manager: {
                select: {
                    id: true,
                    role: true,
                    organizationId: true,
                    managerId: true
                }
            }
        }
    });
};

const canAccessTask = async (user: User, task: any): Promise<boolean> => {
    if (task.organizationId !== user.organizationId) {
        return false;
    }

    if (user.role === 'ADMIN') {
        return true;
    }

    if (user.role === 'EMPLOYEE') {
        return task.assignedToId === user.id;
    }

    if (user.role === 'TEAM_LEAD') {
        const team = await prisma.team.findFirst({
            where: {
                id: task.teamId,
                organizationId: user.organizationId,
                teamLeadId: user.id
            }
        });

        return !!team;
    }

    if (user.role === 'MANAGER') {
        const team = await prisma.team.findFirst({
            where: {
                id: task.teamId,
                organizationId: user.organizationId,
                teamLead: {
                    managerId: user.id
                }
            }
        });

        return !!team;
    }

    return false;
};

const validateAssigneeForTeam = async (
    user: User,
    assignedToId: string,
    teamId: string
) => {
    const assignee = await prisma.user.findUnique({
        where: {
            id: assignedToId,
            deletedAt: null
        },
        select: {
            id: true,
            role: true,
            organizationId: true,
            managerId: true
        }
    });

    if (!assignee) {
        throw new Error('Assignee not found');
    }

    if (assignee.organizationId !== user.organizationId) {
        throw new Error('Assignee belongs to another organization');
    }

    if (
        assignee.role !== 'EMPLOYEE' &&
        assignee.role !== 'TEAM_LEAD'
    ) {
        throw new Error(
            'Tasks can only be assigned to employees or team leads'
        );
    }

    const team = await prisma.team.findUnique({
        where: { id: teamId },
        include: {
            teamLead: {
                select: {
                    id: true,
                    managerId: true,
                    organizationId: true
                }
            }
        }
    });

    if (!team) {
        throw new Error('Team not found');
    }

    if (team.organizationId !== user.organizationId) {
        throw new Error('Team belongs to another organization');
    }

    if (user.role === 'TEAM_LEAD') {
        if (team.teamLeadId !== user.id) {
            throw new Error('You can only use your own team');
        }

        const membership = await prisma.teamMember.findFirst({
            where: {
                teamId,
                userId: assignedToId
            }
        });

        if (!membership) {
            throw new Error('Assignee is not a member of your team');
        }
    }

    if (user.role === 'MANAGER') {
        if (team.teamLead.managerId !== user.id) {
            throw new Error(
                'You can only use teams under your management'
            );
        }

        const membership = await prisma.teamMember.findFirst({
            where: {
                teamId,
                userId: assignedToId
            }
        });

        if (!membership) {
            throw new Error(
                'Assignee is not a member of this team'
            );
        }
    }

    return { assignee, team };
};

export const validateTaskCreation = async (
    user: User,
    data: any
) => {
    if (user.role === 'EMPLOYEE') {
        throw new Error(
            'Employees cannot create tasks for others'
        );
    }

    if (
        !['ADMIN', 'MANAGER', 'TEAM_LEAD'].includes(
            user.role
        )
    ) {
        throw new Error(
            'You are not authorized to create tasks'
        );
    }

    const { assignedTo, team } =
        await validateAssigneeForTeam(
            user,
            data.assignedToId,
            data.teamId
        );

    if (data.parentTaskId) {
        const parentTask =
            await prisma.task.findUnique({
                where: {
                    id: data.parentTaskId
                }
            });

        if (!parentTask) {
            throw new Error(
                'Parent task not found'
            );
        }

        if (
            parentTask.organizationId !==
            user.organizationId
        ) {
            throw new Error(
                'Parent task belongs to another organization'
            );
        }

        if (parentTask.parentTaskId) {
            throw new Error(
                'Subtask depth cannot exceed 2'
            );
        }

        if (user.role === 'TEAM_LEAD') {
            if (
                parentTask.assignedToId !==
                user.id
            ) {
                throw new Error(
                    'You can only create subtasks under a task assigned to you'
                );
            }

            if (
                parentTask.teamId !==
                data.teamId
            ) {
                throw new Error(
                    'Subtask must belong to the same team as its parent task'
                );
            }
        }

        if (user.role === 'MANAGER') {
            const parentAccessible =
                await canAccessTask(
                    user,
                    parentTask
                );

            if (!parentAccessible) {
                throw new Error(
                    'You can only create subtasks under tasks in your teams'
                );
            }
        }

        if (user.role === 'ADMIN') {
            // Organization check above is sufficient.
        }
    }

    return { assignedTo, team };
};

export const createTask = async (
    user: User,
    data: any
) => {
    await validateTaskCreation(user, data);

    const {
        recurrenceRule,
        ...taskData
    } = data;

    const task = await prisma.task.create({
        data: {
            ...taskData,
            createdById: user.id,
            organizationId: user.organizationId
        }
    });

    if (recurrenceRule) {
        await prisma.recurrenceRule.create({
            data: {
                taskId: task.id,
                frequency: recurrenceRule.frequency,
                interval:
                    recurrenceRule.interval || 1,
                endDate: recurrenceRule.endDate
            }
        });
    }

    await prisma.activityLog.create({
        data: {
            userId: user.id,
            action: 'CREATE_TASK',
            entity: 'Task',
            entityId: task.id
        }
    });

    return task;
};

export const updateTask = async (
    user: User,
    taskId: string,
    data: any
) => {
    const task =
        await prisma.task.findUnique({
            where: { id: taskId }
        });

    if (!task) {
        throw new Error('Task not found');
    }

    if (
        !(await canAccessTask(
            user,
            task
        ))
    ) {
        throw new Error(
            'Forbidden: You cannot modify this task'
        );
    }

    if (user.role === 'EMPLOYEE') {
        throw new Error(
            'Employees cannot edit task assignments'
        );
    }

    if (
        data.assignedToId ||
        data.teamId
    ) {
        const assignedToId =
            data.assignedToId ||
            task.assignedToId;

        const teamId =
            data.teamId ||
            task.teamId;

        await validateAssigneeForTeam(
            user,
            assignedToId,
            teamId
        );
    }

    const oldAssigneeId =
        task.assignedToId;

    const updatedTask =
        await prisma.task.update({
            where: { id: taskId },
            data
        });

    if (
        data.assignedToId &&
        oldAssigneeId !==
            data.assignedToId
    ) {
        await prisma.activityLog.create({
            data: {
                userId: user.id,
                action:
                    `ASSIGNMENT_CHANGE_FROM_${oldAssigneeId}_TO_${data.assignedToId}_BY_${user.id}`,
                entity: 'Task',
                entityId: taskId
            }
        });
    }

    await prisma.activityLog.create({
        data: {
            userId: user.id,
            action: 'UPDATE_TASK',
            entity: 'Task',
            entityId: taskId
        }
    });

    return updatedTask;
};

export const updateTaskStatus = async (
    user: User,
    taskId: string,
    data: any
) => {
    const task =
        await prisma.task.findUnique({
            where: { id: taskId },
            include: {
                subTasks: true,
                team: {
                    select: {
                        teamLeadId: true,
                        organizationId: true
                    }
                }
            }
        });

    if (!task) {
        throw new Error(
            'Task not found'
        );
    }

    if (
        !(await canAccessTask(
            user,
            task
        ))
    ) {
        throw new Error(
            'Forbidden: You cannot modify this task'
        );
    }

    if (
        data.status ===
        'PENDING_REVIEW'
    ) {
        if (
            user.id !==
            task.assignedToId
        ) {
            throw new Error(
                'Only assignee can mark the task for review'
            );
        }
    }

    if (
        data.status ===
        'COMPLETED'
    ) {
        const isCreator =
            user.id ===
            task.createdById;

        const isTeamLead =
            user.role ===
                'TEAM_LEAD' &&
            task.team?.teamLeadId ===
                user.id;

        const isAdmin =
            user.role ===
            'ADMIN';

        if (
            !isCreator &&
            !isTeamLead &&
            !isAdmin
        ) {
            throw new Error(
                'Only the task creator, team lead, or admin can complete this task'
            );
        }

        if (
            task.status ===
                'PENDING_REVIEW' ||
            isTeamLead ||
            isAdmin
        ) {
            if (
                task.subTasks.some(
                    (st: any) =>
                        st.status !==
                        'COMPLETED'
                )
            ) {
                throw new Error(
                    'All subtasks must be completed before marking this parent task as completed'
                );
            }
        }
    }

    if (
        data.status ===
            'IN_PROGRESS' &&
        task.status ===
            'PENDING_REVIEW' &&
        !data.comment
    ) {
        throw new Error(
            'Rejecting a review requires a comment'
        );
    }

    const updatedTask =
        await prisma.task.update({
            where: { id: taskId },
            data: {
                status: data.status,
                progressPercent:
                    data.progressPercent ??
                    task.progressPercent,
                completedAt:
                    data.status ===
                    'COMPLETED'
                        ? new Date()
                        : null
            },
            include: {
                recurrenceRule: true
            }
        });

    if (
        data.status ===
            'COMPLETED' &&
        updatedTask.recurrenceRule
    ) {
        const rule =
            updatedTask.recurrenceRule;

        const now = new Date();

        let shouldRecur = true;

        if (
            rule.endDate &&
            new Date(
                rule.endDate
            ) < now
        ) {
            shouldRecur = false;
        }

        if (shouldRecur) {
            let nextStart =
                updatedTask.startDate
                    ? new Date(
                          updatedTask.startDate
                      )
                    : new Date();

            let nextDue =
                updatedTask.dueDate
                    ? new Date(
                          updatedTask.dueDate
                      )
                    : new Date();

            if (
                rule.frequency ===
                'DAILY'
            ) {
                nextStart = addDays(
                    nextStart,
                    rule.interval
                );

                nextDue = addDays(
                    nextDue,
                    rule.interval
                );
            } else if (
                rule.frequency ===
                'WEEKLY'
            ) {
                nextStart = addWeeks(
                    nextStart,
                    rule.interval
                );

                nextDue = addWeeks(
                    nextDue,
                    rule.interval
                );
            } else if (
                rule.frequency ===
                'MONTHLY'
            ) {
                nextStart = addMonths(
                    nextStart,
                    rule.interval
                );

                nextDue = addMonths(
                    nextDue,
                    rule.interval
                );
            }

            const clonedTask =
                await prisma.task.create({
                    data: {
                        title:
                            updatedTask.title,

                        description:
                            updatedTask.description,

                        createdById:
                            updatedTask.createdById,

                        assignedToId:
                            updatedTask.assignedToId,

                        teamId:
                            updatedTask.teamId,

                        parentTaskId:
                            updatedTask.parentTaskId,

                        organizationId:
                            updatedTask.organizationId,

                        priority:
                            updatedTask.priority,

                        estimatedHours:
                            updatedTask.estimatedHours,

                        startDate:
                            nextStart,

                        dueDate:
                            nextDue,

                        status:
                            'NOT_STARTED',

                        progressPercent:
                            0,

                        actualHours:
                            0
                    }
                });

            await prisma.recurrenceRule.update(
                {
                    where: {
                        id: rule.id
                    },
                    data: {
                        taskId:
                            clonedTask.id
                    }
                }
            );
        }
    }

    if (
        data.comment ||
        data.progressPercent !==
            undefined ||
        data.hoursLogged !==
            undefined
    ) {
        await prisma.taskUpdate.create({
            data: {
                taskId,
                userId: user.id,
                progressPercent:
                    data.progressPercent ??
                    task.progressPercent,
                comment:
                    data.comment,
                hoursLogged:
                    data.hoursLogged
            }
        });
    }

    await prisma.activityLog.create({
        data: {
            userId: user.id,
            action:
                'STATUS_CHANGE',
            entity: 'Task',
            entityId: taskId
        }
    });

    return updatedTask;
};

export const logTaskProgress = async (
    user: User,
    taskId: string,
    data: any
) => {
    const task =
        await prisma.task.findUnique({
            where: { id: taskId }
        });

    if (!task) {
        throw new Error(
            'Task not found'
        );
    }

    if (
        task.organizationId !==
        user.organizationId
    ) {
        throw new Error(
            'Forbidden'
        );
    }

    if (
        task.assignedToId !==
        user.id
    ) {
        throw new Error(
            'Only assignee can log progress'
        );
    }

    // 100% progress must go through
    // the completion workflow.
    if (
        data.progressPercent ===
        100
    ) {
        throw new Error(
            '100% progress requires the task completion workflow'
        );
    }

    const updatedTask =
        await prisma.task.update({
            where: {
                id: taskId
            },
            data: {
                progressPercent:
                    data.progressPercent,

                actualHours:
                    data.hoursLogged !==
                    undefined
                        ? {
                              increment:
                                  data.hoursLogged
                          }
                        : undefined,

                status:
                    'IN_PROGRESS'
            }
        });

    await prisma.activityLog.create({
        data: {
            userId: user.id,
            action:
                'PROGRESS_UPDATE',
            entity: 'Task',
            entityId: taskId
        }
    });

    return prisma.taskUpdate.create({
        data: {
            taskId,
            userId: user.id,
            progressPercent:
                data.progressPercent,
            comment:
                data.comment,
            hoursLogged:
                data.hoursLogged
        }
    });
};

export const getTasks = async (
    user: User,
    query: any
) => {
    const page =
        query.page || 1;

    const limit =
        query.limit || 10;

    const skip =
        (page - 1) * limit;

    const where: any = {
        organizationId:
            user.organizationId,

        deletedAt: null
    };

    if (query.status) {
        where.status =
            query.status;
    }

    if (
        user.role ===
        'EMPLOYEE'
    ) {
        where.assignedToId =
            user.id;
    } else if (
        user.role ===
        'TEAM_LEAD'
    ) {
        where.team = {
            teamLeadId:
                user.id,

            organizationId:
                user.organizationId
        };
    } else if (
        user.role ===
        'MANAGER'
    ) {
        where.team = {
            organizationId:
                user.organizationId,

            teamLead: {
                managerId:
                    user.id
            }
        };
    } else if (
        user.role ===
        'ADMIN'
    ) {
        // Organization filter
        // already applies.
    } else {
        where.id =
            '__NO_ACCESS__';
    }

    // Only allow an assignedTo
    // filter within the user's
    // authorized scope.
    if (query.assignedTo) {
        where.assignedToId =
            query.assignedTo;
    }

    const [
        tasks,
        total
    ] = await Promise.all([
        prisma.task.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
                createdAt:
                    'desc'
            }
        }),

        prisma.task.count({
            where
        })
    ]);

    const now =
        new Date();

    const tasksWithComputed =
        tasks.map(
            (t: any) => ({
                ...t,

                isOverdue:
                    !!t.dueDate &&
                    t.dueDate <
                        now &&
                    t.status !==
                        'COMPLETED' &&
                    t.status !==
                        'CANCELLED'
            })
        );

    return {
        data:
            tasksWithComputed,

        meta: {
            total,

            page,

            limit,

            totalPages:
                Math.ceil(
                    total / limit
                )
        }
    };
};