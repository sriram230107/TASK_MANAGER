import api from '../api/axios';

export type DocumentCategory = 'POLICY' | 'ANNOUNCEMENT' | 'CONTRACT' | 'IDENTIFICATION' | 'REPORT' | 'OTHER';
export type DocumentScope = 'ORGANIZATION' | 'DEPARTMENT' | 'TEAM' | 'CONFIDENTIAL';

export interface DocumentItem {
    id: string;
    title: string;
    description?: string | null;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    category: DocumentCategory;
    accessScope: DocumentScope;
    departmentId?: string | null;
    department?: {
        id: string;
        name: string;
    } | null;
    uploadedById: string;
    uploadedBy: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
    createdAt: string;
    updatedAt: string;
}

export interface DocumentQueryParams {
    category?: DocumentCategory;
    accessScope?: DocumentScope;
    departmentId?: string;
    search?: string;
    page?: number;
    limit?: number;
}

export interface UploadDocumentDTO {
    title: string;
    description?: string;
    category: DocumentCategory;
    accessScope: DocumentScope;
    departmentId?: string;
    file: File;
}

export interface TaskAttachmentItem {
    id: string;
    taskId: string;
    fileUrl: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    createdAt: string;
    uploadedBy: {
        id: string;
        name: string;
        email: string;
        role: string;
    };
}

export const documentService = {
    /**
     * List documents with optional filters and pagination
     */
    list: async (params?: DocumentQueryParams): Promise<{
        documents: DocumentItem[];
        pagination: { total: number; page: number; limit: number; totalPages: number };
    }> => {
        const res = await api.get('/documents', { params });
        const documents = Array.isArray(res.data.data) ? res.data.data : (res.data.documents || []);
        const pagination = res.data.meta || {
            total: documents.length,
            page: params?.page || 1,
            limit: params?.limit || 20,
            totalPages: 1
        };
        return { documents, pagination };
    },

    /**
     * Get document by ID
     */
    getById: async (id: string): Promise<DocumentItem> => {
        const res = await api.get(`/documents/${id}`);
        return res.data.data || res.data;
    },

    /**
     * Upload a new document with multipart file
     */
    upload: async (data: UploadDocumentDTO): Promise<DocumentItem> => {
        const formData = new FormData();
        formData.append('title', data.title);
        if (data.description) formData.append('description', data.description);
        formData.append('category', data.category);
        formData.append('accessScope', data.accessScope);
        if (data.departmentId) formData.append('departmentId', data.departmentId);
        formData.append('file', data.file);

        const res = await api.post('/documents', formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
        });
        return res.data.data || res.data;
    },

    /**
     * Delete document by ID
     */
    delete: async (id: string): Promise<{ message: string }> => {
        const res = await api.delete(`/documents/${id}`);
        return res.data.data || res.data;
    },

    /**
     * Download document file with authenticated session
     */
    download: async (id: string, fileName: string): Promise<void> => {
        const res = await api.get(`/documents/${id}/download`, {
            responseType: 'blob'
        });
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    /**
     * Get attachments for a specific task
     */
    getTaskAttachments: async (taskId: string): Promise<TaskAttachmentItem[]> => {
        const res = await api.get(`/documents/tasks/${taskId}/attachments`);
        return Array.isArray(res.data.data) ? res.data.data : (res.data || []);
    }
};
