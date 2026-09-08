import { Request, Response } from 'express';
import * as leaveService from '../services/leave.service';
import {
    createLeaveRequestSchema,
    reviewLeaveRequestSchema,
    leaveQuerySchema
} from '../validators/leave.validator';
import { successResponse, errorResponse } from '../utils/response';

export const getBalances = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const targetUserId = req.query.userId ? String(req.query.userId) : undefined;
        const year = req.query.year ? Number(req.query.year) : undefined;

        const balances = await leaveService.getLeaveBalances(user, targetUserId, year);
        successResponse(res, balances);
    } catch (error: any) {
        console.error('getBalances error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 500;
        errorResponse(res, error.message || 'Failed to fetch leave balances', status);
    }
};

export const applyLeave = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = createLeaveRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const request = await leaveService.applyLeave(user, parsed.data as any);
        successResponse(res, request, 201);
    } catch (error: any) {
        console.error('applyLeave error:', error);
        const status =
            error.message?.includes('Overlapping') ? 409 :
            error.message?.includes('Insufficient') ? 400 :
            error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to submit leave request', status);
    }
};

export const reviewLeave = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const leaveId = String(req.params.id || '');
        if (!leaveId) {
            errorResponse(res, 'Leave request ID is required', 400);
            return;
        }

        const parsed = reviewLeaveRequestSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const updated = await leaveService.reviewLeaveRequest(
            user,
            leaveId,
            parsed.data.action,
            parsed.data.notes
        );
        successResponse(res, updated);
    } catch (error: any) {
        console.error('reviewLeave error:', error);
        const status =
            error.message?.includes('Forbidden') ? 403 :
            error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to review leave request', status);
    }
};

export const cancelLeave = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const leaveId = String(req.params.id || '');
        if (!leaveId) {
            errorResponse(res, 'Leave request ID is required', 400);
            return;
        }

        const cancelled = await leaveService.cancelLeaveRequest(user, leaveId);
        successResponse(res, cancelled);
    } catch (error: any) {
        console.error('cancelLeave error:', error);
        const status =
            error.message?.includes('Forbidden') ? 403 :
            error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to cancel leave request', status);
    }
};

export const listLeaves = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = leaveQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            errorResponse(res, 'Invalid query parameters', 400, parsed.error.format());
            return;
        }

        const result = await leaveService.listLeaveRequests(user, parsed.data);
        successResponse(res, result.requests, 200, result.pagination);
    } catch (error: any) {
        console.error('listLeaves error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 500;
        errorResponse(res, error.message || 'Failed to list leave requests', status);
    }
};
