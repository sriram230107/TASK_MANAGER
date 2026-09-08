import { prisma } from '../utils/prisma';
import { User, TaskStatus, TaskPriority, AttendanceStatus } from '@prisma/client';
import { isAuthorizedForTarget, isAuthorizedForTeam, isAuthorizedForDepartment } from '../utils/hierarchy';
import { Parser } from 'json2csv';

export interface ReportFilterOptions {
    type?: 'overview' | 'tasks' | 'attendance' | 'performance' | 'workload';
    scope?: 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE';
    scopeId?: string;
    startDate?: string;
    endDate?: string;
    format?: 'json' | 'csv' | 'pdf';
}

/**
 * Resolves the authorized set of user IDs based on the requesting user's role and hierarchy scope.
 * Prevents unauthorized cross-tenant or out-of-scope report access per Rule 6 & Rule 15.
 */
export const resolveScopedUserIds = async (
    requestingUser: User,
    requestedScope?: 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE',
    scopeId?: string
): Promise<{ userIds: string[]; resolvedScope: string; scopeLabel: string }> => {
    // 1. EMPLOYEE: Strictly limited to own user ID
    if (requestingUser.role === 'EMPLOYEE') {
        if (requestedScope && requestedScope !== 'EMPLOYEE') {
            throw new Error('Forbidden: Employees can only access personal reports');
        }
        if (scopeId && scopeId !== requestingUser.id) {
            throw new Error('Forbidden: Employees cannot query other users reports');
        }
        return {
            userIds: [requestingUser.id],
            resolvedScope: 'EMPLOYEE',
            scopeLabel: `${requestingUser.name} (Self)`
        };
    }

    // 2. TEAM_LEAD: Limited to team members of their team or individual subordinate
    if (requestingUser.role === 'TEAM_LEAD') {
        if (requestedScope === 'ORGANIZATION' || requestedScope === 'DEPARTMENT') {
            throw new Error('Forbidden: Team Leads cannot access organization or department-wide reports');
        }

        if (requestedScope === 'EMPLOYEE' && scopeId) {
            const isAuth = await isAuthorizedForTarget(requestingUser, scopeId);
            if (!isAuth) throw new Error('Forbidden: Target employee is outside your team scope');
            const emp = await prisma.user.findUnique({ where: { id: scopeId }, select: { name: true } });
            return {
                userIds: [scopeId],
                resolvedScope: 'EMPLOYEE',
                scopeLabel: emp?.name || 'Employee'
            };
        }

        // Team scope
        const targetTeamId = scopeId || (await prisma.team.findFirst({
            where: { teamLeadId: requestingUser.id, organizationId: requestingUser.organizationId }
        }))?.id;

        if (!targetTeamId) {
            return { userIds: [requestingUser.id], resolvedScope: 'TEAM', scopeLabel: 'My Team (No team assigned)' };
        }

        const isAuth = await isAuthorizedForTeam(requestingUser, targetTeamId);
        if (!isAuth) throw new Error('Forbidden: Team is outside your authorized scope');

        const team = await prisma.team.findUnique({
            where: { id: targetTeamId },
            include: { members: { select: { userId: true } } }
        });

        const memberIds = team ? team.members.map((m) => m.userId) : [];
        if (!memberIds.includes(requestingUser.id)) memberIds.push(requestingUser.id);

        return {
            userIds: memberIds,
            resolvedScope: 'TEAM',
            scopeLabel: team?.name || 'My Team'
        };
    }

    // 3. MANAGER: Limited to their department, subordinate teams, or department members
    if (requestingUser.role === 'MANAGER') {
        if (requestedScope === 'ORGANIZATION') {
            // Managers can view org-wide overview if permitted, but let's check department default
            const orgUsers = await prisma.user.findMany({
                where: { organizationId: requestingUser.organizationId, deletedAt: null },
                select: { id: true }
            });
            return {
                userIds: orgUsers.map((u) => u.id),
                resolvedScope: 'ORGANIZATION',
                scopeLabel: 'Organization Overview'
            };
        }

        if (requestedScope === 'EMPLOYEE' && scopeId) {
            const isAuth = await isAuthorizedForTarget(requestingUser, scopeId);
            if (!isAuth) throw new Error('Forbidden: Target employee is outside your department scope');
            const emp = await prisma.user.findUnique({ where: { id: scopeId }, select: { name: true } });
            return {
                userIds: [scopeId],
                resolvedScope: 'EMPLOYEE',
                scopeLabel: emp?.name || 'Employee'
            };
        }

        if (requestedScope === 'TEAM' && scopeId) {
            const isAuth = await isAuthorizedForTeam(requestingUser, scopeId);
            if (!isAuth) throw new Error('Forbidden: Team is outside your department scope');
            const team = await prisma.team.findUnique({
                where: { id: scopeId },
                include: { members: { select: { userId: true } } }
            });
            return {
                userIds: team ? team.members.map((m) => m.userId) : [],
                resolvedScope: 'TEAM',
                scopeLabel: team?.name || 'Team'
            };
        }

        // Default: Manager's Department
        const targetDeptId = scopeId || requestingUser.departmentId || (await prisma.department.findFirst({
            where: { managerId: requestingUser.id, organizationId: requestingUser.organizationId }
        }))?.id;

        if (targetDeptId) {
            const isAuth = await isAuthorizedForDepartment(requestingUser, targetDeptId);
            if (!isAuth) throw new Error('Forbidden: Department is outside your management scope');

            const dept = await prisma.department.findUnique({
                where: { id: targetDeptId },
                include: { users: { where: { deletedAt: null }, select: { id: true } } }
            });

            return {
                userIds: dept ? dept.users.map((u) => u.id) : [requestingUser.id],
                resolvedScope: 'DEPARTMENT',
                scopeLabel: dept?.name || 'My Department'
            };
        }

        // Fallback: direct reports
        const reports = await prisma.user.findMany({
            where: { managerId: requestingUser.id, deletedAt: null },
            select: { id: true }
        });
        const ids = reports.map((r) => r.id);
        if (!ids.includes(requestingUser.id)) ids.push(requestingUser.id);
        return { userIds: ids, resolvedScope: 'DEPARTMENT', scopeLabel: 'Direct Management Scope' };
    }

    // 4. ADMIN: Full organization access or targeted filters
    if (requestedScope === 'EMPLOYEE' && scopeId) {
        const emp = await prisma.user.findFirst({
            where: { id: scopeId, organizationId: requestingUser.organizationId, deletedAt: null }
        });
        if (!emp) throw new Error('Target employee not found in organization');
        return { userIds: [scopeId], resolvedScope: 'EMPLOYEE', scopeLabel: emp.name };
    }

    if (requestedScope === 'TEAM' && scopeId) {
        const team = await prisma.team.findFirst({
            where: { id: scopeId, organizationId: requestingUser.organizationId },
            include: { members: { select: { userId: true } } }
        });
        if (!team) throw new Error('Target team not found in organization');
        return {
            userIds: team.members.map((m) => m.userId),
            resolvedScope: 'TEAM',
            scopeLabel: team.name
        };
    }

    if (requestedScope === 'DEPARTMENT' && scopeId) {
        const dept = await prisma.department.findFirst({
            where: { id: scopeId, organizationId: requestingUser.organizationId },
            include: { users: { where: { deletedAt: null }, select: { id: true } } }
        });
        if (!dept) throw new Error('Target department not found in organization');
        return {
            userIds: dept.users.map((u) => u.id),
            resolvedScope: 'DEPARTMENT',
            scopeLabel: dept.name
        };
    }

    // Default ADMIN scope: Entire Organization
    const allUsers = await prisma.user.findMany({
        where: { organizationId: requestingUser.organizationId, deletedAt: null },
        select: { id: true }
    });

    return {
        userIds: allUsers.map((u) => u.id),
        resolvedScope: 'ORGANIZATION',
        scopeLabel: 'Organization-Wide'
    };
};

/**
 * 1. Task Analytics Report
 */
export const getTaskReport = async (
    user: User,
    userIds: string[],
    scopeLabel: string,
    start?: Date,
    end?: Date
) => {
    const where: any = {
        organizationId: user.organizationId,
        assignedToId: { in: userIds },
        deletedAt: null
    };

    if (start && end) {
        where.createdAt = { gte: start, lte: end };
    }

    const tasks = await prisma.task.findMany({
        where,
        include: {
            assignedTo: { select: { id: true, name: true, email: true } },
            team: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } }
        },
        orderBy: { createdAt: 'desc' }
    });

    const totalTasks = tasks.length;
    const now = new Date();

    // Status breakdown across all 11 lifecycle statuses
    const statusCounts: Record<string, number> = {
        DRAFT: 0,
        ASSIGNED: 0,
        ACCEPTED: 0,
        IN_PROGRESS: 0,
        ON_HOLD: 0,
        SUBMITTED: 0,
        UNDER_REVIEW: 0,
        COMPLETED: 0,
        CHANGES_REQUESTED: 0,
        CANCELLED: 0,
        OVERDUE: 0
    };

    // Priority breakdown
    const priorityCounts: Record<string, number> = {
        LOW: 0,
        MEDIUM: 0,
        HIGH: 0,
        URGENT: 0
    };

    let completedCount = 0;
    let overdueCount = 0;
    let onTimeCount = 0;
    let totalEstimatedHours = 0;
    let totalActualHours = 0;

    const assigneeMap: Record<string, { name: string; total: number; completed: number }> = {};

    tasks.forEach((t) => {
        // Status counts
        if (statusCounts[t.status] !== undefined) {
            statusCounts[t.status]++;
        }

        // Priority counts
        if (priorityCounts[t.priority] !== undefined) {
            priorityCounts[t.priority]++;
        }

        // Overdue check
        const isOverdue = t.status === 'OVERDUE' || (t.dueDate && new Date(t.dueDate) < now && t.status !== 'COMPLETED');
        if (isOverdue) overdueCount++;

        // Completed & on-time check
        if (t.status === 'COMPLETED') {
            completedCount++;
            if (t.completedAt && t.dueDate && new Date(t.completedAt) <= new Date(t.dueDate)) {
                onTimeCount++;
            }
        }

        if (t.estimatedHours) totalEstimatedHours += t.estimatedHours;
        if (t.actualHours) totalActualHours += t.actualHours;

        // Assignee metrics
        const assigneeName = t.assignedTo?.name || 'Unassigned';
        if (!assigneeMap[assigneeName]) {
            assigneeMap[assigneeName] = { name: assigneeName, total: 0, completed: 0 };
        }
        assigneeMap[assigneeName].total++;
        if (t.status === 'COMPLETED') assigneeMap[assigneeName].completed++;
    });

    const completionRate = totalTasks > 0 ? +((completedCount / totalTasks) * 100).toFixed(1) : 0;
    const onTimeRate = completedCount > 0 ? +((onTimeCount / completedCount) * 100).toFixed(1) : 0;
    const avgCompletionHours = completedCount > 0 ? +(totalActualHours / completedCount).toFixed(1) : 0;

    const rawData = tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignedTo?.name || 'Unassigned',
        team: t.team?.name || 'No Team',
        department: t.department?.name || 'No Department',
        estimatedHours: t.estimatedHours ?? 0,
        actualHours: t.actualHours ?? 0,
        dueDate: t.dueDate ? t.dueDate.toISOString().split('T')[0] : 'N/A',
        completedAt: t.completedAt ? t.completedAt.toISOString().split('T')[0] : 'N/A'
    }));

    return {
        summary: {
            scopeLabel,
            totalTasks,
            completedCount,
            inProgressCount: tasks.filter((t) => ['IN_PROGRESS', 'ACCEPTED', 'SUBMITTED', 'UNDER_REVIEW'].includes(t.status)).length,
            overdueCount,
            completionRate,
            onTimeRate,
            totalEstimatedHours: +totalEstimatedHours.toFixed(1),
            totalActualHours: +totalActualHours.toFixed(1),
            avgCompletionHours
        },
        statusBreakdown: statusCounts,
        priorityBreakdown: priorityCounts,
        topAssignees: Object.values(assigneeMap).sort((a, b) => b.completed - a.completed).slice(0, 10),
        rawData
    };
};

/**
 * 2. Attendance Analytics Report
 */
export const getAttendanceReport = async (
    user: User,
    userIds: string[],
    scopeLabel: string,
    start: Date,
    end: Date
) => {
    const attendances = await prisma.attendance.findMany({
        where: {
            userId: { in: userIds },
            date: { gte: start, lte: end }
        },
        include: {
            user: { select: { id: true, name: true, email: true, department: { select: { name: true } } } }
        },
        orderBy: { date: 'desc' }
    });

    const totalRecords = attendances.length;

    let presentCount = 0;
    let wfhCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let leaveCount = 0;
    let absentCount = 0;
    let earlyDepartureCount = 0;

    let totalWorkingMinutes = 0;
    let totalOvertimeMinutes = 0;
    let totalBreakMinutes = 0;

    const userAttendanceMap: Record<string, { name: string; present: number; total: number; hours: number; overtimeHours: number }> = {};

    attendances.forEach((a) => {
        if (a.status === 'PRESENT') presentCount++;
        else if (a.status === 'WORK_FROM_HOME') wfhCount++;
        else if (a.status === 'LATE') { lateCount++; presentCount++; }
        else if (a.status === 'HALF_DAY') halfDayCount++;
        else if (a.status === 'LEAVE') leaveCount++;
        else if (a.status === 'ABSENT') absentCount++;

        if (a.lateArrival && a.status !== 'LATE') lateCount++;
        if (a.earlyDeparture) earlyDepartureCount++;

        totalWorkingMinutes += a.totalWorkingMinutes || 0;
        totalOvertimeMinutes += a.overtimeMinutes || 0;
        totalBreakMinutes += a.breakDurationMinutes || 0;

        const userName = a.user?.name || 'Unknown';
        if (!userAttendanceMap[userName]) {
            userAttendanceMap[userName] = { name: userName, present: 0, total: 0, hours: 0, overtimeHours: 0 };
        }
        userAttendanceMap[userName].total++;
        if (['PRESENT', 'WORK_FROM_HOME', 'LATE'].includes(a.status)) {
            userAttendanceMap[userName].present++;
        }
        userAttendanceMap[userName].hours += (a.totalWorkingMinutes || 0) / 60;
        userAttendanceMap[userName].overtimeHours += (a.overtimeMinutes || 0) / 60;
    });

    const totalPresentDays = presentCount + wfhCount;
    const attendanceConsistencyRate = totalRecords > 0 ? +((totalPresentDays / totalRecords) * 100).toFixed(1) : 100;
    const totalWorkingHours = +(totalWorkingMinutes / 60).toFixed(1);
    const totalOvertimeHours = +(totalOvertimeMinutes / 60).toFixed(1);
    const totalBreakHours = +(totalBreakMinutes / 60).toFixed(1);

    const rawData = attendances.map((a) => ({
        id: a.id,
        date: a.date.toISOString().split('T')[0],
        employee: a.user?.name || 'Unknown',
        department: a.user?.department?.name || 'General',
        status: a.status,
        checkIn: a.checkIn ? a.checkIn.toLocaleTimeString() : 'N/A',
        checkOut: a.checkOut ? a.checkOut.toLocaleTimeString() : 'N/A',
        workingHours: +((a.totalWorkingMinutes || 0) / 60).toFixed(2),
        overtimeHours: +((a.overtimeMinutes || 0) / 60).toFixed(2),
        isLate: a.lateArrival ? 'YES' : 'NO'
    }));

    return {
        summary: {
            scopeLabel,
            totalRecords,
            presentDays: presentCount,
            wfhDays: wfhCount,
            lateArrivals: lateCount,
            halfDays: halfDayCount,
            leaveDays: leaveCount,
            absentDays: absentCount,
            earlyDepartures: earlyDepartureCount,
            attendanceConsistencyRate,
            totalWorkingHours,
            totalOvertimeHours,
            totalBreakHours
        },
        employeeBreakdown: Object.values(userAttendanceMap).map((u) => ({
            name: u.name,
            attendanceRate: u.total > 0 ? +((u.present / u.total) * 100).toFixed(1) : 0,
            workingHours: +u.hours.toFixed(1),
            overtimeHours: +u.overtimeHours.toFixed(1)
        })),
        rawData
    };
};

/**
 * 3. Performance Analytics Report
 */
export const getPerformanceReport = async (
    user: User,
    userIds: string[],
    scopeLabel: string,
    start: Date,
    end: Date
) => {
    const [reviews, goals] = await Promise.all([
        prisma.performanceReview.findMany({
            where: {
                employeeId: { in: userIds },
                createdAt: { gte: start, lte: end }
            },
            include: {
                employee: { select: { id: true, name: true, email: true } },
                reviewer: { select: { id: true, name: true, email: true } }
            },
            orderBy: { createdAt: 'desc' }
        }),
        prisma.goal.findMany({
            where: {
                organizationId: user.organizationId,
                ownerId: { in: userIds }
            },
            include: {
                owner: { select: { id: true, name: true } }
            }
        })
    ]);

    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0 ? +(reviews.reduce((s, r) => s + r.rating, 0) / totalReviews).toFixed(1) : 0;

    const ratingDistribution: Record<string, number> = {
        '5_Stars': 0,
        '4_Stars': 0,
        '3_Stars': 0,
        '2_Stars': 0,
        '1_Star': 0
    };

    reviews.forEach((r) => {
        if (r.rating >= 5) ratingDistribution['5_Stars']++;
        else if (r.rating === 4) ratingDistribution['4_Stars']++;
        else if (r.rating === 3) ratingDistribution['3_Stars']++;
        else if (r.rating === 2) ratingDistribution['2_Stars']++;
        else ratingDistribution['1_Star']++;
    });

    const totalGoals = goals.length;
    const achievedGoals = goals.filter((g) => g.status === 'ACHIEVED').length;
    const inProgressGoals = goals.filter((g) => g.status === 'IN_PROGRESS').length;
    const goalsAchievedRate = totalGoals > 0 ? +((achievedGoals / totalGoals) * 100).toFixed(1) : 0;

    const rawData = reviews.map((r) => ({
        id: r.id,
        employee: r.employee?.name || 'Unknown',
        reviewer: r.reviewer?.name || 'Unknown',
        rating: r.rating,
        cadence: r.cadence,
        taskCompletionRate: r.taskCompletionRate ?? 'N/A',
        onTimeRate: r.onTimeRate ?? 'N/A',
        attendanceConsistency: r.attendanceConsistency ?? 'N/A',
        date: r.createdAt.toISOString().split('T')[0]
    }));

    return {
        summary: {
            scopeLabel,
            totalReviews,
            averageRating,
            totalGoals,
            achievedGoals,
            inProgressGoals,
            goalsAchievedRate
        },
        ratingDistribution,
        rawData
    };
};

/**
 * 4. Workload Analytics Report
 */
export const getWorkloadReport = async (
    user: User,
    userIds: string[],
    scopeLabel: string
) => {
    const users = await prisma.user.findMany({
        where: { id: { in: userIds }, deletedAt: null },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            department: { select: { name: true } },
            assignedTasks: {
                where: {
                    deletedAt: null,
                    status: { in: ['ASSIGNED', 'ACCEPTED', 'IN_PROGRESS', 'UNDER_REVIEW', 'CHANGES_REQUESTED'] }
                },
                select: { id: true, priority: true, status: true, estimatedHours: true, actualHours: true, dueDate: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    const userOrg = await prisma.organization.findUnique({
        where: { id: user.organizationId },
        select: { workingHoursPerDay: true, workDaysPerWeek: true }
    });
    const weeklyCapacityHours = (userOrg?.workingHoursPerDay || 8) * (userOrg?.workDaysPerWeek || 5);

    let overloadedCount = 0;
    let balancedCount = 0;
    let underutilizedCount = 0;
    let totalActiveTasks = 0;

    const workloadList = users.map((u) => {
        const activeCount = u.assignedTasks.length;
        totalActiveTasks += activeCount;

        const urgentCount = u.assignedTasks.filter((t) => t.priority === 'URGENT' || t.priority === 'HIGH').length;
        const estHours = u.assignedTasks.reduce((s, t) => s + (t.estimatedHours || 0), 0);
        const loggedHours = u.assignedTasks.reduce((s, t) => s + (t.actualHours || 0), 0);

        // Workload status determination per dynamic organization capacity threshold
        let status: 'OVERLOADED' | 'BALANCED' | 'UNDERUTILIZED' = 'BALANCED';
        if (activeCount >= 6 || estHours >= weeklyCapacityHours) {
            status = 'OVERLOADED';
            overloadedCount++;
        } else if (activeCount === 0 || (activeCount <= 1 && estHours <= 5)) {
            status = 'UNDERUTILIZED';
            underutilizedCount++;
        } else {
            balancedCount++;
        }

        return {
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            department: u.department?.name || 'General',
            activeTasks: activeCount,
            urgentTasks: urgentCount,
            estimatedHours: +estHours.toFixed(1),
            actualHours: +loggedHours.toFixed(1),
            status
        };
    });

    const totalEmployees = users.length;
    const avgTasksPerEmployee = totalEmployees > 0 ? +(totalActiveTasks / totalEmployees).toFixed(1) : 0;

    return {
        summary: {
            scopeLabel,
            totalEmployees,
            totalActiveTasks,
            avgTasksPerEmployee,
            overloadedCount,
            balancedCount,
            underutilizedCount
        },
        workloadList,
        rawData: workloadList
    };
};

/**
 * 5. Overview Executive Summary
 */
export const getOverviewReport = async (
    user: User,
    userIds: string[],
    scopeLabel: string,
    start: Date,
    end: Date
) => {
    const [taskReport, attendanceReport, performanceReport, workloadReport] = await Promise.all([
        getTaskReport(user, userIds, scopeLabel, start, end),
        getAttendanceReport(user, userIds, scopeLabel, start, end),
        getPerformanceReport(user, userIds, scopeLabel, start, end),
        getWorkloadReport(user, userIds, scopeLabel)
    ]);

    return {
        scopeLabel,
        period: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
        tasks: taskReport.summary,
        attendance: attendanceReport.summary,
        performance: performanceReport.summary,
        workload: workloadReport.summary
    };
};

/**
 * Helper to export any report dataset as CSV
 */
export const exportReportToCsv = (rawData: any[], reportType: string): string => {
    if (!rawData || rawData.length === 0) {
        return 'No records available for this report period and scope.';
    }

    const fields = Object.keys(rawData[0]);
    const parser = new Parser({ fields });
    return parser.parse(rawData);
};

/**
 * Helper to export any report dataset as a professional PDF document using pdfkit
 */
export const exportReportToPdf = async (
    reportResult: any,
    reportType: string,
    scopeLabel: string
): Promise<Buffer> => {
    // Dynamically import or require pdfkit
    const PDFDocument = require('pdfkit');
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 50 });
        const buffers: Buffer[] = [];

        doc.on('data', (chunk: Buffer) => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', (err: any) => reject(err));

        // Header
        doc.fontSize(20).font('Helvetica-Bold').text('TaskBot Pro — Workforce Intelligence Report', { align: 'left' });
        doc.moveDown(0.25);
        doc.fontSize(10).font('Helvetica').fillColor('#666666').text(`Scope: ${scopeLabel} | Domain: ${reportType.toUpperCase()} | Generated: ${new Date().toLocaleString()}`);
        doc.moveDown(0.5);
        doc.moveTo(50, doc.y).lineTo(550, doc.y).strokeColor('#cccccc').stroke();
        doc.moveDown(1);

        // Executive Overview or Summary Metrics
        doc.fillColor('#000000');
        if (reportType === 'overview') {
            doc.fontSize(14).font('Helvetica-Bold').text('Executive Overview Summary');
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            if (reportResult.tasks) {
                doc.text(`• Tasks: Total ${reportResult.tasks.totalTasks || 0} | Completed: ${reportResult.tasks.completedCount || 0} (${reportResult.tasks.completionRate || 0}%) | Overdue: ${reportResult.tasks.overdueCount || 0}`);
            }
            if (reportResult.attendance) {
                doc.text(`• Attendance: Consistency: ${reportResult.attendance.attendanceConsistency || 0}% | Working Hours: ${reportResult.attendance.totalWorkingHours || 0}h | Overtime: ${reportResult.attendance.totalOvertimeHours || 0}h`);
            }
            if (reportResult.performance) {
                doc.text(`• Performance: Reviews: ${reportResult.performance.totalReviews || 0} (Avg Rating: ${reportResult.performance.averageRating || 0}/5) | Goals Achieved: ${reportResult.performance.goalsAchievedRate || 0}%`);
            }
            if (reportResult.workload) {
                doc.text(`• Workforce Capacity: Total Staff: ${reportResult.workload.totalEmployees || 0} | Overloaded: ${reportResult.workload.overloadedCount || 0} | Balanced: ${reportResult.workload.balancedCount || 0}`);
            }
        } else if (reportResult.summary) {
            doc.fontSize(14).font('Helvetica-Bold').text(`${reportType.toUpperCase()} Summary Metrics`);
            doc.moveDown(0.5);
            doc.fontSize(10).font('Helvetica');
            for (const [k, v] of Object.entries(reportResult.summary)) {
                doc.text(`• ${k}: ${v}`);
            }
        }

        // Detailed Records Table
        const items = reportResult.rawData || [];
        if (items.length > 0) {
            doc.moveDown(1);
            doc.fontSize(12).font('Helvetica-Bold').text(`Detailed Records (${items.length} total)`);
            doc.moveDown(0.5);
            doc.fontSize(9).font('Helvetica');
            const sample = items.slice(0, 35);
            sample.forEach((item: any, idx: number) => {
                const summaryLine = Object.entries(item)
                    .filter(([k]) => k !== 'id')
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' | ');
                doc.text(`${idx + 1}. ${summaryLine}`, { width: 500 });
                doc.moveDown(0.15);
            });
            if (items.length > 35) {
                doc.moveDown(0.5);
                doc.fillColor('#888888').text(`... and ${items.length - 35} additional records.`);
            }
        }

        doc.end();
    });
};

