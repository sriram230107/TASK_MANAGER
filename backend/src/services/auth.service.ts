import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../utils/prisma';
import { z } from 'zod';
import { loginSchema, adminCreateUserSchema } from '../validators/auth.validator';

export const loginUser = async (data: z.infer<typeof loginSchema>) => {
    const user = await prisma.user.findFirst({ where: { email: data.email, deletedAt: null } });
    if (!user) throw new Error('Invalid credentials');

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) throw new Error('Invalid credentials');

    const accessToken = jwt.sign(
        { id: user.id, role: user.role, organizationId: user.organizationId },
        process.env.JWT_ACCESS_SECRET as string,
        { expiresIn: '15m' }
    );

    const rawToken = crypto.randomBytes(40).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refreshToken.create({
        data: { userId: user.id, tokenHash, expiresAt }
    });

    return { user, accessToken, refreshToken: rawToken };
};

export const createUserByAdmin = async (admin: any, data: z.infer<typeof adminCreateUserSchema>) => {
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('Email already in use');

    // Rule 6: The new user must belong to the authenticated admin's organization
    const organizationId = admin.organizationId;

    // Validate departmentId if provided
    if (data.departmentId) {
        const dept = await prisma.department.findFirst({
            where: { id: data.departmentId, organizationId }
        });
        if (!dept) throw new Error('Department not found in your organization');
    }

    // Validate managerId if provided
    if (data.managerId) {
        const manager = await prisma.user.findFirst({
            where: { id: data.managerId, organizationId, deletedAt: null }
        });

        if (!manager) throw new Error('Manager not found in your organization');

        if (data.role === 'ADMIN') {
            throw new Error('ADMIN cannot have a manager');
        }

        if (data.role === 'TEAM_LEAD' && manager.role !== 'MANAGER' && manager.role !== 'ADMIN') {
            throw new Error('A TEAM_LEAD must report to a MANAGER or ADMIN');
        }
    }

    // Validate teamLeadId if provided
    if (data.teamLeadId) {
        const lead = await prisma.user.findFirst({
            where: { id: data.teamLeadId, organizationId, deletedAt: null }
        });

        if (!lead) throw new Error('Team Lead not found in your organization');
        if (lead.role !== 'TEAM_LEAD') throw new Error('Designated lead must have TEAM_LEAD role');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const user = await prisma.user.create({
        data: {
            email: data.email,
            passwordHash,
            name: data.name,
            role: data.role,
            organizationId,
            departmentId: data.departmentId || null,
            managerId: data.managerId || null,
            teamLeadId: data.teamLeadId || null
        }
    });

    return user;
};
