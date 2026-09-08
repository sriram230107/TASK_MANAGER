import api from '../api/axios';

export interface HolidayItem {
    name: string;
    date: string;
    isRecurring?: boolean;
}

export interface LeavePolicies {
    annualLeaveDays: number;
    sickLeaveDays: number;
    casualLeaveDays: number;
    carryOverMaxDays: number;
}

export interface TaskPolicies {
    requireReviewForCompletion: boolean;
    allowEmployeeSelfAssign: boolean;
    autoOverdueGracePeriodHours: number;
}

export interface NotificationSettings {
    emailNotificationsEnabled: boolean;
    taskDueRemindersHours: number;
    attendanceRemindersEnabled: boolean;
}

export interface ReviewPeriods {
    frequency: 'QUARTERLY' | 'BI_ANNUAL' | 'ANNUAL';
    nextReviewDate: string;
}

export interface OrganizationSettings {
    id: string;
    name: string;
    workingHoursPerDay: number;
    workDaysPerWeek: number;
    settings: {
        holidays: HolidayItem[];
        leavePolicies: LeavePolicies;
        taskPolicies: TaskPolicies;
        notificationSettings: NotificationSettings;
        reviewPeriods: ReviewPeriods;
    };
    counts: {
        users: number;
        departments: number;
        teams: number;
        tasks: number;
    };
    departments: Array<{
        id: string;
        name: string;
        code?: string | null;
        manager?: { id: string; name: string; email: string } | null;
        _count?: { users: number; teams: number };
    }>;
    teams: Array<{
        id: string;
        name: string;
        department?: { id: string; name: string } | null;
        teamLead?: { id: string; name: string; email: string } | null;
        _count?: { members: number };
    }>;
    createdAt: string;
    updatedAt: string;
}

export interface UpdateOrgSettingsDTO {
    name?: string;
    workingHoursPerDay?: number;
    workDaysPerWeek?: number;
    settings?: Partial<{
        holidays: HolidayItem[];
        leavePolicies: Partial<LeavePolicies>;
        taskPolicies: Partial<TaskPolicies>;
        notificationSettings: Partial<NotificationSettings>;
        reviewPeriods: Partial<ReviewPeriods>;
    }>;
}

export const settingsService = {
    /**
     * Get organization settings, working hours, holidays, and policies
     */
    getSettings: async (): Promise<OrganizationSettings> => {
        const res = await api.get('/settings');
        return res.data.data || res.data;
    },

    /**
     * Update organization settings (Admin only)
     */
    updateSettings: async (data: UpdateOrgSettingsDTO): Promise<OrganizationSettings> => {
        const res = await api.put('/settings', data);
        return res.data.data || res.data;
    },

    /**
     * Create department
     */
    createDepartment: async (data: { name: string; code?: string; managerId?: string }): Promise<any> => {
        const res = await api.post('/settings/departments', data);
        return res.data.data || res.data;
    },

    /**
     * Update department
     */
    updateDepartment: async (id: string, data: { name?: string; code?: string; managerId?: string }): Promise<any> => {
        const res = await api.put(`/settings/departments/${id}`, data);
        return res.data.data || res.data;
    },

    /**
     * Delete department
     */
    deleteDepartment: async (id: string): Promise<{ message: string }> => {
        const res = await api.delete(`/settings/departments/${id}`);
        return res.data.data || res.data;
    }
};
