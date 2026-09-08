import api from '../api/axios';

export interface User {
    id: string;
    email: string;
    name: string;
    role: 'ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';
    organizationId: string;
    departmentId?: string | null;
    department?: { id: string; name: string } | null;
    managerId?: string | null;
    teamLeadId?: string | null;
}

export interface LoginResponse {
    accessToken: string;
    user: User;
}

export const authService = {
    login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
        const res = await api.post('/auth/login', credentials);
        const data = res.data;
        return {
            accessToken: data.accessToken || data.data?.accessToken,
            user: data.user || data.data?.user
        };
    },

    logout: async (): Promise<void> => {
        try {
            await api.post('/auth/logout');
        } finally {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }
    },

    getMe: async (): Promise<User> => {
        const res = await api.get('/auth/me');
        return res.data.data || res.data;
    }
};
