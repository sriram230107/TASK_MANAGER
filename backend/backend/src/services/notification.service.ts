import nodemailer from 'nodemailer';
import { prisma } from '../utils/prisma';

// Using ephemeral Ethereal testing credentials by default if SMTP is missing.
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.ethereal.email',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
        user: process.env.SMTP_USER || 'felicity.robel@ethereal.email',
        pass: process.env.SMTP_PASS || 'd8aRbV7k8WzNw1cKqE'
    }
});

export const sendNotification = async (userId: string, type: string, taskId?: string, message?: string) => {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    // Insert in-app DB notification
    await prisma.notification.create({
        data: {
            userId,
            taskId,
            type
        }
    });

    // Attempt Email Dispatch
    try {
        const info = await transporter.sendMail({
            from: '"TaskBot Pro" <no-reply@taskbot.com>',
            to: user.email,
            subject: `Task Notification: ${type}`,
            text: message || `You have a new alert regarding your tasks. Type: ${type}`,
        });
        console.log(`Notification sent to ${user.email} -> URL: ${nodemailer.getTestMessageUrl(info)}`);
    } catch (error) {
        console.error(`Failed to dispatch email to ${user.email}:`, error);
    }
};
