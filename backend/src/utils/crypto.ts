import crypto from 'node:crypto';
import { config } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const AUTH_TAG_LENGTH = 16; // 128-bit auth tag
const TEST_KEY_HEX = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

const getEncryptionKey = (): Buffer => {
    if (config.NODE_ENV === 'test') {
        const testKey = config.ENCRYPTION_KEY || TEST_KEY_HEX;
        return Buffer.from(testKey, 'hex');
    }

    if (!config.ENCRYPTION_KEY) {
        throw new Error(
            'Configuration error: ENCRYPTION_KEY is not set. ' +
            'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }

    return Buffer.from(config.ENCRYPTION_KEY, 'hex');
};

/**
 * Encrypts plaintext using AES-256-GCM.
 * Output format: "iv:authTag:ciphertext" (all hex encoded)
 */
export const encryptSecret = (plaintext: string): string => {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
};

/**
 * Decrypts a stored secret string formatted as "iv:authTag:ciphertext".
 */
export const decryptSecret = (encryptedPayload: string): string => {
    const key = getEncryptionKey();
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted payload format. Expected "iv:authTag:ciphertext"');
    }

    const [ivHex, authTagHex, ciphertextHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
};
