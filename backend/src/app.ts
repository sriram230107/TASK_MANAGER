import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { config } from './config/env';
import { prisma } from './utils/prisma';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import taskRoutes from './routes/task.routes';
import dashboardRoutes from './routes/dashboard.routes';
import performanceRoutes from './routes/performance.routes';
import reportRoutes from './routes/report.routes';
import templateRoutes from './routes/template.routes';
import userRoutes from './routes/user.routes';
import attendanceRoutes from './routes/attendance.routes';
import leaveRoutes from './routes/leave.routes';
import goalRoutes from './routes/goal.routes';
import notificationRoutes from './routes/notification.routes';
import payrollRoutes from './routes/payroll.routes';
import documentRoutes from './routes/document.routes';
import auditRoutes from './routes/audit.routes';
import settingsRoutes from './routes/settings.routes';
import { httpLogger } from './utils/logger';

const app = express();

// Behind nginx / a load balancer, trust the forwarded client IP so rate limiting
// and secure cookies work correctly.
if (config.TRUST_PROXY > 0) app.set('trust proxy', config.TRUST_PROXY);

app.use(
    helmet({
        // The SPA may be served from a different origin than the API.
        crossOriginResourcePolicy: { policy: 'cross-origin' }
    })
);

app.use(
    cors({
        origin: (origin, callback) => {
            // Requests without an Origin header (curl, server-to-server, same-origin) are allowed.
            if (!origin || config.CORS_ORIGINS.includes(origin)) return callback(null, true);
            return callback(null, false);
        },
        credentials: true
    })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(httpLogger);

// Health checks (used by Docker, load balancers, uptime monitors)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});
app.get('/health/ready', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.json({ status: 'ready' });
    } catch {
        res.status(503).json({ status: 'database unavailable' });
    }
});

// Broad limiter for the whole API. Kept generous because a whole office often
// shares one public IP; stricter limits apply to login (see auth.routes.ts).
app.use(
    '/api',
    rateLimit({
        windowMs: config.RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
        limit: config.RATE_LIMIT_MAX,
        standardHeaders: true,
        legacyHeaders: false,
        message: {
            data: null,
            error: { message: 'Too many requests, please slow down', code: 429 },
            message: 'Too many requests, please slow down'
        }
    })
);

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/attendance', attendanceRoutes);
app.use('/api/v1/leave', leaveRoutes);
app.use('/api/v1/goals', goalRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/payroll', payrollRoutes);
app.use('/api/v1/documents', documentRoutes);
app.use('/api/v1/audit', auditRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/performance', performanceRoutes);
app.use('/api/v1/reports', reportRoutes);
app.use('/api/v1/templates', templateRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
