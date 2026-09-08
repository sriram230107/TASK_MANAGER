import api from '../api/axios';

export type GoalLevel = 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE';
export type GoalStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'ACHIEVED' | 'MISSED' | 'CANCELLED';

export interface Goal {
    id: string;
    title: string;
    description?: string | null;
    level: GoalLevel;
    ownerId?: string | null;
    departmentId?: string | null;
    teamId?: string | null;
    organizationId: string;
    target: string;
    deadline: string;
    progress: number;
    status: GoalStatus;
    reviewNotes?: string | null;
    createdAt: string;
    updatedAt: string;
    owner?: { id: string; name: string; email: string; role: string } | null;
    department?: { id: string; name: string } | null;
    team?: { id: string; name: string } | null;
}

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

export interface PerformanceReview {
    id: string;
    employeeId: string;
    reviewerId: string;
    taskCompletionRate: number;
    onTimeRate: number;
    goalsAchievedRate: number;
    attendanceConsistency: number;
    rating: number;
    periodStart: string;
    periodEnd: string;
    cadence: string;
    comments?: string | null;
    createdAt: string;
    employee?: { id: string; name: string; email: string; role: string };
    reviewer?: { id: string; name: string; email: string; role: string };
}

export interface CreateReviewDTO {
    employeeId: string;
    rating: number;
    cadence?: string;
    comments?: string;
    periodStart: string;
    periodEnd: string;
}

export interface PerformanceMetrics {
    level: string;
    targetId: string;
    period: { start: string; end: string };
    tasks: {
        total: number;
        completed: number;
        inProgress: number;
        overdue: number;
        completionRate: number;
        onTimeRate: number;
        avgCompletionHours: number;
    };
    attendance: {
        recordsCount: number;
        presentCount: number;
        consistencyRate: number;
    };
    goals: {
        total: number;
        achieved: number;
        inProgress: number;
        achievedRate: number;
    };
    reviews: {
        totalReviews: number;
        averageRating: number;
    };
}

export interface GoalQueryParams {
    page?: number;
    limit?: number;
    level?: GoalLevel;
    status?: GoalStatus;
    ownerId?: string;
    departmentId?: string;
    teamId?: string;
}

export const performanceService = {
    /**
     * Get aggregated multi-dimensional metrics
     */
    getMetrics: async (params?: {
        level?: 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE';
        id?: string;
        periodStart?: string;
        periodEnd?: string;
    }): Promise<PerformanceMetrics> => {
        const res = await api.get('/performance/metrics', { params });
        return res.data.data || res.data;
    },

    /**
     * List goals with filters & scoping
     */
    listGoals: async (params?: GoalQueryParams): Promise<{
        goals: Goal[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
    }> => {
        const res = await api.get('/goals', { params });
        const goals = Array.isArray(res.data.data) ? res.data.data : (res.data.goals || []);
        const pagination = res.data.meta || {
            total: goals.length,
            page: params?.page || 1,
            limit: params?.limit || 20,
            totalPages: 1
        };
        return { goals, pagination };
    },

    /**
     * Create a cascading goal
     */
    createGoal: async (data: CreateGoalDTO): Promise<Goal> => {
        const res = await api.post('/goals', data);
        return res.data.data || res.data;
    },

    /**
     * Update a goal (progress, status, details)
     */
    updateGoal: async (id: string, data: UpdateGoalDTO): Promise<Goal> => {
        const res = await api.patch(`/goals/${id}`, data);
        return res.data.data || res.data;
    },

    /**
     * Delete a goal
     */
    deleteGoal: async (id: string): Promise<void> => {
        await api.delete(`/goals/${id}`);
    },

    /**
     * List formal performance reviews
     */
    listReviews: async (employeeId?: string): Promise<PerformanceReview[]> => {
        const res = await api.get('/performance/reviews', {
            params: employeeId ? { employeeId } : undefined
        });
        return Array.isArray(res.data.data) ? res.data.data : (res.data.reviews || []);
    },

    /**
     * Submit an evaluation review
     */
    submitReview: async (data: CreateReviewDTO): Promise<PerformanceReview> => {
        const res = await api.post('/performance/reviews', data);
        return res.data.data || res.data;
    }
};
