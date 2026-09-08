import api from '../api/axios';

export type TaskStatus =
    | 'DRAFT'
    | 'ASSIGNED'
    | 'ACCEPTED'
    | 'IN_PROGRESS'
    | 'ON_HOLD'
    | 'SUBMITTED'
    | 'UNDER_REVIEW'
    | 'COMPLETED'
    | 'CHANGES_REQUESTED'
    | 'CANCELLED'
    | 'OVERDUE';

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface TaskAttachment {
    id: string;
    fileName: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
}

export interface TaskComment {
    id: string;
    content: string;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        role?: string;
    };
}

export interface TaskHistory {
    id: string;
    action: string;
    fromStatus?: string | null;
    toStatus?: string | null;
    details?: string | null;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        role?: string;
    };
}

export interface Task {
    id: string;
    title: string;
    description?: string | null;
    priority: TaskPriority;
    status: TaskStatus;
    computedStatus?: TaskStatus;
    isOverdue?: boolean;
    progressPercent: number;
    estimatedHours?: number | null;
    actualHours?: number;
    startDate?: string | null;
    dueDate?: string | null;
    completedAt?: string | null;
    completionNotes?: string | null;
    reviewNotes?: string | null;
    dependencies?: string[];
    createdById: string;
    createdBy?: {
        id: string;
        name: string;
        email?: string;
        role?: string;
    };
    assignedToId?: string | null;
    assignedTo?: {
        id: string;
        name: string;
        email?: string;
        role?: string;
    } | null;
    assignedManagerId?: string | null;
    assignedManager?: { id: string; name: string } | null;
    assignedTeamLeadId?: string | null;
    assignedTeamLead?: { id: string; name: string } | null;
    assignedEmployeeId?: string | null;
    assignedEmployee?: { id: string; name: string } | null;
    departmentId?: string | null;
    department?: { id: string; name: string } | null;
    teamId?: string | null;
    team?: { id: string; name: string } | null;
    comments?: TaskComment[];
    attachments?: TaskAttachment[];
    history?: TaskHistory[];
    subTasks?: Task[];
    createdAt: string;
    updatedAt: string;
}

export interface CreateTaskPayload {
    title: string;
    description?: string;
    priority?: TaskPriority;
    status?: TaskStatus;
    assignedManagerId?: string;
    assignedTeamLeadId?: string;
    assignedEmployeeId?: string;
    assignedToId?: string;
    departmentId?: string;
    teamId?: string;
    parentTaskId?: string;
    estimatedHours?: number;
    startDate?: string | null;
    dueDate?: string | null;
}

export interface UpdateStatusPayload {
    status: TaskStatus;
    comment?: string;
    progressPercent?: number;
    hoursLogged?: number;
    completionNotes?: string;
    reviewNotes?: string;
}

export interface TaskQueryParams {
    page?: number;
    limit?: number;
    status?: string;
    priority?: TaskPriority;
    departmentId?: string;
    teamId?: string;
    assignedTo?: string;
    assignedEmployeeId?: string;
    assignedTeamLeadId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface TasksListResponse {
    data: Task[];
    meta?: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
}

export const taskService = {
    listTasks: async (params?: TaskQueryParams): Promise<TasksListResponse> => {
        const res = await api.get('/tasks', { params });
        // Handlers support both { data: [...], meta: {...} } and direct array
        const raw = res.data;
        if (Array.isArray(raw.data)) {
            return { data: raw.data, meta: raw.meta };
        } else if (Array.isArray(raw)) {
            return { data: raw };
        }
        return { data: raw.data || [], meta: raw.meta };
    },

    getTaskById: async (id: string): Promise<Task> => {
        const res = await api.get(`/tasks/${id}`);
        return res.data.data || res.data;
    },

    createTask: async (payload: CreateTaskPayload): Promise<Task> => {
        const res = await api.post('/tasks', payload);
        return res.data.data || res.data;
    },

    updateTask: async (id: string, payload: Partial<CreateTaskPayload>): Promise<Task> => {
        const res = await api.put(`/tasks/${id}`, payload);
        return res.data.data || res.data;
    },

    updateTaskStatus: async (id: string, payload: UpdateStatusPayload): Promise<Task> => {
        const res = await api.put(`/tasks/${id}/status`, payload);
        return res.data.data || res.data;
    },

    logProgress: async (id: string, data: { progressPercent: number; comment?: string; hoursLogged?: number }) => {
        const res = await api.post(`/tasks/${id}/updates`, data);
        return res.data.data || res.data;
    },

    delegateTask: async (id: string, data: { assignedTeamLeadId?: string; assignedEmployeeId?: string; teamId?: string; notes?: string }) => {
        const res = await api.post(`/tasks/${id}/delegate`, data);
        return res.data.data || res.data;
    },

    addComment: async (id: string, content: string): Promise<TaskComment> => {
        const res = await api.post(`/tasks/${id}/comments`, { content });
        return res.data.data || res.data;
    },

    getComments: async (id: string): Promise<TaskComment[]> => {
        const res = await api.get(`/tasks/${id}/comments`);
        return res.data.data || res.data;
    },

    deleteTask: async (id: string): Promise<void> => {
        await api.delete(`/tasks/${id}`);
    },

    uploadAttachment: async (id: string, file: File): Promise<TaskAttachment> => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await api.post(`/tasks/${id}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data.data || res.data;
    }
};
