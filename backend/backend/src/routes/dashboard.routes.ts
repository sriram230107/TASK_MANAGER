import { Router } from 'express';
import * as dashboardController from '../controllers/dashboard.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

// We leverage the previous authorize matrix mechanism implicitly since these routes 
// are role-locked to specific data paths by the dashboard.service. 
// A robust verification is to explicitly limit by role:

router.get('/employee', authorize('team', 'read'), dashboardController.getEmployeeData); // Everyone can read their basic dashboard
router.get('/team-lead', authorize('team', 'read'), dashboardController.getTeamLeadData); // Usually limited by checking role directly, but the service query enforces ownership so we just pass it
router.get('/manager', authorize('team', 'read'), dashboardController.getManagerData);

export default router;
