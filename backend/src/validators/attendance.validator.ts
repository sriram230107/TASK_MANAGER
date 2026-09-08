import { z } from 'zod';

export const checkInSchema = z.object({
    isWorkFromHome: z.boolean().optional().default(false),
    notes: z.string().max(500).optional(),
    userId: z.string().optional() // Admin only override
});

export const checkOutSchema = z.object({
    notes: z.string().max(500).optional()
});

export const breakSchema = z.object({
    notes: z.string().max(500).optional()
});

export const attendanceQuerySchema = z.object({
    page: z.coerce.number().min(1).default(1),
    limit: z.coerce.number().min(1).max(100).default(20),
    userId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    status: z.enum([
        'PRESENT',
        'ABSENT',
        'LATE',
        'HALF_DAY',
        'LEAVE',
        'HOLIDAY',
        'WORK_FROM_HOME'
    ]).optional()
});

export const updateAttendanceSchema = z.object({
    status: z.enum([
        'PRESENT',
        'ABSENT',
        'LATE',
        'HALF_DAY',
        'LEAVE',
        'HOLIDAY',
        'WORK_FROM_HOME'
    ]).optional(),
    checkIn: z.string().datetime().optional(),
    checkOut: z.string().datetime().optional(),
    isWorkFromHome: z.boolean().optional(),
    notes: z.string().max(500).optional()
});
