import { CookieOptions, Response } from 'express';
import { config } from '../config/env';

const REFRESH_COOKIE = 'refreshToken';
const ACCESS_COOKIE = 'accessToken';

const baseOptions = (maxAgeMs: number): CookieOptions => ({
    httpOnly: true,
    secure: config.COOKIE_SECURE,
    sameSite: config.COOKIE_SAMESITE,
    domain: config.COOKIE_DOMAIN,
    path: '/',
    maxAge: maxAgeMs,
});

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string): void => {
    res.cookie(REFRESH_COOKIE, refreshToken, baseOptions(config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000));
    res.cookie(ACCESS_COOKIE, accessToken, baseOptions(config.ACCESS_TOKEN_TTL_MINUTES * 60 * 1000));
};

export const clearAuthCookies = (res: Response): void => {
    // Options must match those used when the cookie was set, or browsers keep it.
    const { maxAge: _ignored, ...opts } = baseOptions(0);
    res.clearCookie(REFRESH_COOKIE, opts);
    res.clearCookie(ACCESS_COOKIE, opts);
};
