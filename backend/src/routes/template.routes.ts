import { Router } from 'express';
import * as templateController from '../controllers/template.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

router.post('/', authorize('template', 'create'), templateController.createTemplate);
router.post('/:id/instantiate', authorize('template', 'instantiate'), templateController.instantiateTemplate);

export default router;
