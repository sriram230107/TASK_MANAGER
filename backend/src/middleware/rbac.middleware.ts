import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import {
    isAuthorizedForTarget,
    isAuthorizedForTeam,
    isAuthorizedForDepartment
} from '../utils/hierarchy';
import { errorResponse } from '../utils/response';

/**
 * Standard Role capability matrix per /PROJECT_SPEC.md
 * ADMIN > MANAGER > TEAM_LEAD > EMPLOYEE
 */
const permissions: Record<string, Record<string, string[]>> = {
    ADMIN: {
        organization: ['create', 'read', 'update', 'delete', 'manage'],
        department: ['create', 'read', 'update', 'delete', 'manage'],
        team: ['create', 'read', 'update', 'delete', 'manage'],
        user: ['create', 'read', 'update', 'delete', 'manage'],
        task: ['create', 'read', 'update', 'delete', 'assign', 'review'],
        attendance: ['create', 'read', 'update', 'delete', 'manage'],
        'work-hours': ['create', 'read', 'update', 'delete', 'manage'],
        leave: ['create', 'read', 'update', 'delete', 'approve', 'cancel', 'manage'],
        performance: ['create', 'read', 'update', 'delete', 'manage'],
        goals: ['create', 'read', 'update', 'delete', 'manage'],
        payroll: ['create', 'read', 'update', 'delete', 'manage'],
        reports: ['read', 'export'],
        notifications: ['create', 'read', 'update', 'delete'],
        documents: ['create', 'read', 'update', 'delete'],
        audit: ['read'],
        settings: ['read', 'update', 'manage'],
        template: ['create', 'read', 'update', 'delete', 'instantiate']
    },
    MANAGER: {
        organization: ['read'],
        department: ['read', 'update'],
        team: ['read', 'create', 'update'],
        user: ['read', 'create', 'update'],
        task: ['create', 'read', 'update', 'assign', 'review'],
        attendance: ['read', 'update'],
        'work-hours': ['read'],
        leave: ['create', 'read', 'update', 'approve', 'cancel'],
        performance: ['create', 'read', 'update'],
        goals: ['create', 'read', 'update', 'delete'],
        payroll: ['read'], // limited department scope
        reports: ['read', 'export'],
        notifications: ['create', 'read', 'update', 'delete'],
        documents: ['create', 'read', 'update'],
        audit: ['read'], // limited department
        settings: ['read'],
        template: ['create', 'read', 'instantiate']
    },
    TEAM_LEAD: {
        organization: ['read'],
        department: ['read'],
        team: ['read', 'update'],
        user: ['read'],
        task: ['create', 'read', 'update', 'assign', 'review'],
        attendance: ['read', 'update'],
        'work-hours': ['read'],
        leave: ['create', 'read', 'approve', 'cancel'],
        performance: ['create', 'read'],
        goals: ['create', 'read', 'update'],
        payroll: [],
        reports: ['read', 'export'],
        notifications: ['create', 'read', 'update', 'delete'],
        documents: ['create', 'read'],
        audit: [],
        settings: ['read'],
        template: ['read', 'instantiate']
    },
    EMPLOYEE: {
        organization: ['read'],
        department: ['read'],
        team: ['read'],
        user: ['read'],
        task: ['read', 'update'],
        attendance: ['create', 'read', 'update'],
        'work-hours': ['read'],
        leave: ['create', 'read', 'cancel'],
        performance: ['read'],
        goals: ['create', 'read', 'update'],
        payroll: ['read'], // own payslips only
        reports: ['read'],
        notifications: ['read', 'update', 'delete'],
        documents: ['read'],
        audit: [],
        settings: ['read'],
        template: ['read']
    }
};

/**
 * Gatekeeper middleware to require one of the specified roles.
 */
export const requireRole = (...allowedRoles: Role[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        if (!allowedRoles.includes(user.role)) {
            errorResponse(res, `Forbidden: Requires role ${allowedRoles.join(' or ')}`, 403);
            return;
        }

        next();
    };
};

/**
 * Convenience alias for Admin-only routes.
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Authorizes access based on resource, action, and organizational scope.
 */
export const authorize = (resource: string, action: string) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const user = req.user;
            if (!user) {
                errorResponse(res, 'Unauthorized', 401);
                return;
            }

            // 1. Role capability check
            const targetUserId =
                req.params?.userId ||
                (resource === 'user' ? req.params?.id : undefined) ||
                req.body?.userId ||
                req.body?.employeeId ||
                req.body?.assignedToId ||
                req.query?.assignedTo ||
                req.query?.employeeId;

            const isSelfUpdate = resource === 'user' && action === 'update' && (
                targetUserId === user.id || req.params?.id === user.id || req.params?.userId === user.id
            );

            const allowedActions = permissions[user.role]?.[resource] || [];
            if (!allowedActions.includes(action) && !isSelfUpdate) {
                errorResponse(res, `Forbidden: Role ${user.role} cannot ${action} ${resource}`, 403);
                return;
            }

            // 2. Rule 6: Enforce tenant isolation by server-deriving organizationId
            if (req.body && typeof req.body === 'object') {
                req.body.organizationId = user.organizationId;
            }

            // 3. Target User Scope Check
            if (targetUserId && typeof targetUserId === 'string' && targetUserId !== 'me' && targetUserId !== 'hierarchy') {
                const authorized = await isAuthorizedForTarget(user, targetUserId);
                if (!authorized) {
                    errorResponse(res, 'Forbidden: User is outside your organizational scope', 403);
                    return;
                }
            }

            // 4. Target Team Scope Check
            const targetTeamId =
                req.params?.teamId ||
                req.body?.teamId ||
                req.query?.teamId;

            if (targetTeamId && typeof targetTeamId === 'string') {
                const authorized = await isAuthorizedForTeam(user, targetTeamId);
                if (!authorized) {
                    errorResponse(res, 'Forbidden: Team is outside your organizational scope', 403);
                    return;
                }
            }

            // 5. Target Department Scope Check
            const targetDepartmentId =
                req.params?.departmentId ||
                req.body?.departmentId ||
                req.query?.departmentId;

            if (targetDepartmentId && typeof targetDepartmentId === 'string') {
                const authorized = await isAuthorizedForDepartment(user, targetDepartmentId);
                if (!authorized) {
                    errorResponse(res, 'Forbidden: Department is outside your organizational scope', 403);
                    return;
                }
            }

            next();
        } catch (error: any) {
            console.error('RBAC authorization error:', error);
            errorResponse(res, 'Authorization check failed', 500);
        }
    };
};

/**
 * Injects server-derived scope filters into `req.scope` for data queries.
 */
export const enforceScope = (req: Request, res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
        errorResponse(res, 'Unauthorized', 401);
        return;
    }

    const orgId = user.organizationId;

    if (user.role === 'ADMIN') {
        req.scope = {
            organizationId: orgId,
            userWhere: { organizationId: orgId, deletedAt: null },
            teamWhere: { organizationId: orgId },
            departmentWhere: { organizationId: orgId },
            taskWhere: { organizationId: orgId, deletedAt: null }
        };
    } else if (user.role === 'MANAGER') {
        req.scope = {
            organizationId: orgId,
            userWhere: {
                organizationId: orgId,
                deletedAt: null,
                OR: [
                    { id: user.id },
                    { managerId: user.id },
                    ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
                    { department: { managerId: user.id } },
                    { memberships: { some: { team: { teamLead: { managerId: user.id } } } } }
                ]
            },
            teamWhere: {
                organizationId: orgId,
                OR: [
                    { teamLead: { managerId: user.id } },
                    { department: { managerId: user.id } },
                    ...(user.departmentId ? [{ departmentId: user.departmentId }] : [])
                ]
            },
            departmentWhere: {
                organizationId: orgId,
                OR: [
                    { managerId: user.id },
                    ...(user.departmentId ? [{ id: user.departmentId }] : [])
                ]
            },
            taskWhere: {
                organizationId: orgId,
                deletedAt: null,
                OR: [
                    { createdById: user.id },
                    { assignedManagerId: user.id },
                    { assignedToId: user.id },
                    { department: { managerId: user.id } },
                    ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
                    { team: { teamLead: { managerId: user.id } } }
                ]
            }
        };
    } else if (user.role === 'TEAM_LEAD') {
        req.scope = {
            organizationId: orgId,
            userWhere: {
                organizationId: orgId,
                deletedAt: null,
                OR: [
                    { id: user.id },
                    { teamLeadId: user.id },
                    { memberships: { some: { team: { teamLeadId: user.id } } } }
                ]
            },
            teamWhere: {
                organizationId: orgId,
                teamLeadId: user.id
            },
            departmentWhere: user.departmentId ? { id: user.departmentId, organizationId: orgId } : { id: 'none' },
            taskWhere: {
                organizationId: orgId,
                deletedAt: null,
                OR: [
                    { createdById: user.id },
                    { assignedTeamLeadId: user.id },
                    { assignedToId: user.id },
                    { team: { teamLeadId: user.id } }
                ]
            }
        };
    } else {
        // EMPLOYEE
        req.scope = {
            organizationId: orgId,
            userWhere: {
                id: user.id,
                organizationId: orgId,
                deletedAt: null
            },
            teamWhere: {
                organizationId: orgId,
                members: { some: { userId: user.id } }
            },
            departmentWhere: user.departmentId ? { id: user.departmentId, organizationId: orgId } : { id: 'none' },
            taskWhere: {
                organizationId: orgId,
                deletedAt: null,
                assignedToId: user.id
            }
        };
    }

    next();
};