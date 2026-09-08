import { Router } from 'express';
import * as performanceController from '../controllers/performance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

// Multi-level metrics engine (Employee, Team, Department, Organization)
router.get('/metrics', authorize('performance', 'read'), performanceController.getMetrics);

// Formal performance evaluations
router.get('/reviews', authorize('performance', 'read'), performanceController.listReviews);
router.post('/reviews', authorize('performance', 'create'), performanceController.createReview);

// Cascading goals endpoints
router.get('/goals', authorize('goals', 'read'), performanceController.listGoals);
router.post('/goals', authorize('goals', 'create'), performanceController.createGoal);
router.patch('/goals/:id', authorize('goals', 'update'), performanceController.updateGoal);
router.delete('/goals/:id', authorize('goals', 'delete'), performanceController.deleteGoal);

export default router;
