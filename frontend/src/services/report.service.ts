import api from '../api/axios';

export type ReportType = 'overview' | 'tasks' | 'attendance' | 'performance' | 'workload';
export type ReportScope = 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'EMPLOYEE';

export interface ReportQueryParams {
    type?: ReportType;
    scope?: ReportScope;
    scopeId?: string;
    startDate?: string;
    endDate?: string;
    format?: 'json' | 'csv' | 'pdf';
}

export interface TaskSummary {
    scopeLabel: string;
    totalTasks: number;
    completedCount: number;
    inProgressCount: number;
    overdueCount: number;
    completionRate: number;
    onTimeRate: number;
    totalEstimatedHours: number;
    totalActualHours: number;
    avgCompletionHours: number;
}

export interface AttendanceSummary {
    scopeLabel: string;
    totalRecords: number;
    presentDays: number;
    wfhDays: number;
    lateArrivals: number;
    halfDays: number;
    leaveDays: number;
    absentDays: number;
    earlyDepartures: number;
    attendanceConsistencyRate: number;
    totalWorkingHours: number;
    totalOvertimeHours: number;
    totalBreakHours: number;
}

export interface PerformanceSummary {
    scopeLabel: string;
    totalReviews: number;
    averageRating: number;
    totalGoals: number;
    achievedGoals: number;
    inProgressGoals: number;
    goalsAchievedRate: number;
}

export interface WorkloadSummary {
    scopeLabel: string;
    totalEmployees: number;
    totalActiveTasks: number;
    avgTasksPerEmployee: number;
    overloadedCount: number;
    balancedCount: number;
    underutilizedCount: number;
}

export interface OverviewReportData {
    type: 'overview';
    scope: ReportScope;
    scopeLabel: string;
    period: { start: string; end: string };
    tasks: TaskSummary;
    attendance: AttendanceSummary;
    performance: PerformanceSummary;
    workload: WorkloadSummary;
}

export interface TaskReportData {
    type: 'tasks';
    scope: ReportScope;
    scopeLabel: string;
    period: { start: string; end: string };
    summary: TaskSummary;
    statusBreakdown: Record<string, number>;
    priorityBreakdown: Record<string, number>;
    topAssignees: Array<{ name: string; total: number; completed: number }>;
    rawData: Array<{
        id: string;
        title: string;
        status: string;
        priority: string;
        assignee: string;
        team: string;
        department: string;
        estimatedHours: number;
        actualHours: number;
        dueDate: string;
        completedAt: string;
    }>;
}

export interface AttendanceReportData {
    type: 'attendance';
    scope: ReportScope;
    scopeLabel: string;
    period: { start: string; end: string };
    summary: AttendanceSummary;
    employeeBreakdown: Array<{
        name: string;
        attendanceRate: number;
        workingHours: number;
        overtimeHours: number;
    }>;
    rawData: Array<{
        id: string;
        date: string;
        employee: string;
        department: string;
        status: string;
        checkIn: string;
        checkOut: string;
        workingHours: number;
        overtimeHours: number;
        isLate: string;
    }>;
}

export interface PerformanceReportData {
    type: 'performance';
    scope: ReportScope;
    scopeLabel: string;
    period: { start: string; end: string };
    summary: PerformanceSummary;
    ratingDistribution: Record<string, number>;
    rawData: Array<{
        id: string;
        employee: string;
        reviewer: string;
        rating: number;
        cadence?: string;
        taskCompletionRate: any;
        onTimeRate: any;
        attendanceConsistency: any;
        date: string;
    }>;
}

export interface WorkloadReportData {
    type: 'workload';
    scope: ReportScope;
    scopeLabel: string;
    summary: WorkloadSummary;
    workloadList: Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        department: string;
        activeTasks: number;
        urgentTasks: number;
        estimatedHours: number;
        actualHours: number;
        status: 'OVERLOADED' | 'BALANCED' | 'UNDERUTILIZED';
    }>;
    rawData: Array<any>;
}

export type ReportResponseData =
    | OverviewReportData
    | TaskReportData
    | AttendanceReportData
    | PerformanceReportData
    | WorkloadReportData;

export const reportService = {
    /**
     * Fetch JSON report data with active scope and filters
     */
    async getReport(params: ReportQueryParams): Promise<ReportResponseData> {
        const query = new URLSearchParams();
        if (params.type) query.append('type', params.type);
        if (params.scope) query.append('scope', params.scope);
        if (params.scopeId) query.append('scopeId', params.scopeId);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        query.append('format', 'json');

        const response = await api.get(`/reports?${query.toString()}`);
        return response.data.data || response.data;
    },

    /**
     * Download CSV report directly from backend endpoint
     */
    async downloadCsvReport(params: ReportQueryParams): Promise<void> {
        const query = new URLSearchParams();
        if (params.type) query.append('type', params.type);
        if (params.scope) query.append('scope', params.scope);
        if (params.scopeId) query.append('scopeId', params.scopeId);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        query.append('format', 'csv');

        const response = await api.get(`/reports?${query.toString()}`, {
            responseType: 'blob'
        });

        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${params.type || 'overview'}-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    },

    /**
     * Download PDF report directly from backend endpoint
     */
    async downloadPdfReport(params: ReportQueryParams): Promise<void> {
        const query = new URLSearchParams();
        if (params.type) query.append('type', params.type);
        if (params.scope) query.append('scope', params.scope);
        if (params.scopeId) query.append('scopeId', params.scopeId);
        if (params.startDate) query.append('startDate', params.startDate);
        if (params.endDate) query.append('endDate', params.endDate);
        query.append('format', 'pdf');

        const response = await api.get(`/reports?${query.toString()}`, {
            responseType: 'blob'
        });

        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${params.type || 'overview'}-${new Date().toISOString().split('T')[0]}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }
};
