import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../config/env';
import { errorResponse } from '../utils/response';

export const notFoundHandler = (req: Request, res: Response): void => {
    errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
};

/**
 * Last-resort error handler. Controllers keep handling their own expected
 * errors; this catches anything that escapes (including async errors in Express 5)
 * so clients always get the standard { data, error } envelope and never a stack trace.
 */
export const errorHandler = (err: any, _req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
        next(err);
        return;
    }

    if (err instanceof ZodError) {
        errorResponse(res, 'Validation failed', 400, err.issues);
        return;
    }

    // body-parser problems (bad JSON, payload too large)
    if (err?.type === 'entity.parse.failed') {
        errorResponse(res, 'Malformed JSON in request body', 400);
        return;
    }
    if (err?.type === 'entity.too.large') {
        errorResponse(res, 'Request body is too large', 413);
        return;
    }

    // multer (file upload) problems
    if (err?.name === 'MulterError') {
        const message = err.code === 'LIMIT_FILE_SIZE' ? 'File is too large' : err.message;
        errorResponse(res, message, err.code === 'LIMIT_FILE_SIZE' ? 413 : 400);
        return;
    }
    if (typeof err?.message === 'string' && err.message.startsWith('Invalid file type')) {
        errorResponse(res, err.message, 400);
        return;
    }

    console.error('Unhandled error:', err);
    errorResponse(
        res,
        config.isProduction ? 'Internal server error' : err?.message || 'Internal server error',
        500
    );
};
