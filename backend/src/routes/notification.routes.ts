import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

router.get('/', authorize('notifications', 'read'), notificationController.list);
router.get('/unread-count', authorize('notifications', 'read'), notificationController.getUnreadCount);
router.patch('/read-all', authorize('notifications', 'update'), notificationController.markAllAsRead);
router.patch('/:id/read', authorize('notifications', 'update'), notificationController.markAsRead);
router.delete('/clear-read', authorize('notifications', 'delete'), notificationController.clearRead);
router.delete('/:id', authorize('notifications', 'delete'), notificationController.deleteNotification);
router.post('/', authorize('notifications', 'create'), notificationController.create);
router.post('/broadcast', authorize('notifications', 'create'), notificationController.broadcast);

export default router;
