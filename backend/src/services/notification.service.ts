import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';
import { isAuthorizedForTeam, isAuthorizedForDepartment } from '../utils/hierarchy';

export interface NotificationQueryFilters {
    isRead?: boolean;
    page?: number;
    limit?: number;
}

/**
 * Creates and persists a single in-app notification to PostgreSQL.
 */
export const createNotification = async (
    userId: string,
    type: string,
    message: string,
    taskId?: string | null
) => {
    const user = await prisma.user.findUnique({
        where: { id: userId, deletedAt: null }
    });
    if (!user) return null;

    return prisma.notification.create({
        data: {
            userId,
            taskId: taskId || null,
            type,
            message
        },
        include: {
            task: { select: { id: true, title: true, priority: true, status: true } }
        }
    });
};

/**
 * Broadcasts an announcement or alert across an authorized scope (Organization, Department, or Team).
 */
export const broadcastNotification = async (
    sender: User,
    targetScope: 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM',
    message: string,
    targetId?: string | null
) => {
    let targetUserIds: string[] = [];

    if (targetScope === 'ORGANIZATION') {
        if (sender.role !== 'ADMIN') {
            throw new Error('Forbidden: Only administrators can broadcast organization-wide announcements');
        }
        const users = await prisma.user.findMany({
            where: { organizationId: sender.organizationId, deletedAt: null },
            select: { id: true }
        });
        targetUserIds = users.map((u) => u.id);
    } else if (targetScope === 'DEPARTMENT') {
        const deptId = targetId || sender.departmentId;
        if (!deptId) throw new Error('Department ID is required for department announcements');

        if (sender.role !== 'ADMIN') {
            const isAuth = await isAuthorizedForDepartment(sender, deptId);
            if (!isAuth) throw new Error('Forbidden: Department is outside your authorized scope');
        }

        const users = await prisma.user.findMany({
            where: { departmentId: deptId, organizationId: sender.organizationId, deletedAt: null },
            select: { id: true }
        });
        targetUserIds = users.map((u) => u.id);
    } else if (targetScope === 'TEAM') {
        if (!targetId) throw new Error('Team ID is required for team announcements');

        if (sender.role !== 'ADMIN') {
            const isAuth = await isAuthorizedForTeam(sender, targetId);
            if (!isAuth) throw new Error('Forbidden: Team is outside your authorized scope');
        }

        const members = await prisma.teamMember.findMany({
            where: { teamId: targetId },
            select: { userId: true }
        });
        targetUserIds = members.map((m) => m.userId);
    }

    if (targetUserIds.length === 0) {
        return { count: 0, message: 'No recipients found for this broadcast' };
    }

    const created = await prisma.notification.createMany({
        data: targetUserIds.map((userId) => ({
            userId,
            type: 'ANNOUNCEMENT',
            message: `[${sender.name} - ${sender.role}]: ${message}`
        }))
    });

    return {
        count: created.count,
        recipientsCount: targetUserIds.length,
        message: `Broadcast delivered to ${targetUserIds.length} recipients`
    };
};

/**
 * Lists notifications for the authenticated user with unread count and pagination.
 */
export const listNotifications = async (
    user: User,
    filters: NotificationQueryFilters = {}
) => {
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = { userId: user.id };
    if (filters.isRead !== undefined) {
        where.isRead = filters.isRead;
    }

    const [notifications, total, unreadCount] = await Promise.all([
        prisma.notification.findMany({
            where,
            skip,
            take: limit,
            orderBy: { sentAt: 'desc' },
            include: {
                task: { select: { id: true, title: true, priority: true, status: true } }
            }
        }),
        prisma.notification.count({ where }),
        prisma.notification.count({ where: { userId: user.id, isRead: false } })
    ]);

    return {
        notifications,
        unreadCount,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Gets unread count for badge indicators.
 */
export const getUnreadCount = async (user: User) => {
    const unreadCount = await prisma.notification.count({
        where: { userId: user.id, isRead: false }
    });
    return { unreadCount };
};

/**
 * Marks a specific notification as read. Enforces user ownership.
 */
export const markAsRead = async (user: User, notificationId: string) => {
    const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
    });

    if (!notification) throw new Error('Notification not found');
    if (notification.userId !== user.id) {
        throw new Error('Forbidden: You can only update your own notifications');
    }

    return prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true }
    });
};

/**
 * Marks all unread notifications for user as read.
 */
export const markAllAsRead = async (user: User) => {
    const result = await prisma.notification.updateMany({
        where: { userId: user.id, isRead: false },
        data: { isRead: true }
    });

    return { updatedCount: result.count, message: 'All notifications marked as read' };
};

/**
 * Deletes a specific notification. Enforces user ownership.
 */
export const deleteNotification = async (user: User, notificationId: string) => {
    const notification = await prisma.notification.findUnique({
        where: { id: notificationId }
    });

    if (!notification) throw new Error('Notification not found');
    if (notification.userId !== user.id) {
        throw new Error('Forbidden: You can only delete your own notifications');
    }

    await prisma.notification.delete({
        where: { id: notificationId }
    });

    return { success: true, message: 'Notification deleted successfully' };
};

/**
 * Clears all read notifications for user.
 */
export const clearReadNotifications = async (user: User) => {
    const result = await prisma.notification.deleteMany({
        where: { userId: user.id, isRead: true }
    });

    return { deletedCount: result.count, message: 'Read notifications cleared' };
};

/**
 * Automatic event helper: Notifies stakeholders on task lifecycle changes or comments.
 */
export const notifyTaskParticipants = async (
    taskId: string,
    actor: User,
    type: string,
    message: string
) => {
    try {
        const task = await prisma.task.findUnique({
            where: { id: taskId },
            select: {
                createdById: true,
                assignedManagerId: true,
                assignedTeamLeadId: true,
                assignedEmployeeId: true,
                assignedToId: true,
                title: true
            }
        });

        if (!task) return;

        const participantIds = new Set<string>();
        if (task.createdById) participantIds.add(task.createdById);
        if (task.assignedManagerId) participantIds.add(task.assignedManagerId);
        if (task.assignedTeamLeadId) participantIds.add(task.assignedTeamLeadId);
        if (task.assignedEmployeeId) participantIds.add(task.assignedEmployeeId);
        if (task.assignedToId) participantIds.add(task.assignedToId);

        // Do not notify the actor who made the change
        participantIds.delete(actor.id);

        if (participantIds.size === 0) return;

        await prisma.notification.createMany({
            data: Array.from(participantIds).map((userId) => ({
                userId,
                taskId,
                type,
                message: `[${task.title}] ${message}`
            }))
        });
    } catch (err) {
        console.error('Failed to notify task participants:', err);
    }
};

/**
 * Automatic event helper: Notifies employee on leave review or supervisor on leave submission.
 */
export const notifyLeaveParticipants = async (
    recipientId: string,
    type: string,
    message: string
) => {
    try {
        await prisma.notification.create({
            data: {
                userId: recipientId,
                type,
                message
            }
        });
    } catch (err) {
        console.error('Failed to notify leave participant:', err);
    }
};
