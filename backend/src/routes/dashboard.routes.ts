import { Router, Request, Response, NextFunction } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

const requireRole = (...roles: string[]) => {
    return (
        req: Request,
        res: Response,
        next: NextFunction
    ): void => {
        const user = (req as any).user;

        if (!user || !roles.includes(user.role)) {
            res.status(403).json({
                message: 'Forbidden: Insufficient role permissions'
            });
            return;
        }

        next();
    };
};

router.get(
    '/employee',
    requireRole('EMPLOYEE'),
    dashboardController.getEmployeeData
);

router.get(
    '/team-lead',
    requireRole('TEAM_LEAD'),
    dashboardController.getTeamLeadData
);

router.get(
    '/manager',
    requireRole('MANAGER'),
    dashboardController.getManagerData
);

export default router;