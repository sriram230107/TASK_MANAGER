import api from '../api/axios';

export interface NotificationItem {
    id: string;
    userId: string;
    taskId?: string | null;
    type: string;
    message?: string | null;
    isRead: boolean;
    sentAt: string;
    task?: {
        id: string;
        title: string;
        priority: string;
        status: string;
    } | null;
}

export interface NotificationListResponse {
    notifications: NotificationItem[];
    unreadCount: number;
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export interface BroadcastDTO {
    targetScope: 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM';
    targetId?: string | null;
    message: string;
}

export const notificationService = {
    /**
     * List paginated notifications for the current authenticated user
     */
    async list(params?: { isRead?: boolean; page?: number; limit?: number }): Promise<NotificationListResponse> {
        const query = new URLSearchParams();
        if (params?.isRead !== undefined) query.append('isRead', String(params.isRead));
        if (params?.page) query.append('page', String(params.page));
        if (params?.limit) query.append('limit', String(params.limit));

        const response = await api.get(`/notifications?${query.toString()}`);
        return response.data.data || response.data;
    },

    /**
     * Fetch real-time unread notification count
     */
    async getUnreadCount(): Promise<number> {
        const response = await api.get('/notifications/unread-count');
        const data = response.data.data || response.data;
        return data.unreadCount ?? 0;
    },

    /**
     * Mark a single notification as read
     */
    async markAsRead(id: string): Promise<NotificationItem> {
        const response = await api.patch(`/notifications/${id}/read`);
        return response.data.data || response.data;
    },

    /**
     * Mark all unread notifications as read in bulk
     */
    async markAllAsRead(): Promise<{ updatedCount: number; message: string }> {
        const response = await api.patch('/notifications/read-all');
        return response.data.data || response.data;
    },

    /**
     * Delete a single notification
     */
    async delete(id: string): Promise<{ success: boolean; message: string }> {
        const response = await api.delete(`/notifications/${id}`);
        return response.data.data || response.data;
    },

    /**
     * Clear all read notifications
     */
    async clearRead(): Promise<{ deletedCount: number; message: string }> {
        const response = await api.delete('/notifications/clear-read');
        return response.data.data || response.data;
    },

    /**
     * Broadcast an announcement (Admin, Manager, or Team Lead)
     */
    async broadcast(data: BroadcastDTO): Promise<{ count: number; message: string }> {
        const response = await api.post('/notifications/broadcast', data);
        return response.data.data || response.data;
    }
};
