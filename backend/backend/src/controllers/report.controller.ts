import { Request, Response } from 'express';
import * as reportService from '../services/report.service';
import { Parser } from 'json2csv';
import PDFDocument from 'pdfkit';

export const getReport = async (req: Request, res: Response): Promise<void> => {
    try {
        const filters = req.query;
        const reportData = await reportService.getAggregatedReport((req as any).user, filters);

        if (filters.format === 'csv') {
            const fields = ['title', 'status', 'assignee', 'team', 'dueDate', 'completedAt'];
            const json2csvParser = new Parser({ fields });
            const csv = json2csvParser.parse(reportData.rawData);

            res.header('Content-Type', 'text/csv');
            res.attachment('report.csv');
            res.send(csv);
        } else if (filters.format === 'pdf') {
            const doc = new PDFDocument();
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=report.pdf');
            doc.pipe(res);

            doc.fontSize(20).text('TaskBot Pro - Productivity Report', { align: 'center' });
            doc.moveDown();
            doc.fontSize(14).text(`Total Tasks: ${reportData.totalTasks}`);
            doc.text(`Completed Tasks: ${reportData.completedTasks}`);
            doc.text(`Overdue Tasks: ${reportData.overdueCount}`);
            doc.text(`Completion Rate: ${reportData.completionRate}%`);
            doc.text(`On-Time Rate: ${reportData.onTimeRate}%`);
            doc.text(`Avg Completion Time: ${reportData.averageCompletionTimeHours} Hours`);

            doc.moveDown();
            doc.fontSize(16).text('Raw Data:', { underline: true });
            reportData.rawData.forEach(r => {
                doc.moveDown(0.5);
                doc.fontSize(12).text(`Task: ${r.title} | Status: ${r.status} | Assignee: ${r.assignee}`);
            });

            doc.end();
        } else {
            res.json(reportData);
        }
    } catch (error: any) {
        res.status(400).json({ message: error.message });
    }
};
