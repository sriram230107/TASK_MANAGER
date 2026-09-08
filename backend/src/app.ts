import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
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

const app = express();

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());

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

export default app;
