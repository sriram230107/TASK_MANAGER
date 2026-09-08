import { Request, Response } from 'express';
import * as performanceService from '../services/performance.service';
import {
    createGoalSchema,
    updateGoalSchema,
    goalQuerySchema,
    createReviewSchema,
    metricsQuerySchema
} from '../validators/performance.validator';
import { successResponse, errorResponse } from '../utils/response';

export const getMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = metricsQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            errorResponse(res, 'Invalid query parameters', 400, parsed.error.format());
            return;
        }

        const metrics = await performanceService.getPerformanceMetrics(
            user,
            parsed.data.level,
            parsed.data.id,
            parsed.data.periodStart,
            parsed.data.periodEnd
        );
        successResponse(res, metrics);
    } catch (error: any) {
        console.error('getMetrics error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 500;
        errorResponse(res, error.message || 'Failed to fetch metrics', status);
    }
};

export const createReview = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = createReviewSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const review = await performanceService.submitReview(user, parsed.data as any);
        successResponse(res, review, 201);
    } catch (error: any) {
        console.error('createReview error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to submit review', status);
    }
};

export const listReviews = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const employeeId = req.query.employeeId ? String(req.query.employeeId) : undefined;
        const reviews = await performanceService.listReviews(user, employeeId);
        successResponse(res, reviews);
    } catch (error: any) {
        console.error('listReviews error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 500;
        errorResponse(res, error.message || 'Failed to list reviews', status);
    }
};

export const createGoal = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = createGoalSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const goal = await performanceService.createGoal(user, parsed.data as any);
        successResponse(res, goal, 201);
    } catch (error: any) {
        console.error('createGoal error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to create goal', status);
    }
};

export const updateGoal = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const goalId = String(req.params.id || '');
        if (!goalId) {
            errorResponse(res, 'Goal ID is required', 400);
            return;
        }

        const parsed = updateGoalSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const updated = await performanceService.updateGoal(user, goalId, parsed.data);
        successResponse(res, updated);
    } catch (error: any) {
        console.error('updateGoal error:', error);
        const status =
            error.message?.includes('Forbidden') ? 403 :
            error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to update goal', status);
    }
};

export const listGoals = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = goalQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            errorResponse(res, 'Invalid query parameters', 400, parsed.error.format());
            return;
        }

        const result = await performanceService.listGoals(user, parsed.data);
        successResponse(res, result.goals, 200, result.pagination);
    } catch (error: any) {
        console.error('listGoals error:', error);
        errorResponse(res, error.message || 'Failed to list goals', 500);
    }
};

export const deleteGoal = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const goalId = String(req.params.id || '');
        if (!goalId) {
            errorResponse(res, 'Goal ID is required', 400);
            return;
        }

        const result = await performanceService.deleteGoal(user, goalId);
        successResponse(res, result);
    } catch (error: any) {
        console.error('deleteGoal error:', error);
        const status =
            error.message?.includes('Forbidden') ? 403 :
            error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to delete goal', status);
    }
};
