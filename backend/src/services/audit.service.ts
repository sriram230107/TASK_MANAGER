import { prisma } from '../utils/prisma';
import { Role } from '@prisma/client';
import { AuditQueryParams } from '../validators/audit.validator';
import { getDepartmentMemberIds, getDirectReportIds } from '../utils/hierarchy';

export interface AuditLogEntry {
    userId?: string | null;
    action: string;
    entity: string;
    entityId: string;
    metadata?: Record<string, any> | null;
    ipAddress?: string | null;
}

/**
 * Standard audit logger utility to safely record system events.
 */
export const logAudit = async (entry: AuditLogEntry): Promise<void> => {
    try {
        await prisma.auditLog.create({
            data: {
                userId: entry.userId || null,
                action: entry.action,
                entity: entry.entity,
                entityId: entry.entityId,
                metadata: entry.metadata ? (entry.metadata as any) : undefined,
                ipAddress: entry.ipAddress || null
            }
        });
    } catch (err) {
        console.error('Failed to write audit log entry:', err);
    }
};

/**
 * List audit logs with strict role and organizational scope checks.
 * ADMIN: Full organization logs.
 * MANAGER: Scoped to self, department members, and direct reports.
 * TEAM_LEAD / EMPLOYEE: Forbidden (HTTP 403).
 */
export const listAuditLogs = async (
    requestingUser: { id: string; role: Role; organizationId: string; departmentId?: string | null },
    query: AuditQueryParams
) => {
    // Ordinary employees and team leads have zero access to audit logs
    if (requestingUser.role === Role.EMPLOYEE || requestingUser.role === Role.TEAM_LEAD) {
        throw new Error('FORBIDDEN: Audit logs are restricted to Administrators and Department Managers.');
    }

    const { entity, action, userId, startDate, endDate, search, page = 1, limit = 30 } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (requestingUser.role === Role.ADMIN) {
        // Find users in this organization so we filter audit logs by organization
        const orgUserIds = (await prisma.user.findMany({
            where: { organizationId: requestingUser.organizationId },
            select: { id: true }
        })).map((u) => u.id);

        where.OR = [
            { userId: { in: orgUserIds } },
            { userId: null, metadata: { path: ['organizationId'], equals: requestingUser.organizationId } }
        ];
    } else if (requestingUser.role === Role.MANAGER) {
        // Manager can see their own actions + actions by members of their department and direct reports
        const deptUserIds = requestingUser.departmentId
            ? await getDepartmentMemberIds(requestingUser.departmentId)
            : [];
        const directReportIds = await getDirectReportIds(requestingUser.id);
        const allowedUserIds = Array.from(new Set([requestingUser.id, ...deptUserIds, ...directReportIds]));

        where.userId = { in: allowedUserIds };
    }

    // Additional query filters
    if (entity) {
        where.entity = { equals: entity, mode: 'insensitive' };
    }

    if (action) {
        where.action = { equals: action, mode: 'insensitive' };
    }

    if (userId) {
        // If manager specifies a userId, ensure it's in their allowed list
        if (requestingUser.role === Role.MANAGER && where.userId) {
            const allowed = (where.userId.in as string[]).includes(userId);
            if (!allowed) {
                throw new Error('FORBIDDEN: You cannot view audit logs for users outside your management scope.');
            }
        }
        where.userId = userId;
    }

    if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) {
            where.createdAt.gte = new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            // Include entire day if YYYY-MM-DD
            if (typeof endDate === 'string' && endDate.length === 10) {
                end.setHours(23, 59, 59, 999);
            }
            where.createdAt.lte = end;
        }
    }

    if (search) {
        const searchCondition = [
            { action: { contains: search, mode: 'insensitive' } },
            { entity: { contains: search, mode: 'insensitive' } },
            { entityId: { contains: search, mode: 'insensitive' } }
        ];

        if (where.OR) {
            where.AND = [
                { OR: where.OR },
                { OR: searchCondition }
            ];
            delete where.OR;
        } else {
            where.OR = searchCondition;
        }
    }

    const [total, logs] = await Promise.all([
        prisma.auditLog.count({ where }),
        prisma.auditLog.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        role: true,
                        department: { select: { id: true, name: true } }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        })
    ]);

    return {
        logs,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1
        }
    };
};

/**
 * Get aggregated summary metrics for audit logs
 */
export const getAuditSummary = async (
    requestingUser: { id: string; role: Role; organizationId: string; departmentId?: string | null }
) => {
    if (requestingUser.role === Role.EMPLOYEE || requestingUser.role === Role.TEAM_LEAD) {
        throw new Error('FORBIDDEN: Audit logs are restricted to Administrators and Department Managers.');
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const baseWhere: any = {};
    if (requestingUser.role === Role.ADMIN) {
        const orgUserIds = (await prisma.user.findMany({
            where: { organizationId: requestingUser.organizationId },
            select: { id: true }
        })).map((u) => u.id);
        baseWhere.userId = { in: orgUserIds };
    } else {
        const deptUserIds = requestingUser.departmentId ? await getDepartmentMemberIds(requestingUser.departmentId) : [];
        const directReportIds = await getDirectReportIds(requestingUser.id);
        baseWhere.userId = { in: Array.from(new Set([requestingUser.id, ...deptUserIds, ...directReportIds])) };
    }

    const [totalEvents, last24hEvents, last7dEvents, criticalActions] = await Promise.all([
        prisma.auditLog.count({ where: baseWhere }),
        prisma.auditLog.count({ where: { ...baseWhere, createdAt: { gte: oneDayAgo } } }),
        prisma.auditLog.count({ where: { ...baseWhere, createdAt: { gte: sevenDaysAgo } } }),
        prisma.auditLog.count({
            where: {
                ...baseWhere,
                action: { in: ['DELETE', 'DELETE_DOCUMENT', 'DELETE_USER', 'TERMINATE', 'REJECT_LEAVE', 'UPDATE_ROLE'] }
            }
        })
    ]);

    return {
        totalEvents,
        last24hEvents,
        last7dEvents,
        criticalActions
    };
};
