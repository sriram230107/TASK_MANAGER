import { Router } from 'express';
import * as auditController from '../controllers/audit.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Audit log summary statistics
router.get('/summary', auditController.getAuditSummary);

// List audit logs with pagination and filters (Admin org-wide, Manager department/reports, Employee/Lead 403)
router.get('/', auditController.listAuditLogs);

export default router;
