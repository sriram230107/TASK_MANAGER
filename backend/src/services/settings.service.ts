import { prisma } from '../utils/prisma';
import { Role } from '@prisma/client';
import { UpdateOrgSettingsDTO, CreateDepartmentDTO, UpdateDepartmentDTO } from '../validators/settings.validator';
import { logAudit } from './audit.service';

export interface SettingsUserContext {
    id: string;
    role: Role;
    organizationId: string;
    departmentId?: string | null;
}

export const DEFAULT_ORG_SETTINGS = {
    holidays: [
        { name: "New Year's Day", date: "2026-01-01", isRecurring: true },
        { name: "Memorial Day", date: "2026-05-25", isRecurring: true },
        { name: "Independence Day", date: "2026-07-04", isRecurring: true },
        { name: "Labor Day", date: "2026-09-07", isRecurring: true },
        { name: "Thanksgiving Day", date: "2026-11-26", isRecurring: true },
        { name: "Christmas Day", date: "2026-12-25", isRecurring: true }
    ],
    leavePolicies: {
        annualLeaveDays: 20,
        sickLeaveDays: 10,
        casualLeaveDays: 5,
        carryOverMaxDays: 5
    },
    taskPolicies: {
        requireReviewForCompletion: true,
        allowEmployeeSelfAssign: false,
        autoOverdueGracePeriodHours: 24
    },
    notificationSettings: {
        emailNotificationsEnabled: false,
        taskDueRemindersHours: 24,
        attendanceRemindersEnabled: true
    },
    reviewPeriods: {
        frequency: 'QUARTERLY',
        nextReviewDate: '2026-10-01'
    }
};

/**
 * Get organization settings, departments, teams, and policies
 * Accessible by all members of the organization
 */
export const getOrganizationSettings = async (user: SettingsUserContext) => {
    const organization = await prisma.organization.findUnique({
        where: { id: user.organizationId },
        include: {
            _count: {
                select: {
                    users: true,
                    departments: true,
                    teams: true,
                    tasks: true
                }
            },
            departments: {
                include: {
                    manager: {
                        select: { id: true, name: true, email: true }
                    },
                    _count: {
                        select: { users: true, teams: true }
                    }
                },
                orderBy: { name: 'asc' }
            },
            teams: {
                include: {
                    department: {
                        select: { id: true, name: true }
                    },
                    teamLead: {
                        select: { id: true, name: true, email: true }
                    },
                    _count: {
                        select: { members: true }
                    }
                },
                orderBy: { name: 'asc' }
            }
        }
    });

    if (!organization) {
        throw new Error('Organization not found');
    }

    // Merge default settings if empty
    const currentSettings = organization.settings ? (organization.settings as any) : {};
    const mergedSettings = {
        holidays: currentSettings.holidays || DEFAULT_ORG_SETTINGS.holidays,
        leavePolicies: { ...DEFAULT_ORG_SETTINGS.leavePolicies, ...(currentSettings.leavePolicies || {}) },
        taskPolicies: { ...DEFAULT_ORG_SETTINGS.taskPolicies, ...(currentSettings.taskPolicies || {}) },
        notificationSettings: { ...DEFAULT_ORG_SETTINGS.notificationSettings, ...(currentSettings.notificationSettings || {}) },
        reviewPeriods: { ...DEFAULT_ORG_SETTINGS.reviewPeriods, ...(currentSettings.reviewPeriods || {}) }
    };

    return {
        id: organization.id,
        name: organization.name,
        workingHoursPerDay: organization.workingHoursPerDay,
        workDaysPerWeek: organization.workDaysPerWeek,
        settings: mergedSettings,
        counts: organization._count,
        departments: organization.departments,
        teams: organization.teams,
        createdAt: organization.createdAt,
        updatedAt: organization.updatedAt
    };
};

/**
 * Update organization settings (ADMIN only)
 */
export const updateOrganizationSettings = async (
    user: SettingsUserContext,
    data: UpdateOrgSettingsDTO
) => {
    if (user.role !== Role.ADMIN) {
        throw new Error('FORBIDDEN: Only Organization Administrators can update organization settings.');
    }

    const org = await prisma.organization.findUnique({
        where: { id: user.organizationId }
    });

    if (!org) {
        throw new Error('Organization not found');
    }

    const currentSettings = org.settings ? (org.settings as any) : {};
    const updatedSettings = data.settings
        ? { ...currentSettings, ...data.settings }
        : currentSettings;

    const updated = await prisma.organization.update({
        where: { id: user.organizationId },
        data: {
            ...(data.name ? { name: data.name } : {}),
            ...(data.workingHoursPerDay !== undefined ? { workingHoursPerDay: data.workingHoursPerDay } : {}),
            ...(data.workDaysPerWeek !== undefined ? { workDaysPerWeek: data.workDaysPerWeek } : {}),
            settings: updatedSettings
        }
    });

    await logAudit({
        userId: user.id,
        action: 'UPDATE_ORG_SETTINGS',
        entity: 'Organization',
        entityId: org.id,
        metadata: {
            changes: data
        }
    });

    return updated;
};

/**
 * Create department (ADMIN only)
 */
export const createDepartment = async (
    user: SettingsUserContext,
    data: CreateDepartmentDTO
) => {
    if (user.role !== Role.ADMIN) {
        throw new Error('FORBIDDEN: Only Administrators can create departments.');
    }

    const existing = await prisma.department.findFirst({
        where: {
            organizationId: user.organizationId,
            name: { equals: data.name, mode: 'insensitive' }
        }
    });

    if (existing) {
        throw new Error(`Department '${data.name}' already exists in this organization.`);
    }

    const department = await prisma.department.create({
        data: {
            name: data.name,
            code: data.code || null,
            managerId: data.managerId || null,
            organizationId: user.organizationId
        },
        include: {
            manager: { select: { id: true, name: true, email: true } }
        }
    });

    await logAudit({
        userId: user.id,
        action: 'CREATE_DEPARTMENT',
        entity: 'Department',
        entityId: department.id,
        metadata: {
            name: department.name,
            code: department.code,
            managerId: department.managerId
        }
    });

    return department;
};

/**
 * Update department (ADMIN or Manager of department)
 */
export const updateDepartment = async (
    user: SettingsUserContext,
    departmentId: string,
    data: UpdateDepartmentDTO
) => {
    const dept = await prisma.department.findUnique({
        where: { id: departmentId }
    });

    if (!dept || dept.organizationId !== user.organizationId) {
        throw new Error('Department not found');
    }

    if (user.role !== Role.ADMIN) {
        throw new Error('FORBIDDEN: Only administrators can modify organization department settings.');
    }

    // Only admin can change department manager
    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.code !== undefined) updateData.code = data.code;
    if (data.managerId !== undefined) {
        updateData.managerId = data.managerId;
    }

    const updated = await prisma.department.update({
        where: { id: departmentId },
        data: updateData,
        include: {
            manager: { select: { id: true, name: true, email: true } }
        }
    });

    await logAudit({
        userId: user.id,
        action: 'UPDATE_DEPARTMENT',
        entity: 'Department',
        entityId: departmentId,
        metadata: {
            changes: data
        }
    });

    return updated;
};

/**
 * Delete department (ADMIN only)
 */
export const deleteDepartment = async (
    user: SettingsUserContext,
    departmentId: string
) => {
    if (user.role !== Role.ADMIN) {
        throw new Error('FORBIDDEN: Only Administrators can delete departments.');
    }

    const dept = await prisma.department.findUnique({
        where: { id: departmentId },
        include: {
            _count: {
                select: { users: true, teams: true, tasks: true }
            }
        }
    });

    if (!dept || dept.organizationId !== user.organizationId) {
        throw new Error('Department not found');
    }

    if (dept._count.users > 0) {
        throw new Error(`Cannot delete department '${dept.name}' because it contains ${dept._count.users} user(s). Reassign them first.`);
    }

    await prisma.department.delete({
        where: { id: departmentId }
    });

    await logAudit({
        userId: user.id,
        action: 'DELETE_DEPARTMENT',
        entity: 'Department',
        entityId: departmentId,
        metadata: {
            name: dept.name
        }
    });

    return { message: `Department '${dept.name}' deleted successfully.` };
};
