// @ts-nocheck

import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';
import { addDays, addWeeks, addMonths } from 'date-fns';

/*
|--------------------------------------------------------------------------
| TASK SERVICE
|--------------------------------------------------------------------------
|
| Organization hierarchy:
|
| ADMIN
|   └── MANAGER
|         └── TEAM LEAD
|               └── EMPLOYEE
|
| Task flow:
|
| ADMIN:
|   - Can create/assign tasks anywhere inside organization
|   - Can view/manage all organization tasks
|
| MANAGER:
|   - Can create/assign tasks to teams under their Team Leads
|   - Can assign to members of those teams
|   - Can view/manage tasks belonging to their teams
|
| TEAM LEAD:
|   - Can create/assign tasks within their own teams
|   - Can assign to members of their teams
|   - Can view/manage tasks belonging to their teams
|
| EMPLOYEE:
|   - Can view only tasks assigned to themselves
|   - Can update progress
|   - Can submit task for review
|
|--------------------------------------------------------------------------
*/


/* =========================================================================
   USER / HIERARCHY HELPERS
   ========================================================================= */

const getUserWithHierarchy = async (userId: string) => {
    return prisma.user.findUnique({
        where: {
            id: userId,
            deletedAt: null
        },
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


/* =========================================================================
   TASK ACCESS
   ========================================================================= */

const canAccessTask = async (
    user: User,
    task: any
): Promise<boolean> => {

    // Every task must belong to the same organization.
    if (
        task.organizationId !==
        user.organizationId
    ) {
        return false;
    }

    // Deleted tasks are not accessible.
    if (task.deletedAt) {
        return false;
    }

    // ADMIN can access every task in the organization.
    if (user.role === 'ADMIN') {
        return true;
    }

    // EMPLOYEE can access only tasks assigned to them.
    if (user.role === 'EMPLOYEE') {
        return task.assignedToId === user.id;
    }

    // TEAM LEAD can access tasks belonging to their own teams.
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

    // MANAGER can access tasks belonging to teams
    // whose Team Lead reports to this Manager.
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


/* =========================================================================
   TEAM / ASSIGNEE VALIDATION
   ========================================================================= */

const validateAssigneeForTeam = async (
    user: User,
    assignedToId: string,
    teamId: string
) => {

    /*
    |--------------------------------------------------------------------------
    | Find assignee
    |--------------------------------------------------------------------------
    */

    const assignee = await prisma.user.findUnique({
        where: {
            id: assignedToId,
            deletedAt: null
        },
        select: {
            id: true,
            name: true,
            role: true,
            organizationId: true,
            managerId: true
        }
    });

    if (!assignee) {
        throw new Error(
            'Assignee not found'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Organization protection
    |--------------------------------------------------------------------------
    */

    if (
        assignee.organizationId !==
        user.organizationId
    ) {
        throw new Error(
            'Assignee belongs to another organization'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Only employees and team leads can be task assignees.
    |
    | Manager/Admin are task creators/supervisors,
    | not normal task assignees.
    |--------------------------------------------------------------------------
    */

    if (
        assignee.role !== 'EMPLOYEE' &&
        assignee.role !== 'TEAM_LEAD'
    ) {
        throw new Error(
            'Tasks can only be assigned to employees or team leads'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Find team
    |--------------------------------------------------------------------------
    */

    const team = await prisma.team.findUnique({
        where: {
            id: teamId
        },
        include: {
            teamLead: {
                select: {
                    id: true,
                    name: true,
                    managerId: true,
                    organizationId: true
                }
            }
        }
    });

    if (!team) {
        throw new Error(
            'Team not found'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Team organization protection
    |--------------------------------------------------------------------------
    */

    if (
        team.organizationId !==
        user.organizationId
    ) {
        throw new Error(
            'Team belongs to another organization'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | TEAM LEAD
    |--------------------------------------------------------------------------
    |
    | Team Lead can assign only inside their own team.
    |--------------------------------------------------------------------------
    */

    if (user.role === 'TEAM_LEAD') {

        if (
            team.teamLeadId !==
            user.id
        ) {
            throw new Error(
                'You can only assign tasks within your own team'
            );
        }

        const membership =
            await prisma.teamMember.findFirst({
                where: {
                    teamId,
                    userId: assignedToId
                }
            });

        /*
        | A Team Lead may assign to a member of the team.
        |
        | Additionally, the Team Lead can assign a task
        | to themselves.
        */

        if (
            assignedToId !== user.id &&
            !membership
        ) {
            throw new Error(
                'Assignee is not a member of your team'
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | MANAGER
    |--------------------------------------------------------------------------
    |
    | Manager can assign to ANY team under their Team Leads.
    |
    | This is the important correction.
    |--------------------------------------------------------------------------
    */

    if (user.role === 'MANAGER') {

        if (
            team.teamLead.managerId !==
            user.id
        ) {
            throw new Error(
                'You can only assign tasks to teams under your management'
            );
        }

        const membership =
            await prisma.teamMember.findFirst({
                where: {
                    teamId,
                    userId: assignedToId
                }
            });

        /*
        | Team Lead itself can also receive a task.
        |
        | Otherwise the Manager could only assign to
        | Team Members and never directly to the Team Lead.
        */

        const isTeamLead =
            team.teamLeadId ===
            assignedToId;

        if (
            !isTeamLead &&
            !membership
        ) {
            throw new Error(
                'Assignee is not a member of this team'
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | ADMIN
    |--------------------------------------------------------------------------
    |
    | Admin can assign anywhere inside organization.
    |
    | We still verify that the assignee belongs to the team
    | to keep the organization structure consistent.
    |--------------------------------------------------------------------------
    */

    if (user.role === 'ADMIN') {

        const membership =
            await prisma.teamMember.findFirst({
                where: {
                    teamId,
                    userId: assignedToId
                }
            });

        const isTeamLead =
            team.teamLeadId ===
            assignedToId;

        if (
            !membership &&
            !isTeamLead
        ) {
            throw new Error(
                'Assignee must belong to the selected team'
            );
        }
    }

    return {
        assignee,
        team
    };
};


/* =========================================================================
   TASK CREATION VALIDATION
   ========================================================================= */

export const validateTaskCreation = async (
    user: User,
    data: any
) => {

    /*
    |--------------------------------------------------------------------------
    | Employee cannot create tasks.
    |--------------------------------------------------------------------------
    */

    if (user.role === 'EMPLOYEE') {
        throw new Error(
            'Employees cannot create tasks for others'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Only Admin, Manager and Team Lead can create tasks.
    |--------------------------------------------------------------------------
    */

    if (
        ![
            'ADMIN',
            'MANAGER',
            'TEAM_LEAD'
        ].includes(user.role)
    ) {
        throw new Error(
            'You are not authorized to create tasks'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Validate assignee + team according to hierarchy.
    |--------------------------------------------------------------------------
    */

    const {
        assignee,
        team
    } =
        await validateAssigneeForTeam(
            user,
            data.assignedToId,
            data.teamId
        );

    /*
    |--------------------------------------------------------------------------
    | Parent task / subtask validation
    |--------------------------------------------------------------------------
    */

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
            parentTask.deletedAt
        ) {
            throw new Error(
                'Parent task is no longer active'
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

        /*
        | Prevent more than one level of subtasks.
        */

        if (parentTask.parentTaskId) {
            throw new Error(
                'Subtask depth cannot exceed 2 levels'
            );
        }

        /*
        | Parent and child must belong to same team.
        */

        if (
            parentTask.teamId !==
            data.teamId
        ) {
            throw new Error(
                'Subtask must belong to the same team as its parent task'
            );
        }

        /*
        | TEAM LEAD:
        | Can create subtasks only under tasks
        | in their own team.
        */

        if (
            user.role ===
            'TEAM_LEAD'
        ) {

            const parentAccessible =
                await canAccessTask(
                    user,
                    parentTask
                );

            if (!parentAccessible) {
                throw new Error(
                    'You can only create subtasks under tasks in your own team'
                );
            }
        }

        /*
        | MANAGER:
        | Can create subtasks under any task
        | belonging to their managed teams.
        */

        if (
            user.role ===
            'MANAGER'
        ) {

            const parentAccessible =
                await canAccessTask(
                    user,
                    parentTask
                );

            if (!parentAccessible) {
                throw new Error(
                    'You can only create subtasks under tasks in your managed teams'
                );
            }
        }

        /*
        | ADMIN:
        | Organization check above is sufficient.
        */
    }

    return {
        assignedTo: assignee,
        team
    };
};


/* =========================================================================
   CREATE TASK
   ========================================================================= */

export const createTask = async (
    user: User,
    data: any
) => {

    await validateTaskCreation(
        user,
        data
    );

    const {
        recurrenceRule,
        ...taskData
    } = data;

    /*
    |--------------------------------------------------------------------------
    | Remove fields that should not be directly supplied by frontend.
    |--------------------------------------------------------------------------
    */

    const task = await prisma.task.create({
        data: {
            title:
                taskData.title,

            description:
                taskData.description,

            assignedToId:
                taskData.assignedToId,

            teamId:
                taskData.teamId,

            parentTaskId:
                taskData.parentTaskId,

            priority:
                taskData.priority ??
                'MEDIUM',

            estimatedHours:
                taskData.estimatedHours,

            startDate:
                taskData.startDate,

            dueDate:
                taskData.dueDate,

            createdById:
                user.id,

            organizationId:
                user.organizationId,

            status:
                'NOT_STARTED',

            progressPercent:
                0,

            actualHours:
                0
        }
    });

    /*
    |--------------------------------------------------------------------------
    | Recurring task
    |--------------------------------------------------------------------------
    */

    if (recurrenceRule) {

        await prisma.recurrenceRule.create({
            data: {
                taskId:
                    task.id,

                frequency:
                    recurrenceRule.frequency,

                interval:
                    recurrenceRule.interval ||
                    1,

                endDate:
                    recurrenceRule.endDate
            }
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Activity log
    |--------------------------------------------------------------------------
    */

    await prisma.activityLog.create({
        data: {
            userId:
                user.id,

            action:
                'CREATE_TASK',

            entity:
                'Task',

            entityId:
                task.id
        }
    });

    /*
    |--------------------------------------------------------------------------
    | Notify assignee
    |--------------------------------------------------------------------------
    */

    if (
        task.assignedToId !==
        user.id
    ) {

        await prisma.notification.create({
            data: {
                userId:
                    task.assignedToId,

                taskId:
                    task.id,

                type:
                    'TASK_ASSIGNED'
            }
        });
    }

    return task;
};


/* =========================================================================
   UPDATE TASK
   ========================================================================= */

export const updateTask = async (
    user: User,
    taskId: string,
    data: any
) => {

    const task =
        await prisma.task.findUnique({
            where: {
                id: taskId
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

    /*
    |--------------------------------------------------------------------------
    | Employee cannot edit assignment/details.
    |--------------------------------------------------------------------------
    */

    if (
        user.role ===
        'EMPLOYEE'
    ) {
        throw new Error(
            'Employees cannot edit task assignments'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | If assignment/team changes,
    | validate the new hierarchy.
    |--------------------------------------------------------------------------
    */

    if (
        data.assignedToId ||
        data.teamId
    ) {

        const assignedToId =
            data.assignedToId ??
            task.assignedToId;

        const teamId =
            data.teamId ??
            task.teamId;

        await validateAssigneeForTeam(
            user,
            assignedToId,
            teamId
        );
    }

    const oldAssigneeId =
        task.assignedToId;

    /*
    |--------------------------------------------------------------------------
    | Build safe update object.
    |--------------------------------------------------------------------------
    */

    const updateData: any = {};

    const allowedFields = [
        'title',
        'description',
        'assignedToId',
        'teamId',
        'priority',
        'estimatedHours',
        'startDate',
        'dueDate'
    ];

    for (
        const field of allowedFields
    ) {
        if (
            data[field] !==
            undefined
        ) {
            updateData[field] =
                data[field];
        }
    }

    const updatedTask =
        await prisma.task.update({
            where: {
                id: taskId
            },
            data: updateData
        });

    /*
    |--------------------------------------------------------------------------
    | Assignment activity
    |--------------------------------------------------------------------------
    */

    if (
        data.assignedToId &&
        oldAssigneeId !==
            data.assignedToId
    ) {

        await prisma.activityLog.create({
            data: {
                userId:
                    user.id,

                action:
                    'ASSIGNMENT_CHANGED',

                entity:
                    'Task',

                entityId:
                    taskId
            }
        });

        /*
        | Notify new assignee.
        */

        await prisma.notification.create({
            data: {
                userId:
                    data.assignedToId,

                taskId:
                    taskId,

                type:
                    'TASK_ASSIGNED'
            }
        });
    }

    await prisma.activityLog.create({
        data: {
            userId:
                user.id,

            action:
                'UPDATE_TASK',

            entity:
                'Task',

            entityId:
                taskId
        }
    });

    return updatedTask;
};


/* =========================================================================
   UPDATE TASK STATUS
   ========================================================================= */

export const updateTaskStatus = async (
    user: User,
    taskId: string,
    data: any
) => {

    const task =
        await prisma.task.findUnique({
            where: {
                id: taskId
            },
            include: {
                subTasks: true,

                team: {
                    select: {
                        id: true,
                        teamLeadId: true,
                        organizationId: true
                    }
                },

                recurrenceRule: true
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

    /*
    |--------------------------------------------------------------------------
    | EMPLOYEE STATUS FLOW
    |--------------------------------------------------------------------------
    |
    | Employee can:
    |   NOT_STARTED -> IN_PROGRESS
    |   IN_PROGRESS -> BLOCKED
    |   IN_PROGRESS -> ON_HOLD
    |   IN_PROGRESS -> PENDING_REVIEW
    |
    | Employee cannot directly complete the task.
    |--------------------------------------------------------------------------
    */

    if (
        user.role ===
        'EMPLOYEE'
    ) {

        if (
            task.assignedToId !==
            user.id
        ) {
            throw new Error(
                'Only the assignee can update this task'
            );
        }

        if (
            data.status ===
                'COMPLETED'
        ) {
            throw new Error(
                'Employees must submit the task for review before completion'
            );
        }

        /*
        | 100% means review.
        */

        if (
            data.progressPercent ===
            100
        ) {

            if (
                data.status !==
                'PENDING_REVIEW'
            ) {
                throw new Error(
                    '100% progress must be submitted for review'
                );
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | PENDING REVIEW
    |--------------------------------------------------------------------------
    */

    if (
        data.status ===
        'PENDING_REVIEW'
    ) {

        if (
            user.id !==
            task.assignedToId
        ) {
            throw new Error(
                'Only the assignee can submit a task for review'
            );
        }

        if (
            data.progressPercent !==
                undefined &&
            data.progressPercent <
                100
        ) {
            throw new Error(
                'A task must be 100% complete before submitting for review'
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | COMPLETION AUTHORITY
    |--------------------------------------------------------------------------
    |
    | Admin:
    |   Can complete any task.
    |
    | Manager:
    |   Can complete tasks in managed teams.
    |
    | Team Lead:
    |   Can complete tasks in own teams.
    |
    | Employee:
    |   Cannot directly complete.
    |--------------------------------------------------------------------------
    */

    if (
        data.status ===
        'COMPLETED'
    ) {

        if (
            user.role ===
            'EMPLOYEE'
        ) {
            throw new Error(
                'Employees cannot directly complete tasks'
            );
        }

        /*
        | Parent task cannot be completed
        | while subtasks remain incomplete.
        */

        const incompleteSubTasks =
            task.subTasks.filter(
                (st: any) =>
                    st.status !==
                        'COMPLETED' &&
                    st.status !==
                        'CANCELLED'
            );

        if (
            incompleteSubTasks.length >
            0
        ) {
            throw new Error(
                'All subtasks must be completed before completing this task'
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | REVIEW REJECTION
    |--------------------------------------------------------------------------
    |
    | Manager / Team Lead / Admin can send
    | a reviewed task back to IN_PROGRESS.
    |--------------------------------------------------------------------------
    */

    if (
        data.status ===
            'IN_PROGRESS' &&
        task.status ===
            'PENDING_REVIEW'
    ) {

        if (
            user.role ===
            'EMPLOYEE'
        ) {
            throw new Error(
                'Employee cannot reject their own review'
            );
        }

        if (
            !data.comment
        ) {
            throw new Error(
                'Rejecting a review requires a comment'
            );
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Progress normalization
    |--------------------------------------------------------------------------
    */

    let progress =
        data.progressPercent ??
        task.progressPercent;

    if (
        data.status ===
        'COMPLETED'
    ) {
        progress = 100;
    }

    if (
        data.status ===
        'NOT_STARTED'
    ) {
        progress = 0;
    }

    /*
    |--------------------------------------------------------------------------
    | Actual hours
    |--------------------------------------------------------------------------
    */

    const statusUpdateData: any = {
        status:
            data.status,

        progressPercent:
            progress,

        completedAt:
            data.status ===
            'COMPLETED'
                ? new Date()
                : null
    };

    if (
        data.hoursLogged !==
        undefined
    ) {
        statusUpdateData.actualHours = {
            increment:
                data.hoursLogged
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Update task
    |--------------------------------------------------------------------------
    */

    const updatedTask =
        await prisma.task.update({
            where: {
                id: taskId
            },
            data:
                statusUpdateData
        });

    /*
    |--------------------------------------------------------------------------
    | Task update history
    |--------------------------------------------------------------------------
    */

    if (
        data.comment ||
        data.progressPercent !==
            undefined ||
        data.hoursLogged !==
            undefined
    ) {

        await prisma.taskUpdate.create({
            data: {
                taskId:
                    taskId,

                userId:
                    user.id,

                progressPercent:
                    progress,

                comment:
                    data.comment,

                hoursLogged:
                    data.hoursLogged
            }
        });
    }

    /*
    |--------------------------------------------------------------------------
    | Notify relevant people
    |--------------------------------------------------------------------------
    */

    if (
        data.status ===
        'PENDING_REVIEW'
    ) {

        /*
        | Notify Team Lead.
        */

        if (
            task.team?.teamLeadId
        ) {

            await prisma.notification.create({
                data: {
                    userId:
                        task.team.teamLeadId,

                    taskId:
                        task.id,

                    type:
                        'TASK_REVIEW_REQUIRED'
                }
            });
        }
    }

    if (
        data.status ===
        'COMPLETED'
    ) {

        /*
        | Notify creator if creator is not
        | the person completing the task.
        */

        if (
            task.createdById !==
            user.id
        ) {

            await prisma.notification.create({
                data: {
                    userId:
                        task.createdById,

                    taskId:
                        task.id,

                    type:
                        'TASK_COMPLETED'
                }
            });
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Recurring task
    |--------------------------------------------------------------------------
    */

    if (
        data.status ===
            'COMPLETED' &&
        updatedTask.recurrenceRule
    ) {

        const rule =
            updatedTask.recurrenceRule;

        const now =
            new Date();

        let shouldRecur =
            true;

        if (
            rule.endDate &&
            new Date(
                rule.endDate
            ) < now
        ) {
            shouldRecur =
                false;
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

                nextStart =
                    addDays(
                        nextStart,
                        rule.interval
                    );

                nextDue =
                    addDays(
                        nextDue,
                        rule.interval
                    );
            }

            else if (
                rule.frequency ===
                'WEEKLY'
            ) {

                nextStart =
                    addWeeks(
                        nextStart,
                        rule.interval
                    );

                nextDue =
                    addWeeks(
                        nextDue,
                        rule.interval
                    );
            }

            else if (
                rule.frequency ===
                'MONTHLY'
            ) {

                nextStart =
                    addMonths(
                        nextStart,
                        rule.interval
                    );

                nextDue =
                    addMonths(
                        nextDue,
                        rule.interval
                    );
            }

            /*
            | Create next occurrence.
            */

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

            /*
            | Move recurrence rule to the
            | newly created occurrence.
            */

            await prisma.recurrenceRule.update({
                where: {
                    id:
                        rule.id
                },
                data: {
                    taskId:
                        clonedTask.id
                }
            });
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Activity log
    |--------------------------------------------------------------------------
    */

    await prisma.activityLog.create({
        data: {
            userId:
                user.id,

            action:
                'STATUS_CHANGE',

            entity:
                'Task',

            entityId:
                taskId
        }
    });

    return updatedTask;
};


/* =========================================================================
   LOG TASK PROGRESS
   ========================================================================= */

export const logTaskProgress = async (
    user: User,
    taskId: string,
    data: any
) => {

    const task =
        await prisma.task.findUnique({
            where: {
                id: taskId
            }
        });

    if (!task) {
        throw new Error(
            'Task not found'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Only same organization.
    |--------------------------------------------------------------------------
    */

    if (
        task.organizationId !==
        user.organizationId
    ) {
        throw new Error(
            'Forbidden'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Only assignee can log normal progress.
    |--------------------------------------------------------------------------
    */

    if (
        task.assignedToId !==
        user.id
    ) {
        throw new Error(
            'Only assignee can log progress'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Employee cannot log progress on completed/cancelled task.
    |--------------------------------------------------------------------------
    */

    if (
        task.status ===
            'COMPLETED' ||
        task.status ===
            'CANCELLED'
    ) {
        throw new Error(
            'This task is no longer active'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | 100% must use review workflow.
    |--------------------------------------------------------------------------
    */

    if (
        data.progressPercent ===
        100
    ) {
        throw new Error(
            '100% progress requires submitting the task for review'
        );
    }

    /*
    |--------------------------------------------------------------------------
    | Update actual hours.
    |--------------------------------------------------------------------------
    */

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
                    data.progressPercent >
                    0
                        ? 'IN_PROGRESS'
                        : task.status
            }
        });

    /*
    |--------------------------------------------------------------------------
    | Activity log
    |--------------------------------------------------------------------------
    */

    await prisma.activityLog.create({
        data: {
            userId:
                user.id,

            action:
                'PROGRESS_UPDATE',

            entity:
                'Task',

            entityId:
                taskId
        }
    });

    /*
    |--------------------------------------------------------------------------
    | History record
    |--------------------------------------------------------------------------
    */

    await prisma.taskUpdate.create({
        data: {

            taskId:
                taskId,

            userId:
                user.id,

            progressPercent:
                data.progressPercent,

            comment:
                data.comment,

            hoursLogged:
                data.hoursLogged
        }
    });

    return updatedTask;
};


/* =========================================================================
   GET TASKS
   ========================================================================= */

export const getTasks = async (
    user: User,
    query: any
) => {

    const page =
        Number(query.page) ||
        1;

    const limit =
        Math.min(
            Number(query.limit) ||
                10,
            100
        );

    const skip =
        (page - 1) *
        limit;

    /*
    |--------------------------------------------------------------------------
    | Base organization filter.
    |--------------------------------------------------------------------------
    */

    const where: any = {
        organizationId:
            user.organizationId,

        deletedAt:
            null
    };

    /*
    |--------------------------------------------------------------------------
    | Status filter.
    |--------------------------------------------------------------------------
    */

    if (
        query.status
    ) {
        where.status =
            query.status;
    }

    /*
    |--------------------------------------------------------------------------
    | ROLE-BASED VISIBILITY
    |--------------------------------------------------------------------------
    |
    | EMPLOYEE:
    |   Own tasks.
    |
    | TEAM LEAD:
    |   Tasks in own teams.
    |
    | MANAGER:
    |   Tasks in teams under managed Team Leads.
    |
    | ADMIN:
    |   All organization tasks.
    |--------------------------------------------------------------------------
    */

    if (
        user.role ===
        'EMPLOYEE'
    ) {

        where.assignedToId =
            user.id;
    }

    else if (
        user.role ===
        'TEAM_LEAD'
    ) {

        where.team = {
            organizationId:
                user.organizationId,

            teamLeadId:
                user.id
        };
    }

    else if (
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
    }

    else if (
        user.role ===
        'ADMIN'
    ) {

        // Organization filter is enough.
    }

    else {

        /*
        | Unknown role = no access.
        */

        where.id =
            '__NO_ACCESS__';
    }

    /*
    |--------------------------------------------------------------------------
    | assignedTo filter
    |--------------------------------------------------------------------------
    |
    | Important:
    | The role scope above remains active.
    |
    | This means a Manager cannot use ?assignedTo=
    | to access someone outside their hierarchy.
    |--------------------------------------------------------------------------
    */

    if (
        query.assignedTo
    ) {

        where.assignedToId =
            query.assignedTo;
    }

    /*
    |--------------------------------------------------------------------------
    | Query database.
    |--------------------------------------------------------------------------
    */

    const [
        tasks,
        total
    ] =
        await Promise.all([

            prisma.task.findMany({
                where,

                skip,

                take:
                    limit,

                include: {
                    assignedTo: {
                        select: {
                            id: true,
                            name: true,
                            email: true
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

                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                            role: true
                        }
                    }
                },

                orderBy: [
                    {
                        dueDate:
                            'asc'
                    },
                    {
                        createdAt:
                            'desc'
                    }
                ]
            }),

            prisma.task.count({
                where
            })
        ]);

    /*
    |--------------------------------------------------------------------------
    | Computed overdue status.
    |--------------------------------------------------------------------------
    */

    const now =
        new Date();

    const tasksWithComputed =
        tasks.map(
            (task: any) => ({

                ...task,

                isOverdue:
                    !!task.dueDate &&

                    task.dueDate <
                        now &&

                    task.status !==
                        'COMPLETED' &&

                    task.status !==
                        'CANCELLED'
            })
        );

    /*
    |--------------------------------------------------------------------------
    | Response
    |--------------------------------------------------------------------------
    */

    return {

        data:
            tasksWithComputed,

        meta: {

            total,

            page,

            limit,

            totalPages:
                Math.ceil(
                    total /
                    limit
                )
        }
    };
};