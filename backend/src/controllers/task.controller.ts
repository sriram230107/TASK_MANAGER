import { Request, Response } from 'express';
import { createTaskSchema, updateTaskStatusSchema, taskUpdateSchema, getTasksQuerySchema } from '../validators/task.validator';
import * as taskService from '../services/task.service';
import { prisma } from '../utils/prisma';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = createTaskSchema.parse(req.body);
        const task = await taskService.createTask((req as any).user, data);
        res.status(201).json(task);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = updateTaskStatusSchema.parse(req.body);
        const task = await taskService.updateTaskStatus((req as any).user, req.params.id as string, data);
        res.json(task);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const logProgress = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = taskUpdateSchema.parse(req.body);
        const update = await taskService.logTaskProgress((req as any).user, req.params.id as string, data);
        res.status(201).json(update);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const listTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = getTasksQuerySchema.parse(req.query);
        const result = await taskService.getTasks((req as any).user, query);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const uploadAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file) {
            throw new Error('No file uploaded');
        }

        const user = (req as any).user;

        const task = await prisma.task.findUnique({
            where: {
                id: req.params.id as string
            }
        });

        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }

        if (task.organizationId !== user.organizationId) {
            res.status(403).json({ message: 'Forbidden' });
            return;
        }

        let allowed = false;

        if (user.role === 'ADMIN') {
            allowed = true;
        } else if (user.role === 'EMPLOYEE') {
            allowed = task.assignedToId === user.id;
        } else if (user.role === 'TEAM_LEAD') {
            const team = await prisma.team.findFirst({
                where: {
                    id: task.teamId,
                    organizationId: user.organizationId,
                    teamLeadId: user.id
                }
            });

            allowed = !!team;
        } else if (user.role === 'MANAGER') {
            const team = await prisma.team.findFirst({
                where: {
                    id: task.teamId,
                    organizationId: user.organizationId,
                    teamLead: {
                        managerId: user.id
                    }
                }
            });

            allowed = !!team;
        }

        if (!allowed) {
            res.status(403).json({
                message: 'Forbidden: You cannot attach files to this task'
            });
            return;
        }

        const fileUrl =
            `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;

        const attachment = await prisma.taskAttachment.create({
            data: {
                taskId: task.id,
                uploadedById: user.id,
                fileUrl,
                fileName: req.file.originalname,
                mimeType: req.file.mimetype,
                sizeBytes: req.file.size
            }
        });

        res.status(201).json(attachment);
    } catch (error: any) {
        res.status(400).json({
            message: error.message
        });
    }
};