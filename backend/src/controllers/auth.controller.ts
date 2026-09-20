import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { prisma } from '../utils/prisma';
import { loginSchema } from '../validators/auth.validator';
import * as authService from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';
import { setAuthCookies, clearAuthCookies } from '../utils/cookies';
import { signAccessToken, createRefreshToken, hashToken } from '../utils/tokens';

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = loginSchema.parse(req.body);
        const { user, accessToken, refreshToken } = await authService.loginUser(data);

        // The access token cookie also supports browser-based file downloads.
        setAuthCookies(res, accessToken, refreshToken);

        successResponse(res, {
            accessToken,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                organizationId: user.organizationId,
                departmentId: user.departmentId
            }
        });
    } catch (error: any) {
        if (error instanceof ZodError) {
            errorResponse(res, 'Please enter a valid email address and password', 400);
            return;
        }
        if (error?.message === 'Invalid credentials') {
            errorResponse(res, 'Invalid credentials', 401);
            return;
        }
        // Anything else is unexpected: log it, but never expose internals to the client.
        console.error('Login error:', error);
        errorResponse(res, 'Login failed. Please try again.', 500);
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawToken = req.cookies.refreshToken;
        if (rawToken) {
            const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });
            if (record && !record.revokedAt) {
                await prisma.refreshToken.update({
                    where: { id: record.id },
                    data: { revokedAt: new Date() }
                });
            }
        }
    } catch (err) { }

    clearAuthCookies(res);
    successResponse(res, { message: 'Logged out successfully' });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawToken = req.cookies.refreshToken;
        if (!rawToken) {
            errorResponse(res, 'Unauthorized: No refresh token provided', 401);
            return;
        }

        const record = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(rawToken) } });

        if (!record || record.revokedAt || record.expiresAt < new Date()) {
            errorResponse(res, 'Unauthorized: Invalid or expired refresh token', 401);
            return;
        }

        const user = await prisma.user.findFirst({
            where: { id: record.userId, deletedAt: null }
        });
        if (!user) {
            errorResponse(res, 'Unauthorized: User not found', 401);
            return;
        }

        // Rotate: revoke the old refresh token and issue a new pair.
        await prisma.refreshToken.update({
            where: { id: record.id },
            data: { revokedAt: new Date() }
        });

        const newAccessToken = signAccessToken(user);
        const next = createRefreshToken();

        await prisma.refreshToken.create({
            data: { userId: user.id, tokenHash: next.hash, expiresAt: next.expiresAt }
        });

        setAuthCookies(res, newAccessToken, next.raw);

        successResponse(res, { accessToken: newAccessToken });
    } catch (error: any) {
        errorResponse(res, error.message || 'Unauthorized: Token refresh failed', 401);
    }
};

export const getMe = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        successResponse(res, {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            organizationId: user.organizationId,
            departmentId: user.departmentId,
            department: user.department,
            managerId: user.managerId,
            teamLeadId: user.teamLeadId
        });
    } catch (error: any) {
        errorResponse(res, error.message || 'Failed to fetch user profile', 500);
    }
};
