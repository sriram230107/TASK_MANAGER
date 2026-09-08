import api from '../api/axios';

export type PayrollStatus = 'DRAFT' | 'PROCESSED' | 'PAID';

export interface PayrollRecord {
    id: string;
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    allowances: number;
    deductions: number;
    overtimePay: number;
    bonuses: number;
    netSalary: number;
    payslipUrl?: string | null;
    status: PayrollStatus;
    createdAt: string;
    updatedAt: string;
    employee: {
        id: string;
        name: string;
        email: string;
        role: string;
        department?: {
            id: string;
            name: string;
        } | null;
    };
}

export interface PayrollSummary {
    totalRecords: number;
    totalNetPayout: number;
    totalBaseSalary: number;
    totalAllowances: number;
    totalDeductions: number;
    totalOvertimePay: number;
    totalBonuses: number;
}

export interface PayrollListResponse {
    records: PayrollRecord[];
    summary: PayrollSummary;
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface CreatePayrollDTO {
    employeeId: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    allowances?: number;
    deductions?: number;
    overtimePay?: number;
    bonuses?: number;
    status?: PayrollStatus;
    autoComputeOvertime?: boolean;
}

export interface UpdatePayrollDTO {
    baseSalary?: number;
    allowances?: number;
    deductions?: number;
    overtimePay?: number;
    bonuses?: number;
    status?: PayrollStatus;
}

export const payrollService = {
    /**
     * List payroll records with server-side access scope
     */
    async list(params?: {
        employeeId?: string;
        departmentId?: string;
        status?: PayrollStatus;
        periodStart?: string;
        periodEnd?: string;
        page?: number;
        limit?: number;
    }): Promise<PayrollListResponse> {
        const query = new URLSearchParams();
        if (params?.employeeId) query.append('employeeId', params.employeeId);
        if (params?.departmentId) query.append('departmentId', params.departmentId);
        if (params?.status) query.append('status', params.status);
        if (params?.periodStart) query.append('periodStart', params.periodStart);
        if (params?.periodEnd) query.append('periodEnd', params.periodEnd);
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));

        const response = await api.get(`/payroll?${query.toString()}`);
        return response.data.data || response.data;
    },

    /**
     * Get specific payroll record
     */
    async getById(id: string): Promise<PayrollRecord> {
        const response = await api.get(`/payroll/${id}`);
        return response.data.data || response.data;
    },

    /**
     * Create a new payroll record (Admin only)
     */
    async create(data: CreatePayrollDTO): Promise<PayrollRecord> {
        const response = await api.post('/payroll', data);
        return response.data.data || response.data;
    },

    /**
     * Update an existing payroll record (Admin only)
     */
    async update(id: string, data: UpdatePayrollDTO): Promise<PayrollRecord> {
        const response = await api.patch(`/payroll/${id}`, data);
        return response.data.data || response.data;
    },

    /**
     * Delete a draft payroll record (Admin only)
     */
    async delete(id: string): Promise<{ success: boolean; message: string }> {
        const response = await api.delete(`/payroll/${id}`);
        return response.data.data || response.data;
    },

    /**
     * Bulk transition payroll status (Admin only)
     */
    async bulkProcess(recordIds: string[], status: 'PROCESSED' | 'PAID'): Promise<{ updatedCount: number; message: string }> {
        const response = await api.post('/payroll/bulk-process', { recordIds, status });
        return response.data.data || response.data;
    },

    /**
     * Get printable payslip HTML content
     */
    async getPayslipHtml(id: string): Promise<string> {
        const response = await api.get(`/payroll/${id}/payslip`);
        const data = response.data.data || response.data;
        return data.html;
    }
};
