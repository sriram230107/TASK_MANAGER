import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { prisma } from '../../utils/prisma';
import { config } from '../../config/env';
import app from '../../app';
import { Role } from '@prisma/client';

export { app };

export const createTestOrg = async (name = 'Test Org') => {
    return prisma.organization.create({
        data: {
            name,
            settings: { timezone: 'UTC' }
        }
    });
};

export const createTestUser = async (params: {
    orgId: string;
    role: Role;
    email: string;
    name?: string;
    departmentId?: string;
    managerId?: string;
    teamLeadId?: string;
    password?: string;
}) => {
    const passwordHash = await bcrypt.hash(params.password || 'TestPassword123!', 4);
    return prisma.user.create({
        data: {
            organizationId: params.orgId,
            email: params.email.toLowerCase(),
            name: params.name || params.email.split('@')[0],
            role: params.role,
            passwordHash,
            departmentId: params.departmentId || null,
            managerId: params.managerId || null,
            teamLeadId: params.teamLeadId || null
        }
    });
};

export const generateTestTokens = (user: { id: string; role: string; organizationId: string }) => {
    const accessToken = jwt.sign(
        { id: user.id, role: user.role, organizationId: user.organizationId },
        config.JWT_ACCESS_SECRET,
        { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
        { id: user.id, role: user.role, organizationId: user.organizationId },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
    );
    return { accessToken, refreshToken };
};
