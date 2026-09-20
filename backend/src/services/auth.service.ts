import bcrypt from 'bcrypt';
import { prisma } from '../utils/prisma';
import { signAccessToken, createRefreshToken } from '../utils/tokens';
import { z } from 'zod';
import { loginSchema, adminCreateUserSchema } from '../validators/auth.validator';

// Compared against when the email is unknown, so response time does not reveal
// which email addresses exist.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 10);

export const loginUser = async (data: z.infer<typeof loginSchema>) => {
    // Case-insensitive so accounts created with mixed-case emails keep working.
    const user = await prisma.user.findFirst({
        where: { email: { equals: data.email, mode: 'insensitive' }, deletedAt: null }
    });

    const isValid = await bcrypt.compare(data.password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !isValid) throw new Error('Invalid credentials');

    const accessToken = signAccessToken(user);
    const refresh = createRefreshToken();

    await prisma.refreshToken.create({
        data: { userId: user.id, tokenHash: refresh.hash, expiresAt: refresh.expiresAt }
    });

    return { user, accessToken, refreshToken: refresh.raw };
};

export const createUserByAdmin = async (admin: any, data: z.infer<typeof adminCreateUserSchema>) => {
    const existing = await prisma.user.findFirst({ where: { email: { equals: data.email, mode: 'insensitive' } } });
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
