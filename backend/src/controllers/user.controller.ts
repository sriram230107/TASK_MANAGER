import { Request, Response } from 'express';
import * as userService from '../services/user.service';
import { updateUserProfileSchema, userQuerySchema, createUserSchema } from '../validators/user.validator';
import { successResponse, errorResponse } from '../utils/response';

export const getMyProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const profile = await userService.getUserById(user, user.id);
        successResponse(res, profile);
    } catch (error: any) {
        console.error('getMyProfile error:', error);
        errorResponse(res, error.message || 'Failed to retrieve profile', error.statusCode || 500);
    }
};

export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const requestingUser = req.user;
        if (!requestingUser) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const targetId = String(req.params.id || req.params.userId || '');
        if (!targetId) {
            errorResponse(res, 'User ID is required', 400);
            return;
        }

        const profile = await userService.getUserById(requestingUser, targetId);
        successResponse(res, profile);
    } catch (error: any) {
        console.error('getUserProfile error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 500;
        errorResponse(res, error.message || 'Failed to retrieve user profile', status);
    }
};

export const listUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const requestingUser = req.user;
        if (!requestingUser) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsedQuery = userQuerySchema.safeParse(req.query);
        if (!parsedQuery.success) {
            errorResponse(res, 'Invalid query parameters', 400, parsedQuery.error.format());
            return;
        }

        const result = await userService.listUsers(requestingUser, parsedQuery.data);
        successResponse(res, result.users, 200, result.pagination);
    } catch (error: any) {
        console.error('listUsers error:', error);
        errorResponse(res, error.message || 'Failed to list users', 500);
    }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const requestingUser = req.user;
        if (!requestingUser) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const targetId = String(req.params.id || req.params.userId || '');
        if (!targetId) {
            errorResponse(res, 'User ID is required', 400);
            return;
        }

        const parsedBody = updateUserProfileSchema.safeParse(req.body);
        if (!parsedBody.success) {
            errorResponse(res, 'Validation failed', 400, parsedBody.error.format());
            return;
        }

        const updated = await userService.updateUserProfile(requestingUser, targetId, parsedBody.data);
        successResponse(res, updated, 200);
    } catch (error: any) {
        console.error('updateProfile error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to update user profile', status);
    }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
    try {
        const requestingUser = req.user;
        if (!requestingUser) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsedBody = createUserSchema.safeParse(req.body);
        if (!parsedBody.success) {
            errorResponse(res, 'Validation failed', 400, parsedBody.error.format());
            return;
        }

        const created = await userService.createUser(requestingUser, parsedBody.data);
        successResponse(res, created, 201);
    } catch (error: any) {
        console.error('createUser error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('already in use') ? 409 : 400;
        errorResponse(res, error.message || 'Failed to create user', status);
    }
};

export const getOrgHierarchy = async (req: Request, res: Response): Promise<void> => {
    try {
        const requestingUser = req.user;
        if (!requestingUser) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const hierarchy = await userService.getOrgHierarchy(requestingUser);
        successResponse(res, hierarchy);
    } catch (error: any) {
        console.error('getOrgHierarchy error:', error);
        errorResponse(res, error.message || 'Failed to retrieve organization hierarchy', 500);
    }
};
