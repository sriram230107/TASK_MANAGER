import { Router } from 'express';
import * as performanceController from '../controllers/performance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

router.get('/', authorize('goals', 'read'), performanceController.listGoals);
router.post('/', authorize('goals', 'create'), performanceController.createGoal);
router.patch('/:id', authorize('goals', 'update'), performanceController.updateGoal);
router.delete('/:id', authorize('goals', 'delete'), performanceController.deleteGoal);

export default router;
