import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const router = Router();
router.use(authenticate);

// Ensure uploads folder exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', authorize('task', 'read'), taskController.listTasks);
router.post('/', authorize('task', 'create'), taskController.create);
router.put('/:id/status', authorize('task', 'update'), taskController.updateStatus);
router.patch('/:id/status', authorize('task', 'update'), taskController.updateStatus);
router.post('/:id/updates', authorize('task', 'update'), taskController.logProgress);
router.post('/:id/delegate', authorize('task', 'assign'), taskController.delegate);
router.post('/:id/comments', authorize('task', 'read'), taskController.addComment);
router.get('/:id/comments', authorize('task', 'read'), taskController.getComments);
router.post('/:id/attachments', authorize('task', 'update'), upload.single('file'), taskController.uploadAttachment);
router.get('/:id/attachments/:attachmentId/download', authorize('task', 'read'), taskController.downloadAttachment);
router.get('/:id', authorize('task', 'read'), taskController.getById);
router.put('/:id', authorize('task', 'update'), taskController.update);
router.patch('/:id', authorize('task', 'update'), taskController.update);
router.delete('/:id', authorize('task', 'delete'), taskController.deleteTask);

export default router;
