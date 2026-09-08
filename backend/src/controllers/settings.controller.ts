import { Request, Response } from 'express';
import * as settingsService from '../services/settings.service';
import {
    updateOrgSettingsSchema,
    createDepartmentSchema,
    updateDepartmentSchema
} from '../validators/settings.validator';
import { successResponse, errorResponse } from '../utils/response';

/**
 * Get organization settings
 * Accessible by any member of the organization
 */
export const getOrganizationSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const settings = await settingsService.getOrganizationSettings({
            id: user.id,
            role: user.role,
            organizationId: user.organizationId,
            departmentId: user.departmentId
        });

        successResponse(res, settings);
    } catch (err: any) {
        console.error('Get organization settings error:', err);
        errorResponse(res, err.message || 'Failed to retrieve organization settings', 500);
    }
};

/**
 * Update organization settings
 * ADMIN only
 */
export const updateOrganizationSettings = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parseResult = updateOrgSettingsSchema.safeParse(req.body);
        if (!parseResult.success) {
            errorResponse(res, parseResult.error.issues[0].message, 400);
            return;
        }

        const updated = await settingsService.updateOrganizationSettings(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            parseResult.data
        );

        successResponse(res, updated);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        console.error('Update organization settings error:', err);
        errorResponse(res, err.message || 'Failed to update organization settings', 400);
    }
};

/**
 * Create department
 * ADMIN only
 */
export const createDepartment = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parseResult = createDepartmentSchema.safeParse(req.body);
        if (!parseResult.success) {
            errorResponse(res, parseResult.error.issues[0].message, 400);
            return;
        }

        const department = await settingsService.createDepartment(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            parseResult.data
        );

        successResponse(res, department, 201);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        console.error('Create department error:', err);
        errorResponse(res, err.message || 'Failed to create department', 400);
    }
};

/**
 * Update department
 * ADMIN or department MANAGER
 */
export const updateDepartment = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const { id } = req.params;
        const parseResult = updateDepartmentSchema.safeParse(req.body);
        if (!parseResult.success) {
            errorResponse(res, parseResult.error.issues[0].message, 400);
            return;
        }

        const updated = await settingsService.updateDepartment(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            id as string,
            parseResult.data
        );

        successResponse(res, updated);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        if (err.message === 'Department not found') {
            errorResponse(res, err.message, 404);
            return;
        }
        console.error('Update department error:', err);
        errorResponse(res, err.message || 'Failed to update department', 400);
    }
};

/**
 * Delete department
 * ADMIN only
 */
export const deleteDepartment = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const { id } = req.params;
        const result = await settingsService.deleteDepartment(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            id as string
        );

        successResponse(res, result);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        if (err.message === 'Department not found') {
            errorResponse(res, err.message, 404);
            return;
        }
        console.error('Delete department error:', err);
        errorResponse(res, err.message || 'Failed to delete department', 400);
    }
};
