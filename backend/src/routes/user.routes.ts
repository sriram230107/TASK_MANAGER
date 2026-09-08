import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();

router.use(authenticate);

// Current user profile
router.get('/me', userController.getMyProfile);

// Organization hierarchy tree
router.get('/hierarchy', authorize('user', 'read'), userController.getOrgHierarchy);

// User directory listing with search, filtering, and role scoping
router.get('/', authorize('user', 'read'), userController.listUsers);

// Target user profile
router.get('/:id', authorize('user', 'read'), userController.getUserProfile);

// Profile update (self display name or admin full update)
router.patch('/:id', authorize('user', 'update'), userController.updateProfile);

// Create user (Admin only)
router.post('/', authorize('user', 'create'), userController.createUser);

export default router;
