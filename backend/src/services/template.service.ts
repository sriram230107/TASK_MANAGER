// @ts-nocheck
import { prisma } from '../utils/prisma';
import { User, TaskPriority } from '@prisma/client';

export const createTemplate = async (user: User, data: any) => {
    return prisma.taskTemplate.create({
        data: {
            titlePattern: data.titlePattern,
            description: data.description,
            defaultPriority: data.defaultPriority || 'MEDIUM',
            defaultDurationHours: data.defaultDurationHours,
            checklist: data.checklist || [],
            organizationId: user.organizationId
        }
    });
};

export const instantiateTemplate = async (user: User, templateId: string, overrides: any) => {
    const template = await prisma.taskTemplate.findUnique({ where: { id: templateId } });
    if (!template) throw new Error('Template not found');

    let markdownDesc = template.description || '';
    if (template.checklist && template.checklist.length > 0) {
        markdownDesc += '\n\n### Checklist:\n' + template.checklist.map((item: string) => `- [ ] ${item}`).join('\n');
    }

    const nextStart = overrides.startDate ? new Date(overrides.startDate) : new Date();
    const nextDue = overrides.dueDate ? new Date(overrides.dueDate) :
        (template.defaultDurationHours ? new Date(Date.now() + template.defaultDurationHours * 3600 * 1000) : null);

    const task = await prisma.task.create({
        data: {
            title: overrides.title || template.titlePattern,
            description: markdownDesc,
            createdById: user.id,
            assignedToId: overrides.assignedToId,
            teamId: overrides.teamId,
            organizationId: user.organizationId,
            priority: template.defaultPriority as TaskPriority,
            estimatedHours: template.defaultDurationHours,
            startDate: nextStart,
            dueDate: nextDue
        }
    });

    await prisma.activityLog.create({
        data: {
            userId: user.id,
            action: 'CREATE_FROM_TEMPLATE',
            entity: 'Task',
            entityId: task.id
        }
    });

    return task;
};
