import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { loginSchema, registerSchema } from '../validators/auth.validator';
import * as authService from '../services/auth.service';

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

        res.json({ accessToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const register = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = registerSchema.parse(req.body);
        const user = await authService.registerUser(data);
        res.status(201).json({ user: { id: user.id, email: user.email, name: user.name, role: user.role } });
    } catch (error: any) {
        res.status(400).json({ message: error.message });
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
    res.json({ message: 'Logged out successfully' });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
    try {
        const rawToken = req.cookies.refreshToken;
        if (!rawToken) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

        if (!record || record.revokedAt || record.expiresAt < new Date()) {
            res.status(401).json({ message: 'Unauthorized: Invalid or revoked refresh token' });
            return;
        }

        const user = await prisma.user.findUnique({ where: { id: record.userId, deletedAt: null } });
        if (!user) {
            res.status(401).json({ message: 'Unauthorized: User not found' });
            return;
        }

        await prisma.refreshToken.update({
            where: { id: record.id },
            data: { revokedAt: new Date() }
        });

        const newAccessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET as string, { expiresIn: '15m' });

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

        res.json({ accessToken: newAccessToken });
    } catch (error) {
        res.status(401).json({ message: 'Unauthorized: Invalid token payload' });
    }
};
