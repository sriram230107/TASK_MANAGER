import { Router } from 'express';
import * as payrollController from '../controllers/payroll.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/rbac.middleware';

const router = Router();
router.use(authenticate);

router.get('/', authorize('payroll', 'read'), payrollController.list);
router.get('/:id/payslip', authorize('payroll', 'read'), payrollController.getPayslip);
router.patch('/:id/status', authorize('payroll', 'update'), payrollController.update);
router.put('/:id/status', authorize('payroll', 'update'), payrollController.update);
router.get('/:id', authorize('payroll', 'read'), payrollController.getById);
router.post('/', authorize('payroll', 'create'), payrollController.create);
router.put('/:id', authorize('payroll', 'update'), payrollController.update);
router.patch('/:id', authorize('payroll', 'update'), payrollController.update);
router.delete('/:id', authorize('payroll', 'delete'), payrollController.deleteRecord);
router.post('/bulk-process', authorize('payroll', 'manage'), payrollController.bulkProcess);

export default router;
