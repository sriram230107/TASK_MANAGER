import api from '../api/axios';

export const dashboardService = {
    getEmployeeDashboard: async () => {
        const res = await api.get('/dashboard/employee');
        return res.data.data || res.data;
    },

    getTeamLeadDashboard: async () => {
        const res = await api.get('/dashboard/team-lead');
        return res.data.data || res.data;
    },

    getManagerDashboard: async () => {
        const res = await api.get('/dashboard/manager');
        return res.data.data || res.data;
    },

    getAdminDashboard: async () => {
        const res = await api.get('/admin/dashboard');
        return res.data.data || res.data;
    }
};
