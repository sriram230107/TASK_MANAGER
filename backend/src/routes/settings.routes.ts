import { Router } from 'express';
import * as settingsController from '../controllers/settings.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireAdmin, authorize } from '../middleware/rbac.middleware';

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

// Integrations and write-only secrets
router.get('/integrations', authorize('settings', 'read'), settingsController.getIntegrationStatus);
router.post('/integrations/smtp', requireAdmin, settingsController.updateSmtpSecret);
router.post('/integrations/ai', requireAdmin, settingsController.updateAiSecret);

export default router;
