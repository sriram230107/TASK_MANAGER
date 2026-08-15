import { Request, Response } from 'express';
import * as performanceService from '../services/performance.service';
import { z } from 'zod';

const reviewSchema = z.object({
    employeeId: z.string().uuid(),
    rating: z.number().min(1).max(5),
    comments: z.string().optional(),
    periodStart: z.string().datetime(),
    periodEnd: z.string().datetime()
});

export const createReview = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = reviewSchema.parse(req.body);
        const review = await performanceService.submitReview((req as any).user, data.employeeId, data);
        res.status(201).json(review);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};
