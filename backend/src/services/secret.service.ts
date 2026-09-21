import { prisma } from '../utils/prisma';
import { encryptSecret, decryptSecret } from '../utils/crypto';
import { logAudit } from './audit.service';

export interface IntegrationStatus {
    smtpConfigured: boolean;
    aiConfigured: boolean;
}

/**
 * Returns the integration configuration status for an organization.
 * NEVER returns credentials or ciphertexts.
 */
export const getIntegrationStatus = async (organizationId: string): Promise<IntegrationStatus> => {
    const secrets = await prisma.organizationSecret.findMany({
        where: { organizationId },
        select: { key: true }
    });

    const keySet = new Set(secrets.map((s) => s.key));

    return {
        smtpConfigured: keySet.has('SMTP_PASSWORD'),
        aiConfigured: keySet.has('AI_API_KEY')
    };
};

/**
 * Saves or updates SMTP password in OrganizationSecret.
 * Write-only via API.
 */
export const setSmtpSecret = async (admin: any, password: string): Promise<{ success: true }> => {
    if (admin.role !== 'ADMIN') {
        throw new Error('FORBIDDEN: Only administrators can configure organization integration secrets.');
    }

    const encrypted = encryptSecret(password);

    await prisma.organizationSecret.upsert({
        where: {
            organizationId_key: {
                organizationId: admin.organizationId,
                key: 'SMTP_PASSWORD'
            }
        },
        create: {
            organizationId: admin.organizationId,
            key: 'SMTP_PASSWORD',
            valueEncrypted: encrypted,
            keyVersion: 1
        },
        update: {
            valueEncrypted: encrypted,
            keyVersion: 1
        }
    });

    await logAudit({
        userId: admin.id,
        organizationId: admin.organizationId,
        action: 'UPDATE',
        entity: 'OrganizationSecret',
        entityId: admin.organizationId,
        metadata: { key: 'SMTP_PASSWORD', configured: true }
    });

    return { success: true };
};

/**
 * Saves or updates AI API key in OrganizationSecret.
 * Write-only via API.
 */
export const setAiSecret = async (admin: any, apiKey: string): Promise<{ success: true }> => {
    if (admin.role !== 'ADMIN') {
        throw new Error('FORBIDDEN: Only administrators can configure organization integration secrets.');
    }

    const encrypted = encryptSecret(apiKey);

    await prisma.organizationSecret.upsert({
        where: {
            organizationId_key: {
                organizationId: admin.organizationId,
                key: 'AI_API_KEY'
            }
        },
        create: {
            organizationId: admin.organizationId,
            key: 'AI_API_KEY',
            valueEncrypted: encrypted,
            keyVersion: 1
        },
        update: {
            valueEncrypted: encrypted,
            keyVersion: 1
        }
    });

    await logAudit({
        userId: admin.id,
        organizationId: admin.organizationId,
        action: 'UPDATE',
        entity: 'OrganizationSecret',
        entityId: admin.organizationId,
        metadata: { key: 'AI_API_KEY', configured: true }
    });

    return { success: true };
};

/**
 * Internal method to decrypt an organization secret for background workers / email dispatchers.
 */
export const getDecryptedSecret = async (organizationId: string, key: string): Promise<string | null> => {
    const record = await prisma.organizationSecret.findUnique({
        where: {
            organizationId_key: {
                organizationId,
                key
            }
        }
    });

    if (!record) return null;
    return decryptSecret(record.valueEncrypted);
};
