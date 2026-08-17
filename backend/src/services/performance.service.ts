import { prisma } from '../utils/prisma';
import { User } from '@prisma/client';

const canEvaluateEmployee = async (
    reviewer: User,
    employeeId: string
): Promise<boolean> => {
    if (reviewer.role === 'ADMIN') {
        const employee = await prisma.user.findUnique({
            where: {
                id: employeeId,
                deletedAt: null
            },
            select: {
                organizationId: true
            }
        });

        return !!employee &&
            employee.organizationId === reviewer.organizationId;
    }

    if (
        reviewer.role !== 'MANAGER' &&
        reviewer.role !== 'TEAM_LEAD'
    ) {
        return false;
    }

    const employee = await prisma.user.findUnique({
        where: {
            id: employeeId,
            deletedAt: null
        },
        select: {
            id: true,
            role: true,
            organizationId: true,
            managerId: true
        }
    });

    if (!employee) {
        return false;
    }

    if (employee.organizationId !== reviewer.organizationId) {
        return false;
    }

    if (employee.role !== 'EMPLOYEE') {
        return false;
    }

    if (reviewer.role === 'MANAGER') {
        const teamLead = await prisma.user.findUnique({
            where: {
                id: employee.managerId || ''
            },
            select: {
                managerId: true,
                role: true,
                organizationId: true
            }
        });

        return !!teamLead &&
            teamLead.role === 'TEAM_LEAD' &&
            teamLead.organizationId === reviewer.organizationId &&
            teamLead.managerId === reviewer.id;
    }

    if (reviewer.role === 'TEAM_LEAD') {
        const membership = await prisma.teamMember.findFirst({
            where: {
                userId: employeeId,
                team: {
                    organizationId: reviewer.organizationId,
                    teamLeadId: reviewer.id
                }
            }
        });

        return !!membership;
    }

    return false;
};

export const submitReview = async (
    reviewer: User,
    employeeId: string,
    data: any
) => {
    const authorized = await canEvaluateEmployee(
        reviewer,
        employeeId
    );

    if (!authorized) {
        throw new Error(
            'Forbidden: You are not authorized to evaluate this employee'
        );
    }

    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);

    if (periodEnd < periodStart) {
        throw new Error(
            'Period end date must be after period start date'
        );
    }

    const tasks = await prisma.task.findMany({
        where: {
            organizationId: reviewer.organizationId,
            assignedToId: employeeId,
            dueDate: {
                gte: periodStart,
                lte: periodEnd
            },
            deletedAt: null
        }
    });

    let totalAssigned = tasks.length;
    let totalCompleted = 0;
    let totalOnTime = 0;

    tasks.forEach(task => {
        if (task.status === 'COMPLETED') {
            totalCompleted++;

            if (
                task.completedAt &&
                task.dueDate &&
                task.completedAt <= task.dueDate
            ) {
                totalOnTime++;
            }
        }
    });

    const taskCompletionRate =
        totalAssigned > 0
            ? (totalCompleted / totalAssigned) * 100
            : 0;

    const onTimeRate =
        totalCompleted > 0
            ? (totalOnTime / totalCompleted) * 100
            : 0;

    const review = await prisma.performanceReview.create({
        data: {
            employeeId,
            reviewerId: reviewer.id,
            taskCompletionRate: parseFloat(
                taskCompletionRate.toFixed(2)
            ),
            onTimeRate: parseFloat(
                onTimeRate.toFixed(2)
            ),
            rating: data.rating,
            comments: data.comments,
            periodStart,
            periodEnd
        }
    });

    return review;
};