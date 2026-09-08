import { Router } from 'express';
import * as leaveController from '../controllers/leave.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

// Balance inquiry
router.get('/balances', authorize('leave', 'read'), leaveController.getBalances);

// Apply for leave
router.post('/', authorize('leave', 'create'), leaveController.applyLeave);

// Review leave (Approve/Reject by Team Lead / Manager / Admin)
router.post('/:id/review', authorize('leave', 'approve'), leaveController.reviewLeave);

// Cancel leave (Requester or Admin)
router.post('/:id/cancel', authorize('leave', 'cancel'), leaveController.cancelLeave);

// List leave requests (Scoped to role)
router.get('/', authorize('leave', 'read'), leaveController.listLeaves);

export default router;
