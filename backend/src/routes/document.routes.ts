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

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
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
