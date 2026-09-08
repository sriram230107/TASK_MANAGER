import { Request, Response } from 'express';
import * as notificationService from '../services/notification.service';
import {
    createNotificationSchema,
    broadcastNotificationSchema,
    queryNotificationSchema
} from '../validators/notification.validator';
import { successResponse, errorResponse } from '../utils/response';

export const list = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = queryNotificationSchema.safeParse(req.query);
        const filters: any = {};
        if (parsed.success) {
            if (parsed.data.isRead !== undefined) {
                filters.isRead = parsed.data.isRead === 'true';
            }
            if (parsed.data.page) filters.page = parsed.data.page;
            if (parsed.data.limit) filters.limit = parsed.data.limit;
        }

        const result = await notificationService.listNotifications(user, filters);
        successResponse(res, result);
    } catch (error: any) {
        console.error('list notifications error:', error);
        errorResponse(res, error.message || 'Failed to list notifications', 400);
    }
};

export const getUnreadCount = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const result = await notificationService.getUnreadCount(user);
        successResponse(res, result);
    } catch (error: any) {
        console.error('getUnreadCount error:', error);
        errorResponse(res, error.message || 'Failed to get unread count', 400);
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const notification = await notificationService.markAsRead(user, req.params.id as string);
        successResponse(res, notification);
    } catch (error: any) {
        console.error('markAsRead error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to mark notification as read', status);
    }
};

export const markAllAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const result = await notificationService.markAllAsRead(user);
        successResponse(res, result);
    } catch (error: any) {
        console.error('markAllAsRead error:', error);
        errorResponse(res, error.message || 'Failed to mark all as read', 400);
    }
};

export const deleteNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const result = await notificationService.deleteNotification(user, req.params.id as string);
        successResponse(res, result);
    } catch (error: any) {
        console.error('deleteNotification error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to delete notification', status);
    }
};

export const clearRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const result = await notificationService.clearReadNotifications(user);
        successResponse(res, result);
    } catch (error: any) {
        console.error('clearRead error:', error);
        errorResponse(res, error.message || 'Failed to clear read notifications', 400);
    }
};

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = createNotificationSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const notification = await notificationService.createNotification(
            parsed.data.userId,
            parsed.data.type,
            parsed.data.message,
            parsed.data.taskId
        );
        successResponse(res, notification, 201);
    } catch (error: any) {
        console.error('create notification error:', error);
        errorResponse(res, error.message || 'Failed to create notification', 400);
    }
};

export const broadcast = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = broadcastNotificationSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const result = await notificationService.broadcastNotification(
            user,
            parsed.data.targetScope,
            parsed.data.message,
            parsed.data.targetId
        );
        successResponse(res, result, 201);
    } catch (error: any) {
        console.error('broadcast error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to broadcast announcement', status);
    }
};
