import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';
import { isAuthorizedForTarget } from '../utils/hierarchy';

export const submitReview = async (reviewer: User, employeeId: string, data: any) => {

    const isAuthorized = await isAuthorizedForTarget(reviewer, employeeId);
    if (!isAuthorized) {
        throw new Error('Forbidden: You are not authorized to evaluate this employee.');
    }

    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);

    const tasks = await prisma.task.findMany({
        where: {
            assignedToId: employeeId,
            dueDate: { gte: periodStart, lte: periodEnd }
        }
    });

    let totalAssigned = tasks.length;
    let totalCompleted = 0;
    let totalOnTime = 0;

    tasks.forEach((t: any) => {
        if (t.status === 'COMPLETED') {
            totalCompleted++;
            if (t.completedAt && t.completedAt <= t.dueDate) {
                totalOnTime++;
            }
        }
    });

    const taskCompletionRate = totalAssigned > 0 ? (totalCompleted / totalAssigned) * 100 : 0;
    const onTimeRate = totalCompleted > 0 ? (totalOnTime / totalCompleted) * 100 : 0;

    const review = await prisma.performanceReview.create({
        data: {
            employeeId,
            reviewerId: reviewer.id,
            taskCompletionRate: parseFloat(taskCompletionRate.toFixed(2)),
            onTimeRate: parseFloat(onTimeRate.toFixed(2)),
            rating: data.rating,
            comments: data.comments,
            periodStart,
            periodEnd
        }
    });

    return review;
};
