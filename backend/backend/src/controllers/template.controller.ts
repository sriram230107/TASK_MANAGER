import { Request, Response } from 'express';
import * as templateService from '../services/template.service';

export const createTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const template = await templateService.createTemplate((req as any).user, req.body);
        res.status(201).json(template);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const instantiateTemplate = async (req: Request, res: Response): Promise<void> => {
    try {
        const task = await templateService.instantiateTemplate((req as any).user, req.params.id as string, req.body);
        res.status(201).json(task);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};
