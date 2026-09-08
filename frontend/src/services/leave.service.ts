import api from '../api/axios';

export type LeaveType =
    | 'ANNUAL'
    | 'SICK'
    | 'CASUAL'
    | 'UNPAID'
    | 'MATERNITY'
    | 'PATERNITY'
    | 'BEREAVEMENT';

export type LeaveStatus =
    | 'PENDING_LEAD'
    | 'PENDING_MANAGER'
    | 'APPROVED'
    | 'REJECTED'
    | 'CANCELLED';

export interface LeaveBalance {
    id: string;
    userId: string;
    leaveType: LeaveType;
    allocatedDays: number;
    usedDays: number;
    remainingDays: number;
    year: number;
}

export interface LeaveRequest {
    id: string;
    employeeId: string;
    type: LeaveType;
    startDate: string;
    endDate: string;
    daysCount: number;
    reason: string;
    status: LeaveStatus;
    teamLeadReviewerId?: string | null;
    teamLeadReviewedAt?: string | null;
    managerReviewerId?: string | null;
    managerReviewedAt?: string | null;
    reviewerNotes?: string | null;
    createdAt: string;
    updatedAt: string;
    employee?: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    teamLeadReviewer?: {
        id: string;
        name: string;
    } | null;
    managerReviewer?: {
        id: string;
        name: string;
    } | null;
}

export interface CreateLeaveDTO {
    type: LeaveType;
    startDate: string;
    endDate: string;
    reason: string;
}

export interface ReviewLeaveDTO {
    action: 'APPROVE' | 'REJECT';
    notes?: string;
}

export interface LeaveQueryParams {
    page?: number;
    limit?: number;
    status?: LeaveStatus;
    type?: LeaveType;
    employeeId?: string;
    pendingReview?: boolean;
    startDate?: string;
    endDate?: string;
}

export const leaveService = {
    /**
     * Get current user's (or target user's) leave balances for the year
     */
    getBalances: async (userId?: string, year?: number): Promise<LeaveBalance[]> => {
        const res = await api.get('/leave/balances', {
            params: { ...(userId ? { userId } : {}), ...(year ? { year } : {}) }
        });
        return res.data.data || res.data;
    },

    /**
     * Submit a new leave request
     */
    applyLeave: async (data: CreateLeaveDTO): Promise<LeaveRequest> => {
        const res = await api.post('/leave', data);
        return res.data.data || res.data;
    },

    /**
     * Review a leave request (Approve / Reject)
     */
    reviewLeave: async (id: string, data: ReviewLeaveDTO): Promise<LeaveRequest> => {
        const res = await api.post(`/leave/${id}/review`, data);
        return res.data.data || res.data;
    },

    /**
     * Cancel a leave request
     */
    cancelLeave: async (id: string): Promise<LeaveRequest> => {
        const res = await api.post(`/leave/${id}/cancel`);
        return res.data.data || res.data;
    },

    /**
     * List leave requests with role-scoping and filters
     */
    listLeaves: async (params?: LeaveQueryParams): Promise<{
        requests: LeaveRequest[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
    }> => {
        const res = await api.get('/leave', { params });
        const requests = Array.isArray(res.data.data) ? res.data.data : (res.data.requests || []);
        const pagination = res.data.meta || {
            total: requests.length,
            page: params?.page || 1,
            limit: params?.limit || 20,
            totalPages: 1
        };
        return { requests, pagination };
    }
};
