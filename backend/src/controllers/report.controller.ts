import { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { reportQuerySchema } from '../validators/report.validator';
import { successResponse, errorResponse } from '../utils/response';

export const getReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = req.user;
        if (!user) {
            errorResponse(res, 'Unauthorized', 401);
            return;
        }

        const parsed = reportQuerySchema.safeParse(req.query);
        if (!parsed.success) {
            errorResponse(res, 'Invalid query parameters', 400, parsed.error.format());
            return;
        }

        const { type, scope, scopeId, startDate, endDate, format } = parsed.data;

        const end = endDate ? new Date(endDate) : new Date();
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Resolve user scope securely on server side
        const { userIds, resolvedScope, scopeLabel } = await reportService.resolveScopedUserIds(
            user,
            scope,
            scopeId
        );

        let reportResult: any;

        switch (type) {
            case 'tasks':
                reportResult = await reportService.getTaskReport(user, userIds, scopeLabel, start, end);
                break;
            case 'attendance':
                reportResult = await reportService.getAttendanceReport(user, userIds, scopeLabel, start, end);
                break;
            case 'performance':
                reportResult = await reportService.getPerformanceReport(user, userIds, scopeLabel, start, end);
                break;
            case 'workload':
                reportResult = await reportService.getWorkloadReport(user, userIds, scopeLabel);
                break;
            case 'overview':
            default:
                reportResult = await reportService.getOverviewReport(user, userIds, scopeLabel, start, end);
                break;
        }

        // Export as CSV if requested
        if (format === 'csv') {
            const rawData = reportResult.rawData || [];
            const csvData = reportService.exportReportToCsv(rawData, type);

            res.header('Content-Type', 'text/csv');
            res.attachment(`report-${type}-${new Date().toISOString().split('T')[0]}.csv`);
            res.send(csvData);
            return;
        }

        // Export as PDF if requested
        if (format === 'pdf') {
            const pdfBuffer = await reportService.exportReportToPdf(reportResult, type, scopeLabel);
            res.header('Content-Type', 'application/pdf');
            res.attachment(`report-${type}-${new Date().toISOString().split('T')[0]}.pdf`);
            res.send(pdfBuffer);
            return;
        }

        successResponse(res, {
            type,
            scope: resolvedScope,
            scopeLabel,
            period: { start: start.toISOString().split('T')[0], end: end.toISOString().split('T')[0] },
            ...reportResult
        });
    } catch (error: any) {
        console.error('getReport error:', error);
        const status = error.message?.includes('Forbidden') ? 403 : 400;
        errorResponse(res, error.message || 'Failed to generate report', status);
    }
};
