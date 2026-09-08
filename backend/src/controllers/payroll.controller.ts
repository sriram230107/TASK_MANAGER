import { Request, Response } from 'express';
import * as payrollService from '../services/payroll.service';
import {
    createPayrollSchema,
    updatePayrollSchema,
    bulkProcessPayrollSchema,
    queryPayrollSchema
} from '../validators/payroll.validator';
import { successResponse, errorResponse } from '../utils/response';

export const create = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = createPayrollSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const record = await payrollService.createPayrollRecord(user, parsed.data);
        successResponse(res, record, 201);
    } catch (error: any) {
        console.error('create payroll error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to create payroll record', status);
    }
};

export const list = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = queryPayrollSchema.safeParse(req.query);
        const filters: any = {};
        if (parsed.success) {
            if (parsed.data.employeeId) filters.employeeId = parsed.data.employeeId;
            if (parsed.data.departmentId) filters.departmentId = parsed.data.departmentId;
            if (parsed.data.status) filters.status = parsed.data.status;
            if (parsed.data.periodStart) filters.periodStart = parsed.data.periodStart;
            if (parsed.data.periodEnd) filters.periodEnd = parsed.data.periodEnd;
            if (parsed.data.page) filters.page = parsed.data.page;
            if (parsed.data.limit) filters.limit = parsed.data.limit;
        }

        const result = await payrollService.listPayrollRecords(user, filters);
        successResponse(res, result);
    } catch (error: any) {
        console.error('list payroll error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 500;
        errorResponse(res, error.message || 'Failed to list payroll records', status);
    }
};

export const getById = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const record = await payrollService.getPayrollRecordById(user, req.params.id as string);
        successResponse(res, record);
    } catch (error: any) {
        console.error('getById payroll error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : error.message?.includes('not found') ? 404 : 400;
        errorResponse(res, error.message || 'Failed to fetch payroll record', status);
    }
};

export const update = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = updatePayrollSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const record = await payrollService.updatePayrollRecord(user, req.params.id as string, parsed.data);
        successResponse(res, record);
    } catch (error: any) {
        console.error('update payroll error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to update payroll record', status);
    }
};

export const deleteRecord = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const result = await payrollService.deletePayrollRecord(user, req.params.id as string);
        successResponse(res, result);
    } catch (error: any) {
        console.error('delete payroll error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to delete payroll record', status);
    }
};

export const bulkProcess = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = bulkProcessPayrollSchema.safeParse(req.body);
        if (!parsed.success) {
            errorResponse(res, 'Validation failed', 400, parsed.error.format());
            return;
        }

        const result = await payrollService.bulkProcessPayroll(user, parsed.data.recordIds, parsed.data.status);
        successResponse(res, result);
    } catch (error: any) {
        console.error('bulkProcess payroll error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to process payroll in bulk', status);
    }
};

export const getPayslip = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const html = await payrollService.generatePayslipHtml(user, req.params.id as string);

        if (req.query.format === 'html') {
            res.setHeader('Content-Type', 'text/html');
            res.send(html);
            return;
        }

        successResponse(res, { html });
    } catch (error: any) {
        console.error('getPayslip error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to generate payslip', status);
    }
};
