import { Request, Response } from 'express';
import * as attendanceService from '../services/attendance.service';
import {
    checkInSchema,
    checkOutSchema,
    breakSchema,
    attendanceQuerySchema,
    updateAttendanceSchema
} from '../validators/attendance.validator';
import { successResponse, errorResponse } from '../utils/response';

export const getToday = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const targetUserId = req.query.userId ? String(req.query.userId) : undefined;
        const result = await attendanceService.getTodayAttendance(user, targetUserId);
        successResponse(res, result);
    } catch (error: any) {
        console.error('getToday error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 500;
        errorResponse(res, error.message || 'Failed to fetch today attendance', status);
    }
};

export const checkIn = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = checkInSchema.safeParse(req.body || {});
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const record = await attendanceService.checkIn(user, parsed.data);
        successResponse(res, record, 201);
    } catch (error: any) {
        console.error('checkIn error:', error);
        const status = error.message?.includes('Already checked in') ? 409 : 400;
        errorResponse(res, error.message || 'Failed to check in', status);
    }
};

export const startBreak = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = breakSchema.safeParse(req.body || {});
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const result = await attendanceService.startBreak(user, parsed.data.notes);
        successResponse(res, result);
    } catch (error: any) {
        console.error('startBreak error:', error);
        errorResponse(res, error.message || 'Failed to start break', 400);
    }
};

export const endBreak = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const result = await attendanceService.endBreak(user);
        successResponse(res, result);
    } catch (error: any) {
        console.error('endBreak error:', error);
        errorResponse(res, error.message || 'Failed to end break', 400);
    }
};

export const checkOut = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = checkOutSchema.safeParse(req.body || {});
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const updated = await attendanceService.checkOut(user, parsed.data.notes);
        successResponse(res, updated);
    } catch (error: any) {
        console.error('checkOut error:', error);
        const status = error.message?.includes('Already checked out') ? 409 : 400;
        errorResponse(res, error.message || 'Failed to check out', status);
    }
};

export const listAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = attendanceQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            errorResponse(res, 'Invalid query parameters', 400, parsed.error.format());
            return;
        }

        const result = await attendanceService.listAttendance(user, parsed.data);
        successResponse(res, result.records, 200, result.pagination);
    } catch (error: any) {
        console.error('listAttendance error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 500;
        errorResponse(res, error.message || 'Failed to list attendance records', status);
    }
};

export const getSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const targetUserId = req.query.userId ? String(req.query.userId) : undefined;
        const days = req.query.days ? Number(req.query.days) : 30;

        const summary = await attendanceService.getAttendanceSummary(user, targetUserId, days);
        successResponse(res, summary);
    } catch (error: any) {
        console.error('getSummary error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 500;
        errorResponse(res, error.message || 'Failed to get attendance summary', status);
    }
};

export const updateRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const attendanceId = String(req.params.id || '');
        if (!attendanceId) {
            errorResponse(res, 'Attendance ID is required', 400);
            return;
        }

        const parsed = updateAttendanceSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const updated = await attendanceService.updateAttendanceRecord(user, attendanceId, parsed.data);
        successResponse(res, updated);
    } catch (error: any) {
        console.error('updateRecord error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to update attendance record', status);
    }
};
