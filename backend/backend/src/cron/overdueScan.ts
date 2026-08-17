// @ts-nocheck
import cron from 'node-cron';
import { prisma } from '../utils/prisma';
import { sendNotification } from '../services/notification.service';
import { differenceInDays, isSameDay, subDays } from 'date-fns';

export const initOverdueScanner = () => {
    // Escalate hourly checking.
    cron.schedule('0 * * * *', async () => {
        console.log('Running Lifecycle & Escalation Task Scanner...');

        try {
            const now = new Date();
            const activeTasks = await prisma.task.findMany({
                where: {
                    status: { notIn: ['COMPLETED', 'CANCELLED'] },
                    deletedAt: null
                },
                include: {
                    team: { include: { teamLead: { include: { manager: true } } } }
                }
            });

            for (const task of activeTasks) {
                if (!task.dueDate) continue;

                // 3 days before due date trigger
                if (isSameDay(now, subDays(task.dueDate, 3))) {
                    console.log(`Reminder: Task ${task.title} is due in 3 days.`);
                    await sendNotification(task.assignedToId, 'UPCOMING_DEADLINE', task.id, `Task "${task.title}" is due in 3 days.`);
                }

                // Due today trigger
                if (isSameDay(now, task.dueDate)) {
                    console.log(`Trigger: Task ${task.title} is due today.`);
                    await sendNotification(task.assignedToId, 'DUE_TODAY', task.id, `Task "${task.title}" is due today.`);
                }

                // Overdue triggers
                if (now > task.dueDate) {
                    const daysOverdue = differenceInDays(now, task.dueDate);

                    if (daysOverdue === 1) {
                        // Day 1: Employee and Team Lead
                        await sendNotification(task.assignedToId, 'OVERDUE_DAY_1', task.id);
                        await sendNotification(task.team.teamLeadId, 'OVERDUE_ESCALATION_TL', task.id, `Escalation: Task "${task.title}" is 1 day overdue.`);
                    }
                    else if (daysOverdue === 3) {
                        // Day 3: + Manager 
                        await sendNotification(task.assignedToId, 'OVERDUE_DAY_3', task.id);
                        await sendNotification(task.team.teamLeadId, 'OVERDUE_ESCALATION_TL', task.id);
                        if (task.team.teamLead.managerId) {
                            await sendNotification(task.team.teamLead.managerId, 'OVERDUE_ESCALATION_MGR', task.id, `Escalation: Task "${task.title}" is 3 days overdue in your region.`);
                        }
                    }
                    else if (daysOverdue === 7) {
                        // Day 7: + Admin (Finding an admin for test purposes)
                        const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
                        if (admin) {
                            await sendNotification(admin.id, 'CRITICAL_OVERDUE_ADMIN', task.id, `Critical: Task "${task.title}" is 7 days overdue!`);
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Error during escalation scanning:', error);
        }
    });
};
