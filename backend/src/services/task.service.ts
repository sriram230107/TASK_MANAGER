import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { createTaskSchema, updateTaskStatusSchema, taskUpdateSchema, getTasksQuerySchema } from '../validators/task.validator';
import { User, TaskStatus } from '@prisma/client';

export const validateTaskCreation = async (user: User, data: z.infer<typeof createTaskSchema>) => {
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

export const createTask = async (user: User, data: z.infer<typeof createTaskSchema>) => {
    await validateTaskCreation(user, data);

    return prisma.task.create({
        data: {
            ...data,
            createdById: user.id,
            organizationId: user.organizationId
        }
    });
};

export const updateTaskStatus = async (user: User, taskId: string, data: z.infer<typeof updateTaskStatusSchema>) => {
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
        }
    });

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

    return updatedTask;
};

export const logTaskProgress = async (user: User, taskId: string, data: z.infer<typeof taskUpdateSchema>) => {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) throw new Error('Task not found');

    if (task.assignedToId !== user.id) {
        throw new Error('Only assignee can log progress');
    }

    await prisma.task.update({
        where: { id: taskId },
        data: { progressPercent: data.progressPercent }
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

export const getTasks = async (user: User, query: z.infer<typeof getTasksQuerySchema>) => {
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

    return { data: tasks, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
};
