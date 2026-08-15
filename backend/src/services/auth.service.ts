import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { loginSchema, registerSchema } from '../validators/auth.validator';

export const loginUser = async (data: z.infer<typeof loginSchema>) => {
    const user = await prisma.user.findUnique({ where: { email: data.email, deletedAt: null } });
    if (!user) throw new Error('Invalid credentials');

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) throw new Error('Invalid credentials');

    const accessToken = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_ACCESS_SECRET as string, { expiresIn: '15m' });

    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
        data: { userId: user.id, tokenHash, expiresAt }
    });

    return { user, accessToken, refreshToken: rawToken };
};

export const registerUser = async (data: z.infer<typeof registerSchema>) => {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Email already in use');

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
        data: {
            email: data.email,
            passwordHash,
            name: data.name,
            role: data.role,
            organizationId: data.organizationId,
            managerId: data.managerId
        }
    });

    return user;
};
