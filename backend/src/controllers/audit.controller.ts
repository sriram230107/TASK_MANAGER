import { Request, Response } from 'express';
import * as auditService from '../services/audit.service';
import { auditQuerySchema } from '../validators/audit.validator';
import { successResponse, errorResponse } from '../utils/response';

/**
 * List audit logs
 * Restricted: ADMIN (org-wide), MANAGER (department/direct reports scope).
 * Forbidden: TEAM_LEAD, EMPLOYEE (403).
 */
export const listAuditLogs = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parseResult = auditQuerySchema.safeParse(req.query);
        if (!parseResult.success) {
            errorResponse(res, parseResult.error.issues[0].message, 400);
            return;
        }

        const result = await auditService.listAuditLogs(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            parseResult.data
        );

        successResponse(res, result.logs, 200, result.pagination);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        console.error('List audit logs error:', err);
        errorResponse(res, err.message || 'Failed to list audit logs', 500);
    }
};

/**
 * Get audit summary metrics
 */
export const getAuditSummary = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const summary = await auditService.getAuditSummary({
            id: user.id,
            role: user.role,
            organizationId: user.organizationId,
            departmentId: user.departmentId
        });

        successResponse(res, summary);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        console.error('Get audit summary error:', err);
        errorResponse(res, err.message || 'Failed to retrieve audit summary', 500);
    }
};
