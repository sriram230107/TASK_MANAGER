import { prisma } from '../utils/prisma';
import { User, GoalLevel, GoalStatus } from '@prisma/client';
import { isAuthorizedForTarget, isAuthorizedForTeam, isAuthorizedForDepartment } from '../utils/hierarchy';

export interface CreateGoalDTO {
    title: string;
    description?: string;
    level: GoalLevel;
    ownerId?: string | null;
    departmentId?: string | null;
    teamId?: string | null;
    target: string;
    deadline: string;
}

export interface UpdateGoalDTO {
    title?: string;
    description?: string;
    target?: string;
    deadline?: string;
    progress?: number;
    status?: GoalStatus;
    reviewNotes?: string;
}

export interface GoalQueryFilters {
    page?: number;
    limit?: number;
    level?: GoalLevel;
    status?: GoalStatus;
    ownerId?: string;
    departmentId?: string;
    teamId?: string;
}

export interface CreateReviewDTO {
    employeeId: string;
    rating: number;
    cadence?: string;
    comments?: string;
    periodStart: string;
    periodEnd: string;
}

/**
 * Validates whether reviewer is allowed to evaluate target employee.
 */
export const canEvaluateEmployee = async (reviewer: User, employeeId: string): Promise<boolean> => {
    if (reviewer.id === employeeId) return false; // Rule: Cannot evaluate self
    if (reviewer.role === 'EMPLOYEE') return false; // Only Leads, Managers, Admins can evaluate

    if (reviewer.role === 'ADMIN') {
        const emp = await prisma.user.findFirst({
            where: { id: employeeId, organizationId: reviewer.organizationId, deletedAt: null }
        });
        return !!emp;
    }

    return isAuthorizedForTarget(reviewer, employeeId);
};

/**
 * Computes live multi-dimensional performance metrics for Employee, Team, Department, or Org.
 */
export const getPerformanceMetrics = async (
    requestingUser: any,
    level: 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE',
    targetId?: string,
    periodStart?: string,
    periodEnd?: string
) => {
    const end = periodEnd ? new Date(periodEnd) : new Date();
    const start = periodStart ? new Date(periodStart) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    let userIds: string[] = [];

    if (level === 'EMPLOYEE') {
        const empId = targetId || requestingUser.id;
        if (empId !== requestingUser.id) {
            const isAuth = await isAuthorizedForTarget(requestingUser, empId);
            if (!isAuth) throw new Error('Forbidden: User outside your organizational scope');
        }
        userIds = [empId];
    } else if (level === 'TEAM') {
        if (!targetId) throw new Error('Team ID is required for team-level metrics');
        const isAuth = await isAuthorizedForTeam(requestingUser, targetId);
        if (!isAuth) throw new Error('Forbidden: Team outside your organizational scope');

        const members = await prisma.teamMember.findMany({
            where: { teamId: targetId },
            select: { userId: true }
        });
        userIds = members.map((m) => m.userId);
    } else if (level === 'DEPARTMENT') {
        if (!targetId) throw new Error('Department ID is required for department-level metrics');
        const isAuth = await isAuthorizedForDepartment(requestingUser, targetId);
        if (!isAuth) throw new Error('Forbidden: Department outside your organizational scope');

        const deptUsers = await prisma.user.findMany({
            where: { departmentId: targetId, deletedAt: null },
            select: { id: true }
        });
        userIds = deptUsers.map((u) => u.id);
    } else {
        // ORGANIZATION
        if (requestingUser.role !== 'ADMIN' && requestingUser.role !== 'MANAGER') {
            throw new Error('Forbidden: Requires Manager or Admin role to view org-wide metrics');
        }
        const orgUsers = await prisma.user.findMany({
            where: { organizationId: requestingUser.organizationId, deletedAt: null },
            select: { id: true }
        });
        userIds = orgUsers.map((u) => u.id);
    }

    // 1. Task Metrics
    const tasks = await prisma.task.findMany({
        where: {
            organizationId: requestingUser.organizationId,
            assignedToId: { in: userIds },
            deletedAt: null
        }
    });

    const totalTasks = tasks.length;
    const completedTasksList = tasks.filter((t) => t.status === 'COMPLETED');
    const completedTasks = completedTasksList.length;
    const inProgressTasks = tasks.filter((t) => t.status === 'IN_PROGRESS' || t.status === 'UNDER_REVIEW').length;
    const overdueTasks = tasks.filter(
        (t) => t.status === 'OVERDUE' || (t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'COMPLETED')
    ).length;

    const taskCompletionRate = totalTasks > 0 ? +((completedTasks / totalTasks) * 100).toFixed(1) : 0;

    let onTimeCount = 0;
    let totalCompletionHours = 0;
    completedTasksList.forEach((t) => {
        if (t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate)) {
            onTimeCount++;
        }
        if (t.actualHours) {
            totalCompletionHours += t.actualHours;
        }
    });

    const onTimeRate = completedTasks > 0 ? +((onTimeCount / completedTasks) * 100).toFixed(1) : 0;
    const avgCompletionHours = completedTasks > 0 ? +(totalCompletionHours / completedTasks).toFixed(1) : 0;

    // 2. Attendance Consistency
    const attendances = await prisma.attendance.findMany({
        where: {
            userId: { in: userIds },
            date: { gte: start, lte: end }
        }
    });

    const totalAttendances = attendances.length;
    const presentAttendances = attendances.filter(
        (a) => a.status === 'PRESENT' || a.status === 'WORK_FROM_HOME'
    ).length;
    const attendanceConsistency = totalAttendances > 0 ? +((presentAttendances / totalAttendances) * 100).toFixed(1) : 100;

    // 3. Goals Achieved Rate
    const goals = await prisma.goal.findMany({
        where: {
            organizationId: requestingUser.organizationId,
            ...(level === 'EMPLOYEE' ? { ownerId: { in: userIds } } : {}),
            ...(level === 'TEAM' ? { teamId: targetId } : {}),
            ...(level === 'DEPARTMENT' ? { departmentId: targetId } : {}),
            ...(level === 'ORGANIZATION' ? { level: 'ORGANIZATION' } : {})
        }
    });

    const totalGoals = goals.length;
    const achievedGoals = goals.filter((g) => g.status === 'ACHIEVED').length;
    const inProgressGoals = goals.filter((g) => g.status === 'IN_PROGRESS').length;
    const goalsAchievedRate = totalGoals > 0 ? +((achievedGoals / totalGoals) * 100).toFixed(1) : 0;

    // 4. Performance Reviews Average Rating
    const reviews = await prisma.performanceReview.findMany({
        where: {
            employeeId: { in: userIds }
        }
    });

    const averageRating =
        reviews.length > 0
            ? +(reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
            : 0;

    return {
        level,
        targetId: targetId || requestingUser.id,
        period: { start, end },
        taskCompletionRate,
        onTimeRate,
        goalsAchievedRate,
        attendanceConsistency,
        tasks: {
            total: totalTasks,
            completed: completedTasks,
            inProgress: inProgressTasks,
            overdue: overdueTasks,
            completionRate: taskCompletionRate,
            onTimeRate,
            avgCompletionHours
        },
        attendance: {
            recordsCount: totalAttendances,
            presentCount: presentAttendances,
            consistencyRate: attendanceConsistency
        },
        goals: {
            total: totalGoals,
            achieved: achievedGoals,
            inProgress: inProgressGoals,
            achievedRate: goalsAchievedRate
        },
        reviews: {
            totalReviews: reviews.length,
            averageRating
        }
    };
};

/**
 * Creates a cascading goal (Organization -> Department -> Team -> Employee).
 */
export const createGoal = async (requestingUser: any, data: CreateGoalDTO) => {
    // 1. Authorization checks per cascade level
    if (data.level === 'ORGANIZATION' && requestingUser.role !== 'ADMIN') {
        throw new Error('Forbidden: Only administrators can create organization-level goals');
    }

    if (data.level === 'DEPARTMENT') {
        if (!data.departmentId && requestingUser.departmentId) {
            data.departmentId = requestingUser.departmentId;
        }
        if (!data.departmentId) throw new Error('departmentId is required for department-level goals');
        const isAuth = await isAuthorizedForDepartment(requestingUser, data.departmentId);
        if (!isAuth) throw new Error('Forbidden: Department is outside your organizational scope');
    }

    if (data.level === 'TEAM') {
        if (!data.teamId) {
            const team = await prisma.team.findFirst({
                where: {
                    organizationId: requestingUser.organizationId,
                    OR: [
                        { teamLeadId: requestingUser.id },
                        { members: { some: { userId: requestingUser.id } } }
                    ]
                }
            });
            if (team) {
                data.teamId = team.id;
            }
        }
        if (!data.teamId) throw new Error('teamId is required for team-level goals');
        const isAuth = await isAuthorizedForTeam(requestingUser, data.teamId);
        if (!isAuth) throw new Error('Forbidden: Team is outside your organizational scope');
    }

    if (data.level === 'EMPLOYEE') {
        const ownerId = data.ownerId || requestingUser.id;
        if (ownerId !== requestingUser.id) {
            const isAuth = await isAuthorizedForTarget(requestingUser, ownerId);
            if (!isAuth) throw new Error('Forbidden: Employee is outside your organizational scope');
        }
        data.ownerId = ownerId;
    }

    const goal = await prisma.goal.create({
        data: {
            title: data.title,
            description: data.description || null,
            level: data.level,
            ownerId: data.ownerId || null,
            departmentId: data.departmentId || null,
            teamId: data.teamId || null,
            organizationId: requestingUser.organizationId,
            target: data.target,
            deadline: new Date(data.deadline),
            status: 'IN_PROGRESS'
        },
        include: {
            owner: { select: { id: true, name: true, email: true, role: true } },
            department: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } }
        }
    });

    return goal;
};

/**
 * Updates a goal's progress, status, or details.
 */
export const updateGoal = async (requestingUser: any, goalId: string, data: UpdateGoalDTO) => {
    const goal = await prisma.goal.findUnique({
        where: { id: goalId }
    });

    if (!goal) throw new Error('Goal not found');
    if (goal.organizationId !== requestingUser.organizationId) {
        throw new Error('Forbidden: Goal belongs to another organization');
    }

    const isOwner = goal.ownerId === requestingUser.id;
    const isAdmin = requestingUser.role === 'ADMIN';
    const isLeadOrManager = requestingUser.role === 'MANAGER' || requestingUser.role === 'TEAM_LEAD';

    // Employee owner can update progress and status; managers/admins can update full details
    if (!isOwner && !isAdmin && !isLeadOrManager) {
        throw new Error('Forbidden: You are not authorized to update this goal');
    }

    const updateData: any = {};
    if (data.progress !== undefined) {
        updateData.progress = data.progress;
        if (data.progress >= 100) {
            updateData.status = 'ACHIEVED';
        }
    }
    if (data.status) updateData.status = data.status;
    if (data.reviewNotes) updateData.reviewNotes = data.reviewNotes;

    // Full detail updates for supervisors/admins
    if (isAdmin || isLeadOrManager) {
        if (data.title) updateData.title = data.title;
        if (data.description !== undefined) updateData.description = data.description;
        if (data.target) updateData.target = data.target;
        if (data.deadline) updateData.deadline = new Date(data.deadline);
    }

    const updated = await prisma.goal.update({
        where: { id: goalId },
        data: updateData,
        include: {
            owner: { select: { id: true, name: true, email: true, role: true } },
            department: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } }
        }
    });

    return updated;
};

/**
 * Lists goals with role-scoping and cascade level filters.
 */
export const listGoals = async (requestingUser: any, filters: GoalQueryFilters) => {
    const where: any = {
        organizationId: requestingUser.organizationId
    };

    if (requestingUser.role === 'EMPLOYEE') {
        where.OR = [
            { ownerId: requestingUser.id },
            { level: 'ORGANIZATION' },
            ...(requestingUser.departmentId ? [{ departmentId: requestingUser.departmentId }] : [])
        ];
    } else if (requestingUser.role === 'TEAM_LEAD') {
        where.OR = [
            { ownerId: requestingUser.id },
            { level: 'ORGANIZATION' },
            { team: { teamLeadId: requestingUser.id } },
            ...(requestingUser.departmentId ? [{ departmentId: requestingUser.departmentId }] : [])
        ];
    } else if (requestingUser.role === 'MANAGER') {
        where.OR = [
            { ownerId: requestingUser.id },
            { level: 'ORGANIZATION' },
            { department: { managerId: requestingUser.id } },
            ...(requestingUser.departmentId ? [{ departmentId: requestingUser.departmentId }] : [])
        ];
    }

    if (filters.level) where.level = filters.level;
    if (filters.status) where.status = filters.status;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.teamId) where.teamId = filters.teamId;

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const [goals, total] = await Promise.all([
        prisma.goal.findMany({
            where,
            skip,
            take: limit,
            orderBy: { deadline: 'asc' },
            include: {
                owner: { select: { id: true, name: true, email: true, role: true } },
                department: { select: { id: true, name: true } },
                team: { select: { id: true, name: true } }
            }
        }),
        prisma.goal.count({ where })
    ]);

    return {
        goals,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Deletes a goal (Manager/Admin only).
 */
export const deleteGoal = async (requestingUser: any, goalId: string) => {
    if (requestingUser.role !== 'ADMIN' && requestingUser.role !== 'MANAGER') {
        throw new Error('Forbidden: Only managers and administrators can delete goals');
    }

    const goal = await prisma.goal.findUnique({ where: { id: goalId } });
    if (!goal) throw new Error('Goal not found');

    await prisma.goal.delete({ where: { id: goalId } });
    return { success: true, message: 'Goal deleted successfully' };
};

/**
 * Submits a performance review with auto-calculated rates from live DB records.
 */
export const submitReview = async (reviewer: User, data: CreateReviewDTO) => {
    const isAuth = await canEvaluateEmployee(reviewer, data.employeeId);
    if (!isAuth) {
        throw new Error('Forbidden: You are not authorized to evaluate this employee');
    }

    const periodStart = new Date(data.periodStart);
    const periodEnd = new Date(data.periodEnd);
    if (periodEnd < periodStart) {
        throw new Error('Period end date must be after period start date');
    }

    // Pull automated metrics for the review period
    const metrics = await getPerformanceMetrics(
        reviewer,
        'EMPLOYEE',
        data.employeeId,
        data.periodStart,
        data.periodEnd
    );

    const review = await prisma.performanceReview.create({
        data: {
            employeeId: data.employeeId,
            reviewerId: reviewer.id,
            rating: data.rating,
            cadence: data.cadence || 'QUARTERLY',
            comments: data.comments || null,
            periodStart,
            periodEnd,
            taskCompletionRate: metrics.tasks.completionRate,
            onTimeRate: metrics.tasks.onTimeRate,
            goalsAchievedRate: metrics.goals.achievedRate,
            attendanceConsistency: metrics.attendance.consistencyRate
        },
        include: {
            employee: { select: { id: true, name: true, email: true, role: true } },
            reviewer: { select: { id: true, name: true, email: true, role: true } }
        }
    });

    return review;
};

/**
 * Lists performance reviews within organizational scope.
 */
export const listReviews = async (requestingUser: any, employeeId?: string) => {
    let targetEmployeeId = employeeId;

    if (requestingUser.role === 'EMPLOYEE') {
        targetEmployeeId = requestingUser.id;
    } else if (employeeId && employeeId !== requestingUser.id) {
        const isAuth = await isAuthorizedForTarget(requestingUser, employeeId);
        if (!isAuth) throw new Error('Forbidden: User is outside your organizational scope');
    }

    const reviews = await prisma.performanceReview.findMany({
        where: {
            ...(targetEmployeeId ? { employeeId: targetEmployeeId } : {}),
            employee: { organizationId: requestingUser.organizationId }
        },
        orderBy: { createdAt: 'desc' },
        include: {
            employee: { select: { id: true, name: true, email: true, role: true } },
            reviewer: { select: { id: true, name: true, email: true, role: true } }
        }
    });

    return reviews;
};