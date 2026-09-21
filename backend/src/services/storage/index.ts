import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { StorageDriver } from './storage.interface';
import { LocalStorageDriver } from './local.driver';

export * from './storage.interface';
export * from './local.driver';
export * from './magic-bytes';

export const storage: StorageDriver = new LocalStorageDriver();

/**
 * Sanitizes an original filename to prevent path characters and unsafe symbols.
 */
export const sanitizeFileName = (originalName: string): string => {
    const base = path.basename(originalName);
    return base.replace(/[^a-zA-Z0-9._-]/g, '_');
};

/**
 * Generates an organization-scoped, year-partitioned storage key.
 * Format: org/<organizationId>/<yyyy>/<uuid>-<safe-name>
 */
export const buildStorageKey = (organizationId: string, originalName: string): string => {
    const year = new Date().getUTCFullYear();
    const safeName = sanitizeFileName(originalName);
    const uuid = randomUUID();
    return `org/${organizationId}/${year}/${uuid}-${safeName}`;
};
