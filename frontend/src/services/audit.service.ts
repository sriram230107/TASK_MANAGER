import api from '../api/axios';

export interface AuditLogItem {
    id: string;
    userId?: string | null;
    action: string;
    entity: string;
    entityId: string;
    metadata?: Record<string, any> | null;
    ipAddress?: string | null;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
        role: string;
        department?: {
            id: string;
            name: string;
        } | null;
    } | null;
}

export interface AuditQueryParams {
    entity?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface AuditSummary {
    totalEvents: number;
    last24hEvents: number;
    last7dEvents: number;
    criticalActions: number;
}

export const auditService = {
    /**
     * List audit logs (Admin org-wide, Manager department/direct reports)
     */
    list: async (params?: AuditQueryParams): Promise<{
        logs: AuditLogItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
    }> => {
        const res = await api.get('/audit', { params });
        const logs = Array.isArray(res.data.data) ? res.data.data : (res.data.logs || []);
        const pagination = res.data.meta || {
            total: logs.length,
            page: params?.page || 1,
            limit: params?.limit || 30,
            totalPages: 1
        };
        return { logs, pagination };
    },

    /**
     * Get summary metrics
     */
    getSummary: async (): Promise<AuditSummary> => {
        const res = await api.get('/audit/summary');
        return res.data.data || res.data;
    }
};
