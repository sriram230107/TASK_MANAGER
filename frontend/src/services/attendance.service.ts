import api from '../api/axios';

export type AttendanceState = 'NOT_CHECKED_IN' | 'WORKING' | 'ON_BREAK' | 'CHECKED_OUT';

export type AttendanceStatus =
    | 'PRESENT'
    | 'ABSENT'
    | 'LATE'
    | 'HALF_DAY'
    | 'LEAVE'
    | 'HOLIDAY'
    | 'WORK_FROM_HOME';

export interface WorkSession {
    id: string;
    attendanceId: string;
    type: 'WORKING' | 'BREAK';
    startTime: string;
    endTime?: string | null;
    durationMinutes?: number | null;
}

export interface AttendanceRecord {
    id: string;
    userId: string;
    date: string;
    checkIn?: string | null;
    checkOut?: string | null;
    breakDurationMinutes: number;
    totalWorkingMinutes: number;
    overtimeMinutes: number;
    status: AttendanceStatus;
    lateArrival: boolean;
    earlyDeparture: boolean;
    isWorkFromHome: boolean;
    notes?: string | null;
    createdAt: string;
    updatedAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    workSessions?: WorkSession[];
}

export interface AttendanceMetrics {
    totalDaysRecorded: number;
    presentDays: number;
    lateDays: number;
    halfDays: number;
    wfhDays: number;
    totalWorkingHours: number;
    totalOvertimeHours: number;
    totalBreakHours: number;
    averageDailyHours: number;
}

export interface AttendanceQueryParams {
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

export const attendanceService = {
    /**
     * Get current user's (or target's) attendance status for today
     */
    getTodayAttendance: async (userId?: string): Promise<{
        attendance: AttendanceRecord | null;
        state: AttendanceState;
        activeSession: WorkSession | null;
    }> => {
        const res = await api.get('/attendance/today', {
            params: userId ? { userId } : undefined
        });
        return res.data.data || res.data;
    },

    /**
     * Punch Check-In
     */
    checkIn: async (data: {
        isWorkFromHome?: boolean;
        notes?: string;
        userId?: string;
    }): Promise<AttendanceRecord> => {
        const res = await api.post('/attendance/check-in', data);
        return res.data.data || res.data;
    },

    /**
     * Start Break
     */
    startBreak: async (notes?: string): Promise<{
        attendanceId: string;
        activeSession: WorkSession;
        state: AttendanceState;
    }> => {
        const res = await api.post('/attendance/break/start', { notes });
        return res.data.data || res.data;
    },

    /**
     * End Break & Resume Work
     */
    endBreak: async (): Promise<{
        attendanceId: string;
        state: AttendanceState;
    }> => {
        const res = await api.post('/attendance/break/end');
        return res.data.data || res.data;
    },

    /**
     * Punch Check-Out
     */
    checkOut: async (notes?: string): Promise<AttendanceRecord> => {
        const res = await api.post('/attendance/check-out', { notes });
        return res.data.data || res.data;
    },

    /**
     * Query attendance history with role-scoping
     */
    listAttendance: async (params?: AttendanceQueryParams): Promise<{
        records: AttendanceRecord[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
    }> => {
        const res = await api.get('/attendance', { params });
        const records = Array.isArray(res.data.data) ? res.data.data : (res.data.records || []);
        const pagination = res.data.meta || {
            total: records.length,
            page: params?.page || 1,
            limit: params?.limit || 20,
            totalPages: 1
        };
        return { records, pagination };
    },

    /**
     * Get attendance aggregated statistics
     */
    getSummary: async (userId?: string, days = 30): Promise<{
        periodDays: number;
        metrics: AttendanceMetrics;
    }> => {
        const res = await api.get('/attendance/summary', {
            params: { ...(userId ? { userId } : {}), days }
        });
        return res.data.data || res.data;
    },

    /**
     * Update attendance record (Admin/Manager only)
     */
    updateRecord: async (id: string, data: UpdateAttendanceDTO): Promise<AttendanceRecord> => {
        const res = await api.patch(`/attendance/${id}`, data);
        return res.data.data || res.data;
    }
};
