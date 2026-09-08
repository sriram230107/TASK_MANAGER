import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import * as documentService from '../services/document.service';
import { createDocumentSchema, documentQuerySchema } from '../validators/document.validator';
import { successResponse, errorResponse } from '../utils/response';

/**
 * Upload a document
 */
export const uploadDocument = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        if (!req.file) {
            errorResponse(res, 'File is required', 400);
            return;
        }

        const parseResult = createDocumentSchema.safeParse(req.body);
        if (!parseResult.success) {
            errorResponse(res, parseResult.error.issues[0].message, 400);
            return;
        }

        const document = await documentService.uploadDocument(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            {
                filename: req.file.filename,
                originalname: req.file.originalname,
                mimetype: req.file.mimetype,
                size: req.file.size
            },
            parseResult.data
        );

        successResponse(res, document, 201);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        console.error('Upload document error:', err);
        errorResponse(res, err.message || 'Failed to upload document', 400);
    }
};

/**
 * List documents
 */
export const listDocuments = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parseResult = documentQuerySchema.safeParse(req.query);
        if (!parseResult.success) {
            errorResponse(res, parseResult.error.issues[0].message, 400);
            return;
        }

        const result = await documentService.listDocuments(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            parseResult.data
        );

        successResponse(res, result.documents, 200, result.pagination);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        console.error('List documents error:', err);
        errorResponse(res, err.message || 'Failed to list documents', 500);
    }
};

/**
 * Get document by ID
 */
export const getDocumentById = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const { id } = req.params;
        const document = await documentService.getDocumentById(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            id as string
        );

        successResponse(res, document);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        if (err.message === 'Document not found') {
            errorResponse(res, err.message, 404);
            return;
        }
        console.error('Get document error:', err);
        errorResponse(res, err.message || 'Failed to retrieve document', 500);
    }
};

/**
 * Delete a document
 */
export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const { id } = req.params;
        const result = await documentService.deleteDocument(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            id as string
        );

        successResponse(res, result);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        if (err.message === 'Document not found') {
            errorResponse(res, err.message, 404);
            return;
        }
        console.error('Delete document error:', err);
        errorResponse(res, err.message || 'Failed to delete document', 500);
    }
};

/**
 * Get task attachments
 */
export const getTaskAttachments = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const { taskId } = req.params;
        const attachments = await documentService.getTaskAttachments(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            taskId as string
        );

        successResponse(res, attachments);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        if (err.message === 'Task not found') {
            errorResponse(res, err.message, 404);
            return;
        }
        console.error('Get task attachments error:', err);
        errorResponse(res, err.message || 'Failed to retrieve task attachments', 500);
    }
};

/**
 * Download document file with role-based access scope check
 */
export const downloadDocument = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const { id } = req.params;
        const document = await documentService.getDocumentById(
            {
                id: user.id,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            },
            id as string
        );

        if (!document) {
            errorResponse(res, 'Document not found', 404);
            return;
        }

        const filename = path.basename(document.fileUrl);
        const filePath = path.join(process.cwd(), 'uploads', filename);

        if (!fs.existsSync(filePath)) {
            errorResponse(res, 'Document file not found on disk', 404);
            return;
        }

        res.download(filePath, document.fileName);
    } catch (err: any) {
        if (err.message?.startsWith('FORBIDDEN')) {
            errorResponse(res, err.message, 403);
            return;
        }
        if (err.message === 'Document not found') {
            errorResponse(res, err.message, 404);
            return;
        }
        console.error('Download document error:', err);
        errorResponse(res, err.message || 'Failed to download document', 500);
    }
};

