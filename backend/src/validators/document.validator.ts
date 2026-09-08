import { z } from 'zod';
import { DocumentCategory, DocumentScope } from '@prisma/client';

export const createDocumentSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters'),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
    category: z.nativeEnum(DocumentCategory).default(DocumentCategory.OTHER),
    accessScope: z.nativeEnum(DocumentScope).default(DocumentScope.ORGANIZATION),
    departmentId: z.string().uuid('Invalid department ID').optional().nullable()
});

export const updateDocumentSchema = z.object({
    title: z.string().min(1, 'Title is required').max(200, 'Title cannot exceed 200 characters').optional(),
    description: z.string().max(1000, 'Description cannot exceed 1000 characters').optional().nullable(),
    category: z.nativeEnum(DocumentCategory).optional(),
    accessScope: z.nativeEnum(DocumentScope).optional(),
    departmentId: z.string().uuid('Invalid department ID').optional().nullable()
});

export const documentQuerySchema = z.object({
    category: z.nativeEnum(DocumentCategory).optional(),
    accessScope: z.nativeEnum(DocumentScope).optional(),
    departmentId: z.string().uuid().optional(),
    search: z.string().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20)
});

export type CreateDocumentDTO = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentDTO = z.infer<typeof updateDocumentSchema>;
export type DocumentQueryParams = z.infer<typeof documentQuerySchema>;
