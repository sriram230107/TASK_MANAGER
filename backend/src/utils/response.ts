import { Response } from 'express';

export interface ApiResponse<T = any> {
    data: T | null;
    meta?: any;
    error: {
        message: string;
        details?: any;
        code?: number;
    } | null;
    message?: string;
    [key: string]: any;
}

export const successResponse = <T>(
    res: Response,
    data: T,
    statusCode = 200,
    meta?: any
): Response => {
    // If data is an object, mirror top-level properties for backward compatibility with existing frontend
    const legacyMirrors = (data && typeof data === 'object' && !Array.isArray(data)) ? data : {};

    return res.status(statusCode).json({
        ...legacyMirrors,
        data,
        meta,
        error: null
    });
};

export const errorResponse = (
    res: Response,
    message: string,
    statusCode = 400,
    details?: any
): Response => {
    return res.status(statusCode).json({
        data: null,
        error: {
            message,
            details,
            code: statusCode
        },
        message // For legacy frontend checks (e.g. err.response?.data?.message)
    });
};
