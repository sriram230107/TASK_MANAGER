import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import { authenticate } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';

const router = Router();
router.use(authenticate);

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
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'text/plain', 'application/msword'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type: expected document or image. Executables blocked.'));
        }
    }
});

router.post('/', taskController.create);
router.get('/', taskController.listTasks);
router.put('/:id/status', taskController.updateStatus);
router.post('/:id/updates', taskController.logProgress);
router.post('/:id/attachments', upload.single('file'), taskController.uploadAttachment);

export default router;
