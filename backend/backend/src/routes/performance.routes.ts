import { Router } from 'express';
import * as performanceController from '../controllers/performance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

router.post('/reviews', authorize('team', 'update'), performanceController.createReview);

export default router;
