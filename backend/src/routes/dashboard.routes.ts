import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

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