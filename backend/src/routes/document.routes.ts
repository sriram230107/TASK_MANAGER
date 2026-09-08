import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as documentController from '../controllers/document.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Ensure uploads directory exists
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
    limits: { fileSize: 15 * 1024 * 1024 }, // 15MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = [
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'text/plain',
            'text/csv',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/zip',
            'application/x-zip-compressed'
        ];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type: expected document, spreadsheet, or image. Executables blocked.'));
        }
    }
});

// Upload document
router.post('/', upload.single('file'), documentController.uploadDocument);

// List visible documents
router.get('/', documentController.listDocuments);

// Task attachments
router.get('/tasks/:taskId/attachments', documentController.getTaskAttachments);

// Download document file (authenticated & scope-controlled)
router.get('/:id/download', documentController.downloadDocument);

// Get single document
router.get('/:id', documentController.getDocumentById);

// Delete document
router.delete('/:id', documentController.deleteDocument);

export default router;
