import { Router, Request, Response, NextFunction } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

// Admin-only guard for dashboard and user/role management
const requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;
    if (!user || user.role !== 'ADMIN') {
        res.status(403).json({ message: 'Forbidden: Admin access required' });
        return;
    }
    next();
};

router.get('/dashboard', requireAdmin, adminController.getDashboard);
router.post('/teams', authorize('team', 'create'), adminController.createTeam);
router.put('/teams/:id/lead', authorize('team', 'update'), adminController.assignTeamLead);
router.post('/teams/:id/members', authorize('team', 'update'), adminController.addTeamMember);
router.put('/users/:id/role', requireAdmin, adminController.assignRole);

export default router;
