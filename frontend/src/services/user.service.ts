import api from '../api/axios';

export interface UserProfile {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';
    organizationId: string;
    departmentId?: string | null;
    department?: {
        id: string;
        name: string;
        code?: string | null;
    } | null;
    managerId?: string | null;
    manager?: {
        id: string;
        name: string;
        email?: string;
        role?: string;
    } | null;
    teamLeadId?: string | null;
    teamLead?: {
        id: string;
        name: string;
        email?: string;
        role?: string;
    } | null;
    memberships?: Array<{
        joinedAt: string;
        team: {
            id: string;
            name: string;
            departmentId?: string | null;
            teamLead?: { id: string; name: string } | null;
        };
    }>;
    directReports?: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
    }>;
    ledEmployees?: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
    }>;
    ledTeams?: Array<{
        id: string;
        name: string;
    }>;
    departmentsManaged?: Array<{
        id: string;
        name: string;
        code?: string | null;
    }>;
    stats?: {
        totalTasks: number;
        completedTasks: number;
        inProgressTasks: number;
        underReviewTasks: number;
        activeGoals: number;
    };
    createdAt: string;
    updatedAt: string;
}

export interface UserListItem {
    id: string;
    name: string;
    email: string;
    role: 'ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';
    departmentId?: string | null;
    department?: { id: string; name: string; code?: string | null } | null;
    manager?: { id: string; name: string } | null;
    teamLead?: { id: string; name: string } | null;
    memberships?: Array<{ team: { id: string; name: string } }>;
    createdAt: string;
}

export interface UserQueryParams {
    page?: number;
    limit?: number;
    role?: 'ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';
    departmentId?: string;
    teamId?: string;
    search?: string;
}

export interface UpdateUserDTO {
    name?: string;
    role?: 'ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';
    departmentId?: string | null;
    managerId?: string | null;
    teamLeadId?: string | null;
}

export interface CreateUserDTO {
    email: string;
    password: string;
    name: string;
    role: 'ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';
    departmentId?: string | null;
    managerId?: string | null;
    teamLeadId?: string | null;
}

export interface OrgHierarchy {
    departments: Array<{
        id: string;
        name: string;
        code?: string | null;
        manager?: { id: string; name: string; email: string; role: string } | null;
        teams: Array<{
            id: string;
            name: string;
            teamLead?: { id: string; name: string; email: string; role: string } | null;
            members: Array<{
                user: { id: string; name: string; email: string; role: string };
            }>;
        }>;
    }>;
    unassignedUsers: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
    }>;
}

export const userService = {
    /**
     * Fetch current user's profile with stats and reporting line
     */
    getMyProfile: async (): Promise<UserProfile> => {
        const res = await api.get('/users/me');
        return res.data.data || res.data;
    },

    /**
     * Fetch a specific user's profile
     */
    getUserProfile: async (userId: string): Promise<UserProfile> => {
        const res = await api.get(`/users/${userId}`);
        return res.data.data || res.data;
    },

    /**
     * List users within organizational scope with optional filters
     */
    listUsers: async (params?: UserQueryParams): Promise<{
        users: UserListItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
    }> => {
        const res = await api.get('/users', { params });
        const users = Array.isArray(res.data.data) ? res.data.data : (res.data.users || []);
        const pagination = res.data.meta || {
            total: users.length,
            page: params?.page || 1,
            limit: params?.limit || 20,
            totalPages: 1
        };
        return { users, pagination };
    },

    /**
     * Update user profile (self display name or admin full update)
     */
    updateUserProfile: async (userId: string, data: UpdateUserDTO): Promise<UserProfile> => {
        const res = await api.patch(`/users/${userId}`, data);
        return res.data.data || res.data;
    },

    /**
     * Create user (Admin only)
     */
    createUser: async (data: CreateUserDTO): Promise<UserListItem> => {
        const res = await api.post('/users', data);
        return res.data.data || res.data;
    },

    /**
     * Get organization hierarchy tree
     */
    getOrgHierarchy: async (): Promise<OrgHierarchy> => {
        const res = await api.get('/users/hierarchy');
        return res.data.data || res.data;
    }
};
