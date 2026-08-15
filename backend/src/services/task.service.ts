// @ts-nocheck
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { createTaskSchema, updateTaskStatusSchema, taskUpdateSchema, getTasksQuerySchema } from '../validators/task.validator';
import { User, TaskStatus } from '@prisma/client';
import { addDays, addWeeks, addMonths } from 'date-fns';

export const validateTaskCreation = async (user: User, data: any) => {
    if (user.role === 'EMPLOYEE') {
        throw new Error('Employees cannot create tasks for others');
    }

    const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
    if (!assignee) throw new Error('Assignee not found');

    if (user.role === 'TEAM_LEAD') {
        if (!data.parentTaskId) {
            throw new Error('Team Leads can only create subtasks under a parent task');
        }
        const parentTask = await prisma.task.findUnique({ where: { id: data.parentTaskId } });
        if (!parentTask || parentTask.assignedToId !== user.id) {
            throw new Error('You can only create subtasks under a task assigned to you');
        }
    }

    if (data.parentTaskId) {
        const parent = await prisma.task.findUnique({ where: { id: data.parentTaskId } });
        if (parent?.parentTaskId) {
            throw new Error('Subtask depth cannot exceed 2');
        }
    }
};

export const createTask = async (user: User, data: any) => {
    await validateTaskCreation(user, data);

    const { recurrenceRule, ...taskData } = data;

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
                interval: recurrenceRule.interval || 1,
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

export const updateTaskStatus = async (user: User, taskId: string, data: any) => {
    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { subTasks: true } });
    if (!task) throw new Error('Task not found');

    if (data.status === 'PENDING_REVIEW') {
        if (user.id !== task.assignedToId) throw new Error('Only assignee can mark for review');
    }

    if (data.status === 'COMPLETED') {
        if (user.id !== task.createdById) {
            throw new Error('Only task creator or manager can approve completion');
        }

        if (task.subTasks.some((st: any) => st.status !== 'COMPLETED')) {
            throw new Error('All subtasks must be completed before marking this parent task as completed. You can flag it manually or set it to PENDING_REVIEW.');
        }
    }

    if (data.status === 'IN_PROGRESS' && task.status === 'PENDING_REVIEW' && !data.comment) {
        throw new Error('Rejecting a review requires a comment');
    }

    const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: {
            status: data.status,
            progressPercent: data.progressPercent ?? task.progressPercent,
            completedAt: data.status === 'COMPLETED' ? new Date() : null
        },
        include: { recurrenceRule: true }
    });

    if (data.status === 'COMPLETED' && updatedTask.recurrenceRule) {
        const rule = updatedTask.recurrenceRule;
        const now = new Date();

        let shouldRecur = true;
        if (rule.endDate && new Date(rule.endDate) < now) shouldRecur = false;

        if (shouldRecur) {
            let nextStart = updatedTask.startDate ? new Date(updatedTask.startDate) : new Date();
            let nextDue = updatedTask.dueDate ? new Date(updatedTask.dueDate) : new Date();

            if (rule.frequency === 'DAILY') {
                nextStart = addDays(nextStart, rule.interval);
                nextDue = addDays(nextDue, rule.interval);
            } else if (rule.frequency === 'WEEKLY') {
                nextStart = addWeeks(nextStart, rule.interval);
                nextDue = addWeeks(nextDue, rule.interval);
            } else if (rule.frequency === 'MONTHLY') {
                nextStart = addMonths(nextStart, rule.interval);
                nextDue = addMonths(nextDue, rule.interval);
            }

            const clonedTask = await prisma.task.create({
                data: {
                    title: updatedTask.title,
                    description: updatedTask.description,
                    createdById: updatedTask.createdById,
                    assignedToId: updatedTask.assignedToId,
                    teamId: updatedTask.teamId,
                    parentTaskId: updatedTask.parentTaskId,
                    organizationId: updatedTask.organizationId,
                    priority: updatedTask.priority,
                    estimatedHours: updatedTask.estimatedHours,
                    startDate: nextStart,
                    dueDate: nextDue,
                    status: 'NOT_STARTED',
                    progressPercent: 0,
                    actualHours: 0
                }
            });

            await prisma.recurrenceRule.update({
                where: { id: rule.id },
                data: { taskId: clonedTask.id }
            });
        }
    }

    if (data.comment || data.progressPercent !== undefined || data.hoursLogged !== undefined) {
        await prisma.taskUpdate.create({
            data: {
                taskId,
                userId: user.id,
                progressPercent: data.progressPercent ?? task.progressPercent,
                comment: data.comment,
                hoursLogged: data.hoursLogged
            }
        });
    }

    await prisma.activityLog.create({
        data: {
            userId: user.id,
            action: 'STATUS_CHANGE',
            entity: 'Task',
            entityId: taskId
        }
    });

    return updatedTask;
};

export const logTaskProgress = async (user: User, taskId: string, data: any) => {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');

    if (task.assignedToId !== user.id) {
        throw new Error('Only assignee can log progress');
    }

    await prisma.task.update({
        where: { id: taskId },
        data: { progressPercent: data.progressPercent }
    });

    await prisma.activityLog.create({
        data: {
            userId: user.id,
            action: 'PROGRESS_UPDATE',
            entity: 'Task',
            entityId: taskId
        }
    });

    return prisma.taskUpdate.create({
        data: {
            taskId,
            userId: user.id,
            progressPercent: data.progressPercent,
            comment: data.comment,
            hoursLogged: data.hoursLogged
        }
    });
};

export const getTasks = async (user: User, query: any) => {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = { organizationId: user.organizationId };
    if (query.status) where.status = query.status;
    if (query.assignedTo) where.assignedToId = query.assignedTo;
    if (user.role === 'EMPLOYEE') {
        where.assignedToId = user.id;
    }

    const [tasks, total] = await Promise.all([
        prisma.task.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
        prisma.task.count({ where })
    ]);

    const now = new Date();
    const tasksWithComputed = tasks.map((t: any) => ({
        ...t,
        isOverdue: t.dueDate && t.dueDate < now && t.status !== 'COMPLETED' && t.status !== 'CANCELLED'
    }));

    return { data: tasksWithComputed, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
};
