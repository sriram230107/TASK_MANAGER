import { prisma } from '../utils/prisma';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { isAuthorizedForTarget } from '../utils/hierarchy';

export interface UserQueryFilters {
    page?: number;
    limit?: number;
    role?: Role;
    departmentId?: string;
    teamId?: string;
    search?: string;
}

export interface UpdateUserProfileDTO {
    name?: string;
    role?: Role;
    departmentId?: string | null;
    managerId?: string | null;
    teamLeadId?: string | null;
}

export interface CreateUserDTO {
    email: string;
    password: string;
    name: string;
    role: Role;
    departmentId?: string | null;
    managerId?: string | null;
    teamLeadId?: string | null;
}

/**
 * Retrieves a detailed user profile with reporting relationships and task statistics.
 */
export const getUserById = async (requestingUser: any, targetUserId: string) => {
    // 1. Verify authorization scope
    const isAuthorized = await isAuthorizedForTarget(requestingUser, targetUserId);
    if (!isAuthorized) {
        throw new Error('Forbidden: User is outside your organizational scope');
    }

    // 2. Fetch user details with hierarchy relations
    const user = await prisma.user.findFirst({
        where: {
            id: targetUserId,
            organizationId: requestingUser.organizationId,
            deletedAt: null
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            organizationId: true,
            departmentId: true,
            managerId: true,
            teamLeadId: true,
            createdAt: true,
            updatedAt: true,
            department: {
                select: { id: true, name: true, code: true }
            },
            manager: {
                select: { id: true, name: true, email: true, role: true }
            },
            teamLead: {
                select: { id: true, name: true, email: true, role: true }
            },
            memberships: {
                select: {
                    joinedAt: true,
                    team: {
                        select: {
                            id: true,
                            name: true,
                            departmentId: true,
                            teamLead: {
                                select: { id: true, name: true }
                            }
                        }
                    }
                }
            },
            directReports: {
                where: { deletedAt: null },
                select: { id: true, name: true, email: true, role: true }
            },
            ledEmployees: {
                where: { deletedAt: null },
                select: { id: true, name: true, email: true, role: true }
            },
            departmentsManaged: {
                select: { id: true, name: true, code: true }
            },
            ledTeams: {
                select: { id: true, name: true }
            }
        }
    });

    if (!user) {
        throw new Error('User not found');
    }

    // 3. Aggregate work stats
    const [totalTasks, completedTasks, inProgressTasks, underReviewTasks, activeGoals] = await Promise.all([
        prisma.task.count({
            where: {
                assignedToId: targetUserId,
                organizationId: requestingUser.organizationId,
                deletedAt: null
            }
        }),
        prisma.task.count({
            where: {
                assignedToId: targetUserId,
                organizationId: requestingUser.organizationId,
                status: 'COMPLETED',
                deletedAt: null
            }
        }),
        prisma.task.count({
            where: {
                assignedToId: targetUserId,
                organizationId: requestingUser.organizationId,
                status: 'IN_PROGRESS',
                deletedAt: null
            }
        }),
        prisma.task.count({
            where: {
                assignedToId: targetUserId,
                organizationId: requestingUser.organizationId,
                status: 'UNDER_REVIEW',
                deletedAt: null
            }
        }),
        prisma.goal.count({
            where: {
                ownerId: targetUserId,
                organizationId: requestingUser.organizationId,
                status: 'IN_PROGRESS'
            }
        })
    ]);

    return {
        ...user,
        stats: {
            totalTasks,
            completedTasks,
            inProgressTasks,
            underReviewTasks,
            activeGoals
        }
    };
};

/**
 * Lists users within the caller's organizational scope with filtering & pagination.
 */
export const listUsers = async (requestingUser: any, filters: UserQueryFilters) => {
    const where: any = {
        organizationId: requestingUser.organizationId,
        deletedAt: null
    };

    // Role-based scoping per spec Rule 6
    if (requestingUser.role === 'ADMIN') {
        // Org-wide access
    } else if (requestingUser.role === 'MANAGER') {
        where.OR = [
            { id: requestingUser.id },
            { managerId: requestingUser.id },
            ...(requestingUser.departmentId ? [{ departmentId: requestingUser.departmentId }] : []),
            { department: { managerId: requestingUser.id } },
            { memberships: { some: { team: { teamLead: { managerId: requestingUser.id } } } } }
        ];
    } else if (requestingUser.role === 'TEAM_LEAD') {
        where.OR = [
            { id: requestingUser.id },
            { teamLeadId: requestingUser.id },
            { memberships: { some: { team: { teamLeadId: requestingUser.id } } } }
        ];
    } else {
        // EMPLOYEE can view teammates and self
        where.OR = [
            { id: requestingUser.id },
            { memberships: { some: { team: { members: { some: { userId: requestingUser.id } } } } } }
        ];
    }

    if (filters.role) {
        where.role = filters.role;
    }

    if (filters.departmentId) {
        where.departmentId = filters.departmentId;
    }

    if (filters.teamId) {
        where.memberships = {
            some: { teamId: filters.teamId }
        };
    }

    if (filters.search) {
        where.AND = [
            ...(where.AND || []),
            {
                OR: [
                    { name: { contains: filters.search, mode: 'insensitive' } },
                    { email: { contains: filters.search, mode: 'insensitive' } }
                ]
            }
        ];
    }

    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(filters.limit) || 20));
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
        prisma.user.findMany({
            where,
            skip,
            take: limit,
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                departmentId: true,
                department: {
                    select: { id: true, name: true, code: true }
                },
                manager: {
                    select: { id: true, name: true }
                },
                teamLead: {
                    select: { id: true, name: true }
                },
                memberships: {
                    select: {
                        team: {
                            select: { id: true, name: true }
                        }
                    }
                },
                createdAt: true
            }
        }),
        prisma.user.count({ where })
    ]);

    return {
        users,
        pagination: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};

/**
 * Updates a user's profile information with role-based field restrictions.
 */
export const updateUserProfile = async (
    requestingUser: any,
    targetUserId: string,
    data: UpdateUserProfileDTO
) => {
    // 1. Check target existence within same org
    const targetUser = await prisma.user.findFirst({
        where: { id: targetUserId, organizationId: requestingUser.organizationId, deletedAt: null }
    });

    if (!targetUser) {
        throw new Error('User not found');
    }

    // 2. Permission guards
    const isSelf = requestingUser.id === targetUserId;
    const isAdmin = requestingUser.role === 'ADMIN';

    if (!isSelf && !isAdmin) {
        throw new Error('Forbidden: You can only update your own profile');
    }

    // Only Admin can modify organizational relationships and roles
    if (!isAdmin) {
        if (data.role || data.departmentId !== undefined || data.managerId !== undefined || data.teamLeadId !== undefined) {
            throw new Error('Forbidden: Only administrators can modify roles and organizational assignments');
        }
    }

    // 3. Validate references if Admin updates them
    if (isAdmin) {
        if (data.departmentId) {
            const dept = await prisma.department.findFirst({
                where: { id: data.departmentId, organizationId: requestingUser.organizationId }
            });
            if (!dept) throw new Error('Department not found in organization');
        }

        if (data.managerId) {
            if (data.managerId === targetUserId) {
                throw new Error('User cannot be their own manager');
            }
            const mgr = await prisma.user.findFirst({
                where: { id: data.managerId, organizationId: requestingUser.organizationId, deletedAt: null }
            });
            if (!mgr) throw new Error('Manager not found in organization');
        }

        if (data.teamLeadId) {
            if (data.teamLeadId === targetUserId) {
                throw new Error('User cannot be their own team lead');
            }
            const lead = await prisma.user.findFirst({
                where: { id: data.teamLeadId, organizationId: requestingUser.organizationId, deletedAt: null }
            });
            if (!lead) throw new Error('Team lead not found in organization');
        }
    }

    // 4. Update the user
    const updated = await prisma.user.update({
        where: { id: targetUserId },
        data: {
            ...(data.name ? { name: data.name } : {}),
            ...(isAdmin && data.role ? { role: data.role } : {}),
            ...(isAdmin && data.departmentId !== undefined ? { departmentId: data.departmentId } : {}),
            ...(isAdmin && data.managerId !== undefined ? { managerId: data.managerId } : {}),
            ...(isAdmin && data.teamLeadId !== undefined ? { teamLeadId: data.teamLeadId } : {})
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            organizationId: true,
            departmentId: true,
            managerId: true,
            teamLeadId: true,
            updatedAt: true,
            department: { select: { id: true, name: true, code: true } },
            manager: { select: { id: true, name: true, email: true } },
            teamLead: { select: { id: true, name: true, email: true } }
        }
    });

    // 5. Audit Log (Non-blocking)
    await prisma.auditLog.create({
        data: {
            userId: requestingUser.id,
            action: 'UPDATE_USER_PROFILE',
            entity: 'User',
            entityId: targetUserId,
            metadata: {
                updatedBy: requestingUser.email,
                changes: data
            } as any
        }
    }).catch(() => {});

    return updated;
};

/**
 * Creates a new user in the organization (Admin only).
 */
export const createUser = async (adminUser: any, data: CreateUserDTO) => {
    if (adminUser.role !== 'ADMIN') {
        throw new Error('Forbidden: Only administrators can create new users');
    }

    const existing = await prisma.user.findUnique({
        where: { email: data.email }
    });
    if (existing) {
        throw new Error('Email is already in use');
    }

    if (data.departmentId) {
        const dept = await prisma.department.findFirst({
            where: { id: data.departmentId, organizationId: adminUser.organizationId }
        });
        if (!dept) throw new Error('Department not found in organization');
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const newUser = await prisma.user.create({
        data: {
            email: data.email,
            passwordHash,
            name: data.name,
            role: data.role,
            organizationId: adminUser.organizationId,
            departmentId: data.departmentId || null,
            managerId: data.managerId || null,
            teamLeadId: data.teamLeadId || null
        },
        select: {
            id: true,
            name: true,
            email: true,
            role: true,
            departmentId: true,
            department: { select: { id: true, name: true } },
            manager: { select: { id: true, name: true } },
            teamLead: { select: { id: true, name: true } },
            createdAt: true
        }
    });

    await prisma.auditLog.create({
        data: {
            userId: adminUser.id,
            action: 'CREATE_USER',
            entity: 'User',
            entityId: newUser.id,
            metadata: {
                createdUserEmail: newUser.email,
                role: newUser.role
            } as any
        }
    }).catch(() => {});

    return newUser;
};

/**
 * Returns organizational hierarchy tree (Departments -> Teams -> Members).
 */
export const getOrgHierarchy = async (requestingUser: any) => {
    const departments = await prisma.department.findMany({
        where: { organizationId: requestingUser.organizationId },
        include: {
            manager: {
                select: { id: true, name: true, email: true, role: true }
            },
            teams: {
                include: {
                    teamLead: {
                        select: { id: true, name: true, email: true, role: true }
                    },
                    members: {
                        include: {
                            user: {
                                select: { id: true, name: true, email: true, role: true }
                            }
                        }
                    }
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    const unassignedUsers = await prisma.user.findMany({
        where: {
            organizationId: requestingUser.organizationId,
            departmentId: null,
            deletedAt: null
        },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: 'asc' }
    });

    return {
        departments,
        unassignedUsers
    };
};
