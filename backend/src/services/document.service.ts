import fs from 'fs';
import path from 'path';
import { prisma } from '../utils/prisma';
import { Role, DocumentScope, DocumentCategory } from '@prisma/client';
import { CreateDocumentDTO, UpdateDocumentDTO, DocumentQueryParams } from '../validators/document.validator';
import { logAudit } from './audit.service';

export interface DocumentUserContext {
    id: string;
    role: Role;
    organizationId: string;
    departmentId?: string | null;
}

/**
 * Upload an organization or department document
 */
export const uploadDocument = async (
    user: DocumentUserContext,
    file: { filename: string; originalname: string; mimetype: string; size: number },
    data: CreateDocumentDTO
) => {
    // Only ADMIN and MANAGER can publish ORGANIZATION-wide policies or announcements
    if (data.accessScope === DocumentScope.ORGANIZATION && 
        (data.category === DocumentCategory.POLICY || data.category === DocumentCategory.ANNOUNCEMENT)) {
        if (user.role === Role.EMPLOYEE) {
            throw new Error('FORBIDDEN: Employees cannot publish organization-wide policies or announcements.');
        }
    }

    // Only ADMIN or MANAGER can set CONFIDENTIAL documents
    if (data.accessScope === DocumentScope.CONFIDENTIAL && user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
        throw new Error('FORBIDDEN: Only Administrators and Managers can set document scope to CONFIDENTIAL.');
    }

    let departmentId = data.departmentId || user.departmentId || null;

    if (departmentId) {
        const dept = await prisma.department.findUnique({
            where: { id: departmentId }
        });
        if (!dept || dept.organizationId !== user.organizationId) {
            throw new Error('Department not found in your organization.');
        }
    }

    const fileUrl = `/uploads/${file.filename}`;

    const document = await prisma.document.create({
        data: {
            title: data.title,
            description: data.description || null,
            fileUrl,
            fileName: file.originalname,
            mimeType: file.mimetype,
            sizeBytes: file.size,
            category: data.category || DocumentCategory.OTHER,
            accessScope: data.accessScope || DocumentScope.ORGANIZATION,
            departmentId,
            uploadedById: user.id,
            organizationId: user.organizationId
        },
        include: {
            uploadedBy: {
                select: { id: true, name: true, email: true, role: true }
            },
            department: {
                select: { id: true, name: true }
            }
        }
    });

    await logAudit({
        userId: user.id,
        action: 'UPLOAD_DOCUMENT',
        entity: 'Document',
        entityId: document.id,
        metadata: {
            title: document.title,
            category: document.category,
            accessScope: document.accessScope,
            fileName: document.fileName,
            sizeBytes: document.sizeBytes
        }
    });

    return document;
};

/**
 * List documents visible to the requesting user based on role and scope
 */
export const listDocuments = async (
    user: DocumentUserContext,
    query: DocumentQueryParams
) => {
    const { category, accessScope, departmentId, search, page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const where: any = {
        organizationId: user.organizationId
    };

    // Scoped visibility filter
    if (user.role === Role.ADMIN) {
        // Admins can see all organization documents
        if (departmentId) where.departmentId = departmentId;
    } else if (user.role === Role.MANAGER) {
        // Managers can see:
        // 1. ORGANIZATION scope
        // 2. DEPARTMENT scope for their own department
        // 3. Any document uploaded by themselves
        const scopeConditions: any[] = [
            { accessScope: DocumentScope.ORGANIZATION },
            { uploadedById: user.id }
        ];

        if (user.departmentId) {
            scopeConditions.push({
                departmentId: user.departmentId
            });
        }

        where.OR = scopeConditions;
    } else if (user.role === Role.TEAM_LEAD) {
        // Team leads can see:
        // 1. ORGANIZATION scope
        // 2. DEPARTMENT scope for their department (non-confidential)
        // 3. TEAM scope
        // 4. Any document uploaded by themselves
        const scopeConditions: any[] = [
            { accessScope: DocumentScope.ORGANIZATION },
            { accessScope: DocumentScope.TEAM },
            { uploadedById: user.id }
        ];

        if (user.departmentId) {
            scopeConditions.push({
                departmentId: user.departmentId,
                accessScope: { not: DocumentScope.CONFIDENTIAL }
            });
        }

        where.OR = scopeConditions;
    } else {
        // EMPLOYEE can see:
        // 1. ORGANIZATION scope
        // 2. DEPARTMENT scope (non-confidential)
        // 3. Documents uploaded by themselves (e.g. ID, certificates)
        const scopeConditions: any[] = [
            { accessScope: DocumentScope.ORGANIZATION },
            { uploadedById: user.id }
        ];

        if (user.departmentId) {
            scopeConditions.push({
                departmentId: user.departmentId,
                accessScope: { not: DocumentScope.CONFIDENTIAL }
            });
        }

        where.OR = scopeConditions;
    }

    if (category) {
        where.category = category;
    }

    if (accessScope) {
        // Extra check: prevent employee from requesting confidential directly
        if (accessScope === DocumentScope.CONFIDENTIAL && user.role !== Role.ADMIN && user.role !== Role.MANAGER) {
            where.accessScope = DocumentScope.CONFIDENTIAL;
            where.uploadedById = user.id; // only self-uploaded
        } else {
            where.accessScope = accessScope;
        }
    }

    if (search) {
        const searchCondition = [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { fileName: { contains: search, mode: 'insensitive' } }
        ];

        if (where.OR) {
            where.AND = [
                { OR: where.OR },
                { OR: searchCondition }
            ];
            delete where.OR;
        } else {
            where.OR = searchCondition;
        }
    }

    const [total, documents] = await Promise.all([
        prisma.document.count({ where }),
        prisma.document.findMany({
            where,
            include: {
                uploadedBy: {
                    select: { id: true, name: true, email: true, role: true }
                },
                department: {
                    select: { id: true, name: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit
        })
    ]);

    return {
        documents,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit) || 1
        }
    };
};

/**
 * Get a specific document by ID with access verification
 */
export const getDocumentById = async (
    user: DocumentUserContext,
    documentId: string
) => {
    const document = await prisma.document.findUnique({
        where: { id: documentId },
        include: {
            uploadedBy: {
                select: { id: true, name: true, email: true, role: true }
            },
            department: {
                select: { id: true, name: true }
            }
        }
    });

    if (!document || document.organizationId !== user.organizationId) {
        throw new Error('Document not found');
    }

    // Confidential guard
    if (document.accessScope === DocumentScope.CONFIDENTIAL) {
        if (user.role !== Role.ADMIN && 
            !(user.role === Role.MANAGER && document.departmentId === user.departmentId) &&
            document.uploadedById !== user.id) {
            throw new Error('FORBIDDEN: You do not have permission to view this confidential document.');
        }
    }

    // Department guard
    if (document.accessScope === DocumentScope.DEPARTMENT && document.departmentId) {
        if (user.role !== Role.ADMIN && user.departmentId !== document.departmentId && document.uploadedById !== user.id) {
            throw new Error('FORBIDDEN: You cannot view documents from other departments.');
        }
    }

    return document;
};

/**
 * Delete a document
 */
export const deleteDocument = async (
    user: DocumentUserContext,
    documentId: string
) => {
    const document = await prisma.document.findUnique({
        where: { id: documentId }
    });

    if (!document || document.organizationId !== user.organizationId) {
        throw new Error('Document not found');
    }

    // Permission check
    const isOwner = document.uploadedById === user.id;
    const isAdmin = user.role === Role.ADMIN;
    const isDeptManager = user.role === Role.MANAGER && document.departmentId === user.departmentId;

    if (!isAdmin && !isOwner && !isDeptManager) {
        throw new Error('FORBIDDEN: You do not have permission to delete this document.');
    }

    // Delete file from disk if path exists
    try {
        const filePath = path.join(process.cwd(), document.fileUrl.replace(/^\//, ''));
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {
        console.warn('Could not delete physical file for document:', documentId, e);
    }

    await prisma.document.delete({
        where: { id: documentId }
    });

    await logAudit({
        userId: user.id,
        action: 'DELETE_DOCUMENT',
        entity: 'Document',
        entityId: documentId,
        metadata: {
            title: document.title,
            fileName: document.fileName
        }
    });

    return { message: 'Document deleted successfully' };
};

/**
 * Task attachments query
 */
export const getTaskAttachments = async (
    user: DocumentUserContext,
    taskId: string
) => {
    const task = await prisma.task.findUnique({
        where: { id: taskId }
    });

    if (!task || task.organizationId !== user.organizationId) {
        throw new Error('Task not found');
    }

    const attachments = await prisma.taskAttachment.findMany({
        where: { taskId },
        include: {
            uploadedBy: {
                select: { id: true, name: true, email: true, role: true }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    return attachments;
};
