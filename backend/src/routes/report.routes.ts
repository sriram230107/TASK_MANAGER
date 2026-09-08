import { Router } from 'express';
import * as reportController from '../controllers/report.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

// Access-controlled reports generation & export
router.get('/', authorize('reports', 'read'), reportController.getReport);

export default router;
