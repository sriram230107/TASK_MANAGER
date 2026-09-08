import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);
router.use(requireAdmin);

router.get('/dashboard', adminController.getDashboard);
router.post('/users', adminController.createUser);
router.post('/teams', adminController.createTeam);
router.put('/teams/:id/lead', adminController.assignTeamLead);
router.post('/teams/:id/members', adminController.addTeamMember);
router.put('/users/:id/role', adminController.assignRole);

export default router;
