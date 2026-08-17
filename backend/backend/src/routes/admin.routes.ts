import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

router.post('/teams', authorize('team', 'create'), adminController.createTeam);
router.put('/teams/:id/lead', authorize('team', 'update'), adminController.assignTeamLead);
router.post('/teams/:id/members', authorize('team', 'update'), adminController.addTeamMember);
router.put('/users/:id/role', authorize('user', 'update'), adminController.assignRole);

export default router;
