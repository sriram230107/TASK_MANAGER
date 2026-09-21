import { Request, Response } from 'express';
import { ZodError } from 'zod';
import { prisma, withTenant, withoutTenant } from '../utils/prisma';
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
            const tokenHash = hashToken(rawToken);
            const record = await withoutTenant((unscoped) =>
                unscoped.refreshToken.findUnique({
                    where: { tokenHash },
                    include: { user: { select: { organizationId: true } } }
                })
            );

            if (record && !record.revokedAt && record.user?.organizationId) {
                await withTenant(record.user.organizationId, () =>
                    prisma.refreshToken.update({
                        where: { id: record.id },
                        data: { revokedAt: new Date() }
                    })
                );
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

        const tokenHash = hashToken(rawToken);
        const record = await withoutTenant((unscoped) =>
            unscoped.refreshToken.findUnique({
                where: { tokenHash },
                include: { user: { select: { id: true, email: true, name: true, role: true, organizationId: true, departmentId: true, deletedAt: true } } }
            })
        );

        if (!record || record.revokedAt || record.expiresAt < new Date()) {
            errorResponse(res, 'Unauthorized: Invalid or expired refresh token', 401);
            return;
        }

        const user = record.user;
        if (!user || user.deletedAt) {
            errorResponse(res, 'Unauthorized: User not found', 401);
            return;
        }

        // Execute rotation strictly inside user's tenant context
        const { newAccessToken, next } = await withTenant(user.organizationId, async () => {
            await prisma.refreshToken.update({
                where: { id: record.id },
                data: { revokedAt: new Date() }
            });

            const newAccessToken = signAccessToken(user as any);
            const next = createRefreshToken();

            await prisma.refreshToken.create({
                data: {
                    userId: user.id,
                    organizationId: user.organizationId,
                    tokenHash: next.hash,
                    expiresAt: next.expiresAt
                }
            });

            return { newAccessToken, next };
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
