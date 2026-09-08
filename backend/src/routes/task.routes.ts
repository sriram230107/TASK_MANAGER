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

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type: expected document or image. Executables blocked.'));
        }
    }
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
router.get('/:id', authorize('task', 'read'), taskController.getById);
router.put('/:id', authorize('task', 'update'), taskController.update);
router.patch('/:id', authorize('task', 'update'), taskController.update);
router.delete('/:id', authorize('task', 'delete'), taskController.deleteTask);

export default router;
