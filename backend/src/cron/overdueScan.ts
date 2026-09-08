import cron from 'node-cron';
import { prisma } from '../utils/prisma';
import { createNotification } from '../services/notification.service';
import { differenceInDays, isSameDay, subDays } from 'date-fns';

/**
 * Scans active tasks for upcoming deadlines, due today triggers, and overdue escalations.
 * Persists in-app notifications directly to PostgreSQL.
 */
export const runOverdueScan = async (): Promise<number> => {
    let notificationsSent = 0;
    try {
        const now = new Date();
        const activeTasks = await prisma.task.findMany({
            where: {
                status: { notIn: ['COMPLETED', 'CANCELLED'] },
                deletedAt: null
            },
            include: {
                team: {
                    select: {
                        id: true,
                        name: true,
                        teamLeadId: true,
                        department: { select: { managerId: true } }
                    }
                }
            }
        });

        for (const task of activeTasks) {
            if (!task.dueDate) continue;

            const targetUserId = task.assignedEmployeeId || task.assignedToId;

            // 1. 3 days before due date reminder
            if (isSameDay(now, subDays(task.dueDate, 3))) {
                if (targetUserId) {
                    await createNotification(
                        targetUserId,
                        'UPCOMING_DEADLINE',
                        `Reminder: Task "${task.title}" is due in 3 days.`,
                        task.id
                    );
                    notificationsSent++;
                }
            }

            // 2. Due today reminder
            if (isSameDay(now, task.dueDate)) {
                if (targetUserId) {
                    await createNotification(
                        targetUserId,
                        'DUE_TODAY',
                        `Priority Alert: Task "${task.title}" is due today.`,
                        task.id
                    );
                    notificationsSent++;
                }
            }

            // 3. Overdue escalations (Day 1 -> Team Lead, Day 3 -> Manager, Day 7 -> Admin)
            if (now > task.dueDate) {
                const daysOverdue = differenceInDays(now, task.dueDate);

                if (daysOverdue >= 1 && targetUserId) {
                    await createNotification(
                        targetUserId,
                        'TASK_STATUS_CHANGED',
                        `Task "${task.title}" is ${daysOverdue} day(s) overdue!`,
                        task.id
                    );
                    notificationsSent++;
                }

                if (daysOverdue === 1 && task.team?.teamLeadId) {
                    await createNotification(
                        task.team.teamLeadId,
                        'TASK_STATUS_CHANGED',
                        `Escalation: Task "${task.title}" is 1 day overdue in your team.`,
                        task.id
                    );
                    notificationsSent++;
                } else if (daysOverdue === 3) {
                    if (task.team?.teamLeadId) {
                        await createNotification(
                            task.team.teamLeadId,
                            'TASK_STATUS_CHANGED',
                            `Escalation: Task "${task.title}" is 3 days overdue.`,
                            task.id
                        );
                        notificationsSent++;
                    }
                    if (task.team?.department?.managerId) {
                        await createNotification(
                            task.team.department.managerId,
                            'TASK_STATUS_CHANGED',
                            `Escalation: Task "${task.title}" is 3 days overdue in your department.`,
                            task.id
                        );
                        notificationsSent++;
                    }
                } else if (daysOverdue >= 7) {
                    const admin = await prisma.user.findFirst({
                        where: { role: 'ADMIN', organizationId: task.organizationId, deletedAt: null }
                    });
                    if (admin) {
                        await createNotification(
                            admin.id,
                            'TASK_STATUS_CHANGED',
                            `Critical: Task "${task.title}" is ${daysOverdue} days overdue!`,
                            task.id
                        );
                        notificationsSent++;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error during overdue task scanning:', error);
    }
    return notificationsSent;
};

/**
 * Scans employees who have not checked in on working days by 10:00 AM.
 */
export const runAttendanceReminderScan = async (): Promise<number> => {
    let remindersSent = 0;
    try {
        const now = new Date();
        const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
        if (dayOfWeek === 0 || dayOfWeek === 6) return 0;

        const startOfDay = new Date(now);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(now);
        endOfDay.setHours(23, 59, 59, 999);

        // Find employees who do not have an attendance record today
        const employees = await prisma.user.findMany({
            where: {
                role: 'EMPLOYEE',
                deletedAt: null,
                attendances: {
                    none: {
                        date: { gte: startOfDay, lte: endOfDay }
                    }
                }
            },
            select: { id: true, name: true }
        });

        for (const emp of employees) {
            await createNotification(
                emp.id,
                'ATTENDANCE_REMINDER',
                `Friendly reminder: You have not checked in for today's shift yet. Please punch in your attendance.`
            );
            remindersSent++;
        }
    } catch (err) {
        console.error('Error during attendance reminder scan:', err);
    }
    return remindersSent;
};

export const initOverdueScanner = () => {
    // Hourly overdue scan
    cron.schedule('0 * * * *', async () => {
        console.log('Running Task Lifecycle & Escalation Scanner...');
        await runOverdueScan();
    });

    // Daily 10:00 AM attendance reminder
    cron.schedule('0 10 * * 1-5', async () => {
        console.log('Running Daily Shift Attendance Reminder Scanner...');
        await runAttendanceReminderScan();
    });
};
