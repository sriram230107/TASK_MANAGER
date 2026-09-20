import { config } from './config/env';
import app from './app';
import { initOverdueScanner } from './cron/overdueScan';
import { prisma } from './utils/prisma';

if (config.ENABLE_CRON) {
    initOverdueScanner();
} else {
    console.log('Background jobs disabled on this instance (ENABLE_CRON=false)');
}

const server = app.listen(config.PORT, () => {
    console.log(`Server is running on port ${config.PORT} (${config.NODE_ENV})`);
    if (!config.emailEnabled) console.log('Email: not configured (SMTP_HOST / MAIL_FROM unset) - email features are off');
    if (!config.aiEnabled) console.log('AI: not configured (AI_PROVIDER=none) - AI features are off');
});

const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down gracefully...`);
    server.close(async () => {
        await prisma.$disconnect().catch(() => {});
        process.exit(0);
    });
    // Force exit if connections refuse to close.
    setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
