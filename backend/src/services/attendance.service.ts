import { prisma } from '../utils/prisma';
import { AttendanceStatus, WorkSessionType } from '@prisma/client';
import { isAuthorizedForTarget } from '../utils/hierarchy';

export interface AttendanceQueryFilters {
    page?: number;
    limit?: number;
    userId?: string;
    startDate?: string;
    endDate?: string;
    status?: AttendanceStatus;
}

export interface UpdateAttendanceDTO {
    status?: AttendanceStatus;
    checkIn?: string;
    checkOut?: string;
    isWorkFromHome?: boolean;
    notes?: string;
}

const getStartOfDay = (d: Date = new Date()): Date => {
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    return start;
};

const getEndOfDay = (d: Date = new Date()): Date => {
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return end;
};

/**
 * Returns today's attendance record and current work session state.
 */
export const getTodayAttendance = async (requestingUser: any, targetUserId?: string) => {
    let targetId = requestingUser.id;

    if (targetUserId && targetUserId !== requestingUser.id) {
        const isAuth = await isAuthorizedForTarget(requestingUser, targetUserId);
        if (!isAuth) {
            throw new Error('Forbidden: User is outside your organizational scope');
        }
        targetId = targetUserId;
    }

    const todayStart = getStartOfDay();
    const todayEnd = getEndOfDay();

    const attendance = await prisma.attendance.findFirst({
        where: {
            userId: targetId,
            date: {
                gte: todayStart,
                lte: todayEnd
            }
        },
        include: {
            workSessions: {
                orderBy: { startTime: 'asc' }
            },
            user: {
                select: { id: true, name: true, email: true, role: true }
            }
        }
    });

    let state: 'NOT_CHECKED_IN' | 'WORKING' | 'ON_BREAK' | 'CHECKED_OUT' = 'NOT_CHECKED_IN';
    let activeSession = null;

    if (attendance) {
        if (attendance.checkOut) {
            state = 'CHECKED_OUT';
        } else {
            activeSession = attendance.workSessions.find((s) => s.endTime === null) || null;
            if (activeSession) {
                state = activeSession.type === 'BREAK' ? 'ON_BREAK' : 'WORKING';
            } else {
                state = 'WORKING';
            }
        }
    }

    return {
        attendance,
        state,
        activeSession
    };
};

/**
 * Check-in action: creates daily attendance record and starts the first WORKING session.
 */
export const checkIn = async (
    requestingUser: any,
    data: { isWorkFromHome?: boolean; notes?: string; userId?: string }
) => {
    // Admin can check in on behalf of a user; otherwise enforce requestingUser.id
    const targetId = (requestingUser.role === 'ADMIN' && data.userId) ? data.userId : requestingUser.id;

    const todayDate = getStartOfDay();

    const existing = await prisma.attendance.findFirst({
        where: {
            userId: targetId,
            date: {
                gte: todayDate,
                lte: getEndOfDay()
            }
        }
    });

    if (existing && existing.checkIn) {
        throw new Error('Already checked in for today');
    }

    const now = new Date();
    // Shift threshold from organization settings (default 09:00 + 15 min grace period)
    const userOrg = await prisma.organization.findUnique({
        where: { id: requestingUser.organizationId },
        select: { workingHoursPerDay: true, settings: true }
    });
    const orgSettings = (userOrg?.settings as any) || {};
    const workStartTime = orgSettings.workStartTime || '09:00';
    const [startH, startM] = workStartTime.split(':').map((v: string) => parseInt(v, 10) || 0);
    const thresholdMinutes = (startH || 9) * 60 + (startM || 0) + 15;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const isLate = currentMinutes > thresholdMinutes;

    const status: AttendanceStatus = data.isWorkFromHome
        ? 'WORK_FROM_HOME'
        : (isLate ? 'LATE' : 'PRESENT');

    const attendance = await prisma.attendance.create({
        data: {
            userId: targetId,
            date: todayDate,
            checkIn: now,
            status,
            lateArrival: isLate,
            isWorkFromHome: !!data.isWorkFromHome,
            notes: data.notes || null,
            workSessions: {
                create: {
                    type: 'WORKING',
                    startTime: now
                }
            }
        },
        include: {
            workSessions: true
        }
    });

    return attendance;
};

/**
 * Starts a break: closes active WORKING session and creates a new BREAK session.
 */
export const startBreak = async (requestingUser: any, notes?: string) => {
    const todayDate = getStartOfDay();
    const attendance = await prisma.attendance.findFirst({
        where: {
            userId: requestingUser.id,
            date: {
                gte: todayDate,
                lte: getEndOfDay()
            }
        },
        include: { workSessions: true }
    });

    if (!attendance || !attendance.checkIn) {
        throw new Error('You must check in before starting a break');
    }

    if (attendance.checkOut) {
        throw new Error('Cannot start a break after checking out');
    }

    const activeSession = attendance.workSessions.find((s) => s.endTime === null);
    if (activeSession && activeSession.type === 'BREAK') {
        throw new Error('Already on break');
    }

    const now = new Date();

    if (activeSession) {
        const duration = Math.max(1, Math.round((now.getTime() - activeSession.startTime.getTime()) / (1000 * 60)));
        await prisma.workSession.update({
            where: { id: activeSession.id },
            data: { endTime: now, durationMinutes: duration }
        });
    }

    const breakSession = await prisma.workSession.create({
        data: {
            attendanceId: attendance.id,
            type: 'BREAK',
            startTime: now
        }
    });

    return {
        attendanceId: attendance.id,
        activeSession: breakSession,
        state: 'ON_BREAK'
    };
};

/**
 * Resumes work: closes active BREAK session, logs break duration, and starts a new WORKING session.
 */
export const endBreak = async (requestingUser: any) => {
    const todayDate = getStartOfDay();
    const attendance = await prisma.attendance.findFirst({
        where: {
            userId: requestingUser.id,
            date: {
                gte: todayDate,
                lte: getEndOfDay()
            }
        },
        include: { workSessions: true }
    });

    if (!attendance || !attendance.checkIn) {
        throw new Error('Not checked in today');
    }

    if (attendance.checkOut) {
        throw new Error('Already checked out for today');
    }

    const activeSession = attendance.workSessions.find((s) => s.endTime === null);
    if (!activeSession || activeSession.type !== 'BREAK') {
        throw new Error('Not currently on break');
    }

    const now = new Date();
    const breakDuration = Math.max(1, Math.round((now.getTime() - activeSession.startTime.getTime()) / (1000 * 60)));

    await prisma.$transaction([
        prisma.workSession.update({
            where: { id: activeSession.id },
            data: { endTime: now, durationMinutes: breakDuration }
        }),
        prisma.attendance.update({
            where: { id: attendance.id },
            data: {
                breakDurationMinutes: { increment: breakDuration }
            }
        }),
        prisma.workSession.create({
            data: {
                attendanceId: attendance.id,
                type: 'WORKING',
                startTime: now
            }
        })
    ]);

    return {
        attendanceId: attendance.id,
        state: 'WORKING'
    };
};

/**
 * Check-out action: closes all open sessions, aggregates working & overtime minutes, and records departure.
 */
export const checkOut = async (requestingUser: any, notes?: string) => {
    const todayDate = getStartOfDay();
    const attendance = await prisma.attendance.findFirst({
        where: {
            userId: requestingUser.id,
            date: {
                gte: todayDate,
                lte: getEndOfDay()
            }
        },
        include: { workSessions: true }
    });

    if (!attendance || !attendance.checkIn) {
        throw new Error('Cannot check out before checking in');
    }

    if (attendance.checkOut) {
        throw new Error('Already checked out for today');
    }

    const now = new Date();
    const activeSession = attendance.workSessions.find((s) => s.endTime === null);

    let addedBreak = 0;
    if (activeSession) {
        const duration = Math.max(1, Math.round((now.getTime() - activeSession.startTime.getTime()) / (1000 * 60)));
        await prisma.workSession.update({
            where: { id: activeSession.id },
            data: { endTime: now, durationMinutes: duration }
        });
        if (activeSession.type === 'BREAK') {
            addedBreak = duration;
        }
    }

    // Tally all WORKING sessions
    const allSessions = await prisma.workSession.findMany({
        where: { attendanceId: attendance.id }
    });

    const totalWorkingMinutes = allSessions
        .filter((s) => s.type === 'WORKING')
        .reduce((acc, s) => acc + (s.durationMinutes || 0), 0);

    // Standard working hours dynamically configured in organization settings (default: 8 hours = 480 mins)
    const userOrg = await prisma.organization.findUnique({
        where: { id: requestingUser.organizationId },
        select: { workingHoursPerDay: true }
    });
    const standardWorkMinutes = (userOrg?.workingHoursPerDay || 8) * 60;
    const halfDayMinutes = Math.round(standardWorkMinutes / 2);
    const overtimeMinutes = Math.max(0, totalWorkingMinutes - standardWorkMinutes);
    const earlyDeparture = totalWorkingMinutes < standardWorkMinutes;

    let finalStatus = attendance.status;
    if (totalWorkingMinutes < halfDayMinutes && finalStatus !== 'LEAVE' && finalStatus !== 'HOLIDAY') {
        finalStatus = 'HALF_DAY';
    }

    const updated = await prisma.attendance.update({
        where: { id: attendance.id },
        data: {
            checkOut: now,
            totalWorkingMinutes,
            breakDurationMinutes: attendance.breakDurationMinutes + addedBreak,
            overtimeMinutes,
            earlyDeparture,
            status: finalStatus,
            notes: notes ? (attendance.notes ? `${attendance.notes}\n${notes}` : notes) : attendance.notes
        },
        include: { workSessions: true }
    });

    return updated;
};

/**
 * Queries attendance records with organizational access-scope constraints.
 */
export const listAttendance = async (requestingUser: any, filters: AttendanceQueryFilters) => {
    const where: any = {};

    // 1. Role Scoping per Rule 6
    if (requestingUser.role === 'EMPLOYEE') {
        where.userId = requestingUser.id;
    } else if (requestingUser.role === 'TEAM_LEAD') {
        if (filters.userId) {
            const isAuth = await isAuthorizedForTarget(requestingUser, filters.userId);
            if (!isAuth) throw new Error('Forbidden: User outside your team scope');
            where.userId = filters.userId;
        } else {
            where.user = {
                organizationId: requestingUser.organizationId,
                deletedAt: null,
                OR: [
                    { id: requestingUser.id },
                    { teamLeadId: requestingUser.id },
                    { memberships: { some: { team: { teamLeadId: requestingUser.id } } } }
                ]
            };
        }
    } else if (requestingUser.role === 'MANAGER') {
        if (filters.userId) {
            const isAuth = await isAuthorizedForTarget(requestingUser, filters.userId);
            if (!isAuth) throw new Error('Forbidden: User outside your department scope');
            where.userId = filters.userId;
        } else {
            where.user = {
                organizationId: requestingUser.organizationId,
                deletedAt: null,
                OR: [
                    { id: requestingUser.id },
                    { managerId: requestingUser.id },
                    ...(requestingUser.departmentId ? [{ departmentId: requestingUser.departmentId }] : []),
                    { department: { managerId: requestingUser.id } },
                    { memberships: { some: { team: { teamLead: { managerId: requestingUser.id } } } } }
                ]
            };
        }
    } else {
        // ADMIN
        if (filters.userId) {
            where.userId = filters.userId;
            where.user = { organizationId: requestingUser.organizationId };
        } else {
            where.user = { organizationId: requestingUser.organizationId };
        }
    }

    if (filters.status) {
        where.status = filters.status;
    }

    if (filters.startDate || filters.endDate) {
        where.date = {
            ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
            ...(filters.endDate ? { lte: new Date(filters.endDate) } : {})
        };
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
        prisma.attendance.findMany({
            where,
            skip,
            take: limit,
            orderBy: { date: 'desc' },
            include: {
                user: {
                    select: { id: true, name: true, email: true, role: true }
                },
                workSessions: {
                    orderBy: { startTime: 'asc' }
                }
            }
        }),
        prisma.attendance.count({ where })
    ]);

    return {
        records,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Computes attendance summary metrics over a given period (default 30 days).
 */
export const getAttendanceSummary = async (requestingUser: any, targetUserId?: string, days = 30) => {
    let targetId = requestingUser.id;

    if (targetUserId && targetUserId !== requestingUser.id) {
        const isAuth = await isAuthorizedForTarget(requestingUser, targetUserId);
        if (!isAuth) {
            throw new Error('Forbidden: User is outside your organizational scope');
        }
        targetId = targetUserId;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const records = await prisma.attendance.findMany({
        where: {
            userId: targetId,
            date: { gte: startDate }
        }
    });

    const totalDaysRecorded = records.length;
    const presentDays = records.filter((r) => r.status === 'PRESENT' || r.status === 'WORK_FROM_HOME').length;
    const lateDays = records.filter((r) => r.lateArrival || r.status === 'LATE').length;
    const halfDays = records.filter((r) => r.status === 'HALF_DAY').length;
    const wfhDays = records.filter((r) => r.isWorkFromHome).length;
    const totalWorkingMinutes = records.reduce((acc, r) => acc + r.totalWorkingMinutes, 0);
    const totalOvertimeMinutes = records.reduce((acc, r) => acc + r.overtimeMinutes, 0);
    const totalBreakMinutes = records.reduce((acc, r) => acc + r.breakDurationMinutes, 0);

    return {
        periodDays: days,
        metrics: {
            totalDaysRecorded,
            presentDays,
            lateDays,
            halfDays,
            wfhDays,
            totalWorkingHours: +(totalWorkingMinutes / 60).toFixed(2),
            totalOvertimeHours: +(totalOvertimeMinutes / 60).toFixed(2),
            totalBreakHours: +(totalBreakMinutes / 60).toFixed(2),
            averageDailyHours: totalDaysRecorded > 0 ? +(totalWorkingMinutes / 60 / totalDaysRecorded).toFixed(2) : 0
        }
    };
};

/**
 * Manual historical attendance adjustment (Admin / Manager only).
 */
export const updateAttendanceRecord = async (
    requestingUser: any,
    attendanceId: string,
    data: UpdateAttendanceDTO
) => {
    if (requestingUser.role !== 'ADMIN' && requestingUser.role !== 'MANAGER') {
        throw new Error('Forbidden: Only managers and administrators can adjust historical attendance records');
    }

    const record = await prisma.attendance.findUnique({
        where: { id: attendanceId },
        include: { user: true }
    });

    if (!record) {
        throw new Error('Attendance record not found');
    }

    if (record.user.organizationId !== requestingUser.organizationId) {
        throw new Error('Forbidden: Record belongs to another organization');
    }

    const isAuth = await isAuthorizedForTarget(requestingUser, record.userId);
    if (!isAuth) {
        throw new Error('Forbidden: User is outside your organizational scope');
    }

    const updated = await prisma.attendance.update({
        where: { id: attendanceId },
        data: {
            ...(data.status ? { status: data.status } : {}),
            ...(data.checkIn ? { checkIn: new Date(data.checkIn) } : {}),
            ...(data.checkOut ? { checkOut: new Date(data.checkOut) } : {}),
            ...(data.isWorkFromHome !== undefined ? { isWorkFromHome: data.isWorkFromHome } : {}),
            ...(data.notes ? { notes: data.notes } : {})
        },
        include: { workSessions: true, user: { select: { id: true, name: true, email: true } } }
    });

    // Audit log entry
    await prisma.auditLog.create({
        data: {
            userId: requestingUser.id,
            action: 'UPDATE_ATTENDANCE_RECORD',
            entity: 'Attendance',
            entityId: attendanceId,
            metadata: {
                adjustedFor: record.userId,
                adjustments: data
            } as any
        }
    }).catch(() => {});

    return updated;
};
