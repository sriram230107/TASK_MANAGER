import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

// Real-time daily session actions
router.get('/today', authorize('attendance', 'read'), attendanceController.getToday);
router.post('/check-in', authorize('attendance', 'create'), attendanceController.checkIn);
router.post('/break/start', authorize('attendance', 'update'), attendanceController.startBreak);
router.post('/break/end', authorize('attendance', 'update'), attendanceController.endBreak);
router.post('/check-out', authorize('attendance', 'update'), attendanceController.checkOut);

// Historical queries & reporting
router.get('/summary', authorize('attendance', 'read'), attendanceController.getSummary);
router.get('/', authorize('attendance', 'read'), attendanceController.listAttendance);

// Administrative record adjustment
router.patch('/:id', authorize('attendance', 'update'), attendanceController.updateRecord);

export default router;
