import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
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
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
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

export const logout = (req: Request, res: Response): void => {
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
};

export const refresh = async (req: Request, res: Response): Promise<void> => {
    try {
        const refreshToken = req.cookies.refreshToken;
        if (!refreshToken) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || 'refresh_secret') as { id: string };

        const user = await prisma.user.findUnique({ where: { id: decoded.id, deletedAt: null } });
        if (!user) {
            res.status(401).json({ message: 'Unauthorized' });
            return;
        }

        const newAccessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET || 'access_secret', { expiresIn: '15m' });
        const newRefreshToken = jwt.sign({ id: user.id }, process.env.JWT_REFRESH_SECRET || 'refresh_secret', { expiresIn: '7d' });

        res.cookie('refreshToken', newRefreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        res.json({ accessToken: newAccessToken });
    } catch (error) {
        res.status(401).json({ message: 'Unauthorized: Invalid refresh token' });
    }
};
