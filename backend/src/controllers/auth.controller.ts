import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { loginSchema } from '../validators/auth.validator';
import * as authService from '../services/auth.service';
import { successResponse, errorResponse } from '../utils/response';

export const login = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = loginSchema.parse(req.body);
        const { user, accessToken, refreshToken } = await authService.loginUser(data);

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        // Set access token cookie as well to support browser-based file downloads and fallback auth
        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        });

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
        const statusCode = (error.message === 'Invalid credentials' || error.message?.includes('credentials')) ? 401 : 400;
        errorResponse(res, error.message || 'Login failed', statusCode);
    }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawToken = req.cookies.refreshToken;
        if (rawToken) {
            const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
            const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
            if (record && !record.revokedAt) {
                await prisma.refreshToken.update({
                    where: { id: record.id },
                    data: { revokedAt: new Date() }
                });
            }
        }
    } catch (err) { }

    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    successResponse(res, { message: 'Logged out successfully' });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawToken = req.cookies.refreshToken;
        if (!rawToken) {
            errorResponse(res, 'Unauthorized: No refresh token provided', 401);
            return;
        }

        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

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

        // Revoke the old refresh token
        await prisma.refreshToken.update({
            where: { id: record.id },
            data: { revokedAt: new Date() }
        });

        const newAccessToken = jwt.sign(
            { id: user.id, role: user.role, organizationId: user.organizationId },
            process.env.JWT_ACCESS_SECRET as string,
            { expiresIn: '15m' }
        );

        const newRawToken = crypto.randomBytes(40).toString('hex');
        const newHash = crypto.createHash('sha256').update(newRawToken).digest('hex');
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        await prisma.refreshToken.create({
            data: { userId: user.id, tokenHash: newHash, expiresAt }
        });

        res.cookie('refreshToken', newRawToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.cookie('accessToken', newAccessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 15 * 60 * 1000
        });

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
