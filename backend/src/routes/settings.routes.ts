import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Get organization settings, policies, departments, and teams
router.get('/', settingsController.getOrganizationSettings);

// Update organization settings & policies (Admin only)
router.put('/', settingsController.updateOrganizationSettings);

// Department management endpoints
router.post('/departments', settingsController.createDepartment);
router.put('/departments/:id', settingsController.updateDepartment);
router.delete('/departments/:id', settingsController.deleteDepartment);

export default router;
