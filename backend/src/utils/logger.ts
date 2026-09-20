import pino from 'pino';
import pinoHttp from 'pino-http';
import { randomUUID } from 'node:crypto';

const isTest = process.env.NODE_ENV === 'test';

export const logger = pino({
    level: isTest ? 'silent' : (process.env.LOG_LEVEL || 'info'),
    redact: {
        paths: [
            '*.password',
            '*.passwordHash',
            '*.token',
            '*.secret',
            '*.accessToken',
            '*.refreshToken',
            'req.headers.authorization',
            'req.headers.cookie',
            'email',
            '*.email'
        ],
        censor: '[REDACTED]'
    },
    formatters: {
        level(label) {
            return { level: label };
        }
    },
    timestamp: pino.stdTimeFunctions.isoTime
});

export const httpLogger = pinoHttp({
    logger,
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
    // Do NOT log request bodies or sensitive query params
    serializers: {
        req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
            remoteAddress: req.remoteAddress
        }),
        res: (res) => ({
            statusCode: res.statusCode
        })
    }
});
