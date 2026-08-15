import { Request, Response } from 'express';
import * as dashboardService from '../services/dashboard.service';

export const getEmployeeData = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await dashboardService.getEmployeeDashboard((req as any).user);
        res.json(data);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getTeamLeadData = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await dashboardService.getTeamLeadDashboard((req as any).user);
        res.json(data);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};

export const getManagerData = async (req: Request, res: Response): Promise<void> => {
    try {
        const data = await dashboardService.getManagerDashboard((req as any).user);
        res.json(data);
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};
