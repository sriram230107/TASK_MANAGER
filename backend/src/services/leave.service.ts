import { prisma } from '../utils/prisma';
import { LeaveType, LeaveStatus } from '@prisma/client';
import { isAuthorizedForTarget } from '../utils/hierarchy';
import { notifyLeaveParticipants } from './notification.service';

export interface LeaveQueryFilters {
    page?: number;
    limit?: number;
    status?: LeaveStatus;
    type?: LeaveType;
    employeeId?: string;
    pendingReview?: boolean;
    startDate?: string;
    endDate?: string;
}

export interface CreateLeaveDTO {
    type: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
}

const DEFAULT_BALANCES: Record<LeaveType, number> = {
    ANNUAL: 15,
    SICK: 10,
    CASUAL: 5,
    UNPAID: 30,
    MATERNITY: 90,
    PATERNITY: 14,
    BEREAVEMENT: 5
};

/**
 * Ensures a user has initialized leave balances for the given year.
 */
export const ensureLeaveBalances = async (userId: string, year: number) => {
    const existing = await prisma.leaveBalance.findMany({
        where: { userId, year }
    });

    const existingTypes = new Set(existing.map((b) => b.leaveType));
    const toCreate: Array<{
        userId: string;
        leaveType: LeaveType;
        allocatedDays: number;
        usedDays: number;
        remainingDays: number;
        year: number;
    }> = [];

    (Object.keys(DEFAULT_BALANCES) as LeaveType[]).forEach((type) => {
        if (!existingTypes.has(type)) {
            const allocated = DEFAULT_BALANCES[type];
            toCreate.push({
                userId,
                leaveType: type,
                allocatedDays: allocated,
                usedDays: 0,
                remainingDays: allocated,
                year
            });
        }
    });

    if (toCreate.length > 0) {
        await prisma.leaveBalance.createMany({
            data: toCreate,
            skipDuplicates: true
        });
    }
};

/**
 * Retrieves all leave balances for a user in a given year.
 */
export const getLeaveBalances = async (requestingUser: any, targetUserId?: string, year?: number) => {
    let targetId = requestingUser.id;

    if (targetUserId && targetUserId !== requestingUser.id) {
        const isAuth = await isAuthorizedForTarget(requestingUser, targetUserId);
        if (!isAuth) {
            throw new Error('Forbidden: User is outside your organizational scope');
        }
        targetId = targetUserId;
    }

    const currentYear = year || new Date().getFullYear();
    await ensureLeaveBalances(targetId, currentYear);

    const balances = await prisma.leaveBalance.findMany({
        where: { userId: targetId, year: currentYear },
        orderBy: { leaveType: 'asc' }
    });

    return balances;
};

/**
 * Applies for a new leave with overlapping check, balance verification, and hierarchy status routing.
 */
export const applyLeave = async (requestingUser: any, data: CreateLeaveDTO) => {
    const start = new Date(data.startDate);
    start.setHours(0, 0, 0, 0);

    const end = new Date(data.endDate);
    end.setHours(0, 0, 0, 0);

    if (end < start) {
        throw new Error('End date cannot be earlier than start date');
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const daysCount = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // Set end to end of day for storage and query boundaries
    end.setHours(23, 59, 59, 999);

    // 1. Prevent overlapping leave requests
    const overlapping = await prisma.leaveRequest.findFirst({
        where: {
            employeeId: requestingUser.id,
            status: { in: ['PENDING_LEAD', 'PENDING_MANAGER', 'APPROVED'] },
            OR: [
                {
                    startDate: { lte: end },
                    endDate: { gte: start }
                }
            ]
        }
    });

    if (overlapping) {
        throw new Error('Overlapping leave request exists for the selected dates');
    }

    // 2. Balance validation (unless UNPAID)
    const currentYear = start.getFullYear();
    await ensureLeaveBalances(requestingUser.id, currentYear);

    if (data.type !== 'UNPAID') {
        const balance = await prisma.leaveBalance.findUnique({
            where: {
                userId_leaveType_year: {
                    userId: requestingUser.id,
                    leaveType: data.type,
                    year: currentYear
                }
            }
        });

        if (balance && balance.remainingDays < daysCount) {
            throw new Error(
                `Insufficient leave balance: requested ${daysCount} day(s), but only ${balance.remainingDays} day(s) remaining for ${data.type}`
            );
        }
    }

    // 3. Routing hierarchy
    const requester = await prisma.user.findUnique({
        where: { id: requestingUser.id },
        select: { id: true, role: true, teamLeadId: true, managerId: true }
    });

    let initialStatus: LeaveStatus = 'PENDING_LEAD';

    if (requester?.role === 'ADMIN') {
        initialStatus = 'APPROVED';
    } else if (requester?.role === 'MANAGER') {
        initialStatus = requester.managerId ? 'PENDING_MANAGER' : 'APPROVED';
    } else if (requester?.role === 'TEAM_LEAD' || !requester?.teamLeadId) {
        initialStatus = requester?.managerId ? 'PENDING_MANAGER' : 'APPROVED';
    } else {
        initialStatus = 'PENDING_LEAD';
    }

    // 4. Create record
    const leaveRequest = await prisma.leaveRequest.create({
        data: {
            employeeId: requestingUser.id,
            type: data.type,
            startDate: start,
            endDate: end,
            daysCount,
            reason: data.reason,
            status: initialStatus
        },
        include: {
            employee: {
                select: { id: true, name: true, email: true, role: true }
            }
        }
    });

    // If auto-approved (e.g. Admin or top manager), deduct balance immediately
    if (initialStatus === 'APPROVED' && data.type !== 'UNPAID') {
        await prisma.leaveBalance.updateMany({
            where: {
                userId: requestingUser.id,
                leaveType: data.type,
                year: currentYear
            },
            data: {
                usedDays: { increment: daysCount },
                remainingDays: { decrement: daysCount }
            }
        });
    }

    // Notify supervisors of pending leave application
    if (initialStatus === 'PENDING_LEAD' && requester?.teamLeadId) {
        await notifyLeaveParticipants(
            requester.teamLeadId,
            'LEAVE_STATUS',
            `${requestingUser.name || 'Team member'} submitted ${data.type} leave request (${daysCount} day(s)) for review.`
        ).catch(() => {});
    } else if (initialStatus === 'PENDING_MANAGER' && requester?.managerId) {
        await notifyLeaveParticipants(
            requester.managerId,
            'LEAVE_STATUS',
            `${requestingUser.name || 'Employee'} submitted ${data.type} leave request (${daysCount} day(s)) for approval.`
        ).catch(() => {});
    }

    return leaveRequest;
};

/**
 * Reviews a leave request (Team Lead review -> Manager review -> Approved/Rejected).
 */
export const reviewLeaveRequest = async (
    reviewer: any,
    leaveId: string,
    action: 'APPROVE' | 'REJECT',
    notes?: string
) => {
    const leave = await prisma.leaveRequest.findUnique({
        where: { id: leaveId },
        include: {
            employee: {
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                    teamLeadId: true,
                    managerId: true,
                    organizationId: true
                }
            }
        }
    });

    if (!leave) {
        throw new Error('Leave request not found');
    }

    // Rule: Employee cannot approve own leave
    if (reviewer.id === leave.employeeId) {
        throw new Error('Forbidden: You cannot review your own leave request');
    }

    if (leave.employee.organizationId !== reviewer.organizationId) {
        throw new Error('Forbidden: Request belongs to another organization');
    }

    const isAuth = await isAuthorizedForTarget(reviewer, leave.employeeId);
    if (!isAuth && reviewer.role !== 'ADMIN') {
        throw new Error('Forbidden: Employee is outside your organizational scope');
    }

    if (leave.status === 'APPROVED' || leave.status === 'REJECTED' || leave.status === 'CANCELLED') {
        throw new Error(`Cannot review leave request with status ${leave.status}`);
    }

    const now = new Date();
    let nextStatus: LeaveStatus = leave.status;
    const updateData: any = {
        updatedAt: now,
        reviewerNotes: notes || leave.reviewerNotes
    };

    if (leave.status === 'PENDING_LEAD') {
        updateData.teamLeadReviewerId = reviewer.id;
        updateData.teamLeadReviewedAt = now;

        if (action === 'REJECT') {
            nextStatus = 'REJECTED';
        } else {
            // Team Lead Approved: determine if manager review is required
            const requiresManager = !!leave.employee.managerId && (reviewer.role === 'TEAM_LEAD');
            if (requiresManager) {
                nextStatus = 'PENDING_MANAGER';
            } else {
                nextStatus = 'APPROVED';
                updateData.managerReviewerId = reviewer.id;
                updateData.managerReviewedAt = now;
            }
        }
    } else if (leave.status === 'PENDING_MANAGER') {
        if (reviewer.role === 'TEAM_LEAD') {
            throw new Error('Forbidden: Team Lead cannot perform final manager review');
        }

        updateData.managerReviewerId = reviewer.id;
        updateData.managerReviewedAt = now;

        if (action === 'REJECT') {
            nextStatus = 'REJECTED';
        } else {
            nextStatus = 'APPROVED';
        }
    }

    updateData.status = nextStatus;

    // Database update & balance deduction in a transaction
    const [updatedLeave] = await prisma.$transaction([
        prisma.leaveRequest.update({
            where: { id: leaveId },
            data: updateData,
            include: {
                employee: { select: { id: true, name: true, email: true, role: true } },
                teamLeadReviewer: { select: { id: true, name: true } },
                managerReviewer: { select: { id: true, name: true } }
            }
        }),
        ...(nextStatus === 'APPROVED' && leave.type !== 'UNPAID'
            ? [
                  prisma.leaveBalance.updateMany({
                      where: {
                          userId: leave.employeeId,
                          leaveType: leave.type,
                          year: leave.startDate.getFullYear()
                      },
                      data: {
                          usedDays: { increment: leave.daysCount },
                          remainingDays: { decrement: leave.daysCount }
                      }
                  })
              ]
            : [])
    ]);

    // Audit log
    await prisma.auditLog.create({
        data: {
            userId: reviewer.id,
            action: action === 'APPROVE' ? 'LEAVE_APPROVED' : 'LEAVE_REJECTED',
            entity: 'LeaveRequest',
            entityId: leaveId,
            metadata: {
                employeeId: leave.employeeId,
                previousStatus: leave.status,
                newStatus: nextStatus,
                notes
            }
        }
    });

    // Notify employee of review decision
    await notifyLeaveParticipants(
        leave.employeeId,
        'LEAVE_STATUS',
        `Your ${leave.type} leave request (${leave.startDate.toISOString().split('T')[0]}) has been ${nextStatus === 'APPROVED' ? 'approved' : nextStatus === 'REJECTED' ? 'rejected' : 'reviewed by Team Lead and forwarded to Manager'}.`
    ).catch(() => {});

    return updatedLeave;
};

/**
 * Cancels a leave request and restores balance if previously approved.
 */
export const cancelLeaveRequest = async (requestingUser: any, leaveId: string) => {
    const leave = await prisma.leaveRequest.findUnique({
        where: { id: leaveId }
    });

    if (!leave) {
        throw new Error('Leave request not found');
    }

    if (leave.employeeId !== requestingUser.id && requestingUser.role !== 'ADMIN') {
        throw new Error('Forbidden: You can only cancel your own leave requests');
    }

    if (leave.status === 'CANCELLED' || leave.status === 'REJECTED') {
        throw new Error(`Leave request is already ${leave.status.toLowerCase()}`);
    }

    const wasApproved = leave.status === 'APPROVED';

    const [cancelled] = await prisma.$transaction([
        prisma.leaveRequest.update({
            where: { id: leaveId },
            data: { status: 'CANCELLED' },
            include: {
                employee: { select: { id: true, name: true, email: true } }
            }
        }),
        ...(wasApproved && leave.type !== 'UNPAID'
            ? [
                  prisma.leaveBalance.updateMany({
                      where: {
                          userId: leave.employeeId,
                          leaveType: leave.type,
                          year: leave.startDate.getFullYear()
                      },
                      data: {
                          usedDays: { decrement: leave.daysCount },
                          remainingDays: { increment: leave.daysCount }
                      }
                  })
              ]
            : [])
    ]);

    return cancelled;
};

/**
 * Lists leave requests with role-scoping and optional pending-review filtering.
 */
export const listLeaveRequests = async (requestingUser: any, filters: LeaveQueryFilters) => {
    const where: any = {};

    // 1. Scoping per Rule 6
    if (requestingUser.role === 'EMPLOYEE') {
        where.employeeId = requestingUser.id;
    } else if (requestingUser.role === 'TEAM_LEAD') {
        if (filters.pendingReview) {
            where.status = 'PENDING_LEAD';
            where.employee = {
                organizationId: requestingUser.organizationId,
                deletedAt: null,
                OR: [
                    { teamLeadId: requestingUser.id },
                    { memberships: { some: { team: { teamLeadId: requestingUser.id } } } }
                ]
            };
        } else if (filters.employeeId) {
            const isAuth = await isAuthorizedForTarget(requestingUser, filters.employeeId);
            if (!isAuth) throw new Error('Forbidden: Employee outside your team scope');
            where.employeeId = filters.employeeId;
        } else {
            where.employee = {
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
        if (filters.pendingReview) {
            where.status = 'PENDING_MANAGER';
            where.employee = {
                organizationId: requestingUser.organizationId,
                deletedAt: null,
                OR: [
                    { managerId: requestingUser.id },
                    ...(requestingUser.departmentId ? [{ departmentId: requestingUser.departmentId }] : []),
                    { department: { managerId: requestingUser.id } },
                    { memberships: { some: { team: { teamLead: { managerId: requestingUser.id } } } } }
                ]
            };
        } else if (filters.employeeId) {
            const isAuth = await isAuthorizedForTarget(requestingUser, filters.employeeId);
            if (!isAuth) throw new Error('Forbidden: Employee outside your department scope');
            where.employeeId = filters.employeeId;
        } else {
            where.employee = {
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
        if (filters.employeeId) {
            where.employeeId = filters.employeeId;
            where.employee = { organizationId: requestingUser.organizationId };
        } else {
            where.employee = { organizationId: requestingUser.organizationId };
        }
    }

    if (filters.status) {
        where.status = filters.status;
    }

    if (filters.type) {
        where.type = filters.type;
    }

    if (filters.startDate || filters.endDate) {
        where.startDate = {
            ...(filters.startDate ? { gte: new Date(filters.startDate) } : {}),
            ...(filters.endDate ? { lte: new Date(filters.endDate) } : {})
        };
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const [requests, total] = await Promise.all([
        prisma.leaveRequest.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
                employee: {
                    select: { id: true, name: true, email: true, role: true }
                },
                teamLeadReviewer: {
                    select: { id: true, name: true }
                },
                managerReviewer: {
                    select: { id: true, name: true }
                }
            }
        }),
        prisma.leaveRequest.count({ where })
    ]);

    return {
        requests,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};
