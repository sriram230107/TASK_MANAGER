import { z } from 'zod';

export const holidayItemSchema = z.object({
    name: z.string().min(1, 'Holiday name is required'),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
    isRecurring: z.boolean().default(false)
});

export const updateOrgSettingsSchema = z.object({
    name: z.string().min(2, 'Organization name must be at least 2 characters').max(100).optional(),
    workingHoursPerDay: z.number().min(1).max(24).optional(),
    workDaysPerWeek: z.number().int().min(1).max(7).optional(),
    settings: z.object({
        holidays: z.array(holidayItemSchema).optional(),
        leavePolicies: z.object({
            annualLeaveDays: z.number().min(0).max(100).default(20),
            sickLeaveDays: z.number().min(0).max(100).default(10),
            casualLeaveDays: z.number().min(0).max(100).default(5),
            carryOverMaxDays: z.number().min(0).max(50).default(5)
        }).optional(),
        taskPolicies: z.object({
            requireReviewForCompletion: z.boolean().default(true),
            allowEmployeeSelfAssign: z.boolean().default(false),
            autoOverdueGracePeriodHours: z.number().min(0).max(72).default(24)
        }).optional(),
        notificationSettings: z.object({
            emailNotificationsEnabled: z.boolean().default(false),
            taskDueRemindersHours: z.number().min(1).max(72).default(24),
            attendanceRemindersEnabled: z.boolean().default(true)
        }).optional(),
        reviewPeriods: z.object({
            frequency: z.enum(['QUARTERLY', 'BI_ANNUAL', 'ANNUAL']).default('QUARTERLY'),
            nextReviewDate: z.string().optional()
        }).optional()
    }).optional()
});

export const createDepartmentSchema = z.object({
    name: z.string().min(1, 'Department name is required').max(100),
    code: z.string().max(20).optional().nullable(),
    managerId: z.string().uuid('Invalid manager ID').optional().nullable()
});

export const updateDepartmentSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    code: z.string().max(20).optional().nullable(),
    managerId: z.string().uuid('Invalid manager ID').optional().nullable()
});

export type UpdateOrgSettingsDTO = z.infer<typeof updateOrgSettingsSchema>;
export type CreateDepartmentDTO = z.infer<typeof createDepartmentSchema>;
export type UpdateDepartmentDTO = z.infer<typeof updateDepartmentSchema>;
export type HolidayItem = z.infer<typeof holidayItemSchema>;
