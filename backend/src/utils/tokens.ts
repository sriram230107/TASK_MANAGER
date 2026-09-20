import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';

interface TokenSubject {
    id: string;
    role: string;
    organizationId: string;
}

export const signAccessToken = (user: TokenSubject): string =>
    jwt.sign({ id: user.id, role: user.role, organizationId: user.organizationId }, config.JWT_ACCESS_SECRET, {
        expiresIn: `${config.ACCESS_TOKEN_TTL_MINUTES}m`,
    });

/** Creates an opaque refresh token. Only the hash is ever stored in the database. */
export const createRefreshToken = () => {
    const raw = crypto.randomBytes(40).toString('hex');
    const hash = crypto.createHash('sha256').update(raw).digest('hex');
    const expiresAt = new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    return { raw, hash, expiresAt };
};

export const hashToken = (raw: string): string => crypto.createHash('sha256').update(raw).digest('hex');
