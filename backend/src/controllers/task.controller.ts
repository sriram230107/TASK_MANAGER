import { Request, Response } from 'express';
import {
    createTaskSchema,
    updateTaskSchema,
    updateTaskStatusSchema,
    taskUpdateSchema,
    taskCommentSchema,
    delegateTaskSchema,
    getTasksQuerySchema
} from '../validators/task.validator';
import * as taskService from '../services/task.service';
import { prisma } from '../utils/prisma';
import { successResponse, errorResponse } from '../utils/response';
import fs from 'node:fs';
import path from 'node:path';
import { storage, buildStorageKey, sniffFileContent, isImageMime } from '../services/storage';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const data = createTaskSchema.parse(req.body);
        const task = await taskService.createTask(user, data);
        successResponse(res, task, 201);
    } catch (error: any) {
        errorResponse(res, error.message || 'Failed to create task', 400);
    }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const task = await taskService.getTaskById(user, req.params.id as string);
        successResponse(res, task);
    } catch (error: any) {
        const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to fetch task', status);
    }
};

export const listTasks = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const query = getTasksQuerySchema.parse(req.query);
        const result = await taskService.getTasks(user, query);
        successResponse(res, result.data, 200, result.meta);
    } catch (error: any) {
        errorResponse(res, error.message || 'Failed to list tasks', 400);
    }
};

export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const data = updateTaskSchema.parse(req.body);
        const task = await taskService.updateTask(user, req.params.id as string, data);
        successResponse(res, task);
    } catch (error: any) {
        const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to update task', status);
    }
};

export const updateStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const data = updateTaskStatusSchema.parse(req.body);
        const task = await taskService.updateTaskStatus(user, req.params.id as string, data);
        successResponse(res, task);
    } catch (error: any) {
        const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to update task status', status);
    }
};

export const logProgress = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const data = taskUpdateSchema.parse(req.body);
        const update = await taskService.logTaskProgress(user, req.params.id as string, data);
        successResponse(res, update, 201);
    } catch (error: any) {
        const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to log progress', status);
    }
};

export const delegate = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const data = delegateTaskSchema.parse(req.body);
        const task = await taskService.delegateTask(user, req.params.id as string, data);
        successResponse(res, task);
    } catch (error: any) {
        const status = error.message?.includes('outside your') || error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to delegate task', status);
    }
};

export const addComment = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const data = taskCommentSchema.parse(req.body);
        const comment = await taskService.addComment(user, req.params.id as string, data.content);
        successResponse(res, comment, 201);
    } catch (error: any) {
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to add comment', status);
    }
};

export const getComments = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const comments = await taskService.getComments(user, req.params.id as string);
        successResponse(res, comments);
    } catch (error: any) {
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to fetch comments', status);
    }
};

export const deleteTask = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const result = await taskService.deleteTask(user, req.params.id as string);
        successResponse(res, result);
    } catch (error: any) {
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to delete task', status);
    }
};

export const uploadAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.file || !req.file.buffer) {
            errorResponse(res, 'No file uploaded', 400);
            return;
        }

        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const task = await prisma.task.findUnique({
            where: { id: req.params.id as string, deletedAt: null }
        });

        if (!task) {
            errorResponse(res, 'Task not found', 404);
            return;
        }

        const canAccess = await taskService.canAccessTask(user, task);
        if (!canAccess) {
            errorResponse(res, 'Forbidden: You cannot attach files to this task', 403);
            return;
        }

        const sniff = sniffFileContent(req.file.buffer, req.file.originalname);
        if (!sniff.isAllowed || sniff.isExecutable) {
            errorResponse(res, 'Invalid file type: expected document or image. Executables are strictly blocked.', 400);
            return;
        }

        const fileKey = buildStorageKey(user.organizationId, req.file.originalname);
        await storage.save(fileKey, req.file.buffer, sniff.mimeType);

        const attachment = await prisma.taskAttachment.create({
            data: {
                taskId: task.id,
                uploadedById: user.id,
                fileUrl: fileKey,
                fileName: req.file.originalname,
                mimeType: sniff.mimeType,
                sizeBytes: req.file.size
            }
        });

        await prisma.taskHistory.create({
            data: {
                taskId: task.id,
                userId: user.id,
                action: 'ATTACHMENT_ADDED',
                details: `Attachment uploaded: ${req.file.originalname}`
            }
        });

        successResponse(res, attachment, 201);
    } catch (error: any) {
        errorResponse(res, error.message || 'Failed to upload attachment', 400);
    }
};

export const downloadAttachment = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const task = await prisma.task.findUnique({
            where: { id: req.params.id as string, deletedAt: null }
        });

        if (!task) {
            errorResponse(res, 'Task not found', 404);
            return;
        }

        const canAccess = await taskService.canAccessTask(user, task);
        if (!canAccess) {
            errorResponse(res, 'Forbidden: You cannot access attachments for this task', 403);
            return;
        }

        const attachment = await prisma.taskAttachment.findFirst({
            where: { id: req.params.attachmentId as string, taskId: task.id }
        });

        if (!attachment) {
            errorResponse(res, 'Attachment not found', 404);
            return;
        }

        const isImage = isImageMime(attachment.mimeType);
        res.setHeader('Content-Type', attachment.mimeType || 'application/octet-stream');
        res.setHeader('Content-Disposition', `${isImage ? 'inline' : 'attachment'}; filename="${encodeURIComponent(attachment.fileName)}"`);

        if (attachment.fileUrl.startsWith('org/')) {
            const stream = await storage.getStream(attachment.fileUrl);
            stream.pipe(res);
            return;
        }

        // Legacy attachment path handling: resolve safely within UPLOAD_DIR
        const clean = attachment.fileUrl.replace(/.*\/uploads\//, '').replace(/^\//, '');
        const uploadBase = path.resolve(process.cwd(), 'uploads');
        const targetPath = path.resolve(uploadBase, clean);

        if (!targetPath.startsWith(uploadBase + path.sep) && targetPath !== uploadBase) {
            errorResponse(res, 'Access denied: Path traversal detected', 400);
            return;
        }

        if (!fs.existsSync(targetPath)) {
            errorResponse(res, 'Attachment file not found on disk', 404);
            return;
        }

        fs.createReadStream(targetPath).pipe(res);
    } catch (error: any) {
        errorResponse(res, error.message || 'Failed to download attachment', 500);
    }
};