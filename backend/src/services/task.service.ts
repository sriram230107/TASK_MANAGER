import { prisma } from '../utils/prisma';
import { User, TaskStatus, TaskPriority, Role, Task } from '@prisma/client';
import { isAuthorizedForTarget, isAuthorizedForTeam, isAuthorizedForDepartment } from '../utils/hierarchy';
import { notifyTaskParticipants } from './notification.service';

/*
|--------------------------------------------------------------------------
| TASK LIFECYCLE & HIERARCHICAL SERVICE
|--------------------------------------------------------------------------
|
| Role hierarchy: ADMIN > MANAGER > TEAM_LEAD > EMPLOYEE
|
| Status flow:
| DRAFT → ASSIGNED → ACCEPTED → IN_PROGRESS → (ON_HOLD) → SUBMITTED →
| UNDER_REVIEW → COMPLETED | CHANGES_REQUESTED → back to IN_PROGRESS
|
| Derived: OVERDUE (automatic when dueDate < now && not COMPLETED/CANCELLED)
| Terminus: CANCELLED
|--------------------------------------------------------------------------
*/

export interface CreateTaskInput {
    title: string;
    description?: string;
    priority?: TaskPriority;
    status?: string;
    assignedManagerId?: string;
    assignedTeamLeadId?: string;
    assignedEmployeeId?: string;
    assignedToId?: string;
    departmentId?: string;
    teamId?: string;
    parentTaskId?: string;
    dependencies?: string[];
    estimatedHours?: number;
    startDate?: string | null;
    dueDate?: string | null;
    recurrenceRule?: any;
}

export interface UpdateTaskInput {
    title?: string;
    description?: string | null;
    priority?: TaskPriority;
    assignedManagerId?: string | null;
    assignedTeamLeadId?: string | null;
    assignedEmployeeId?: string | null;
    assignedToId?: string | null;
    departmentId?: string | null;
    teamId?: string | null;
    dependencies?: string[];
    estimatedHours?: number | null;
    actualHours?: number;
    progressPercent?: number;
    startDate?: string | null;
    dueDate?: string | null;
    completionNotes?: string | null;
    reviewNotes?: string | null;
}

export interface UpdateStatusInput {
    status: string;
    comment?: string;
    progressPercent?: number;
    hoursLogged?: number;
    completionNotes?: string;
    reviewNotes?: string;
}

export interface TaskQueryInput {
    page?: number;
    limit?: number;
    status?: string;
    priority?: TaskPriority;
    departmentId?: string;
    teamId?: string;
    assignedTo?: string;
    assignedEmployeeId?: string;
    assignedTeamLeadId?: string;
    assignedManagerId?: string;
    parentTaskId?: string;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

/**
 * Normalizes legacy status names to the specification's 11-step lifecycle.
 */
export const normalizeStatus = (status: string): TaskStatus => {
    switch (status) {
        case 'NOT_STARTED':
            return 'DRAFT';
        case 'BLOCKED':
            return 'ON_HOLD';
        case 'PENDING_REVIEW':
            return 'UNDER_REVIEW';
        default:
            return status as TaskStatus;
    }
};

/**
 * Checks if a user can access a specific task based on organizational scope.
 */
export const canAccessTask = async (user: User, task: any): Promise<boolean> => {
    if (task.organizationId !== user.organizationId || task.deletedAt) {
        return false;
    }

    if (user.role === 'ADMIN') return true;

    if (user.role === 'EMPLOYEE') {
        return (
            task.assignedToId === user.id ||
            task.assignedEmployeeId === user.id ||
            task.createdById === user.id
        );
    }

    if (user.role === 'TEAM_LEAD') {
        if (
            task.assignedTeamLeadId === user.id ||
            task.assignedEmployeeId === user.id ||
            task.createdById === user.id
        ) {
            return true;
        }

        if (task.teamId) {
            const team = await prisma.team.findFirst({
                where: { id: task.teamId, teamLeadId: user.id }
            });
            if (team) return true;
        }

        if (task.assignedToId) {
            return await isAuthorizedForTarget(user, task.assignedToId);
        }

        return false;
    }

    if (user.role === 'MANAGER') {
        if (
            task.assignedManagerId === user.id ||
            task.createdById === user.id
        ) {
            return true;
        }

        if (task.departmentId) {
            const dept = await prisma.department.findFirst({
                where: {
                    id: task.departmentId,
                    OR: [
                        { managerId: user.id },
                        ...(user.departmentId ? [{ id: user.departmentId }] : [])
                    ]
                }
            });
            if (dept) return true;
        }

        if (task.teamId) {
            const team = await prisma.team.findFirst({
                where: {
                    id: task.teamId,
                    OR: [
                        { teamLead: { managerId: user.id } },
                        { department: { managerId: user.id } }
                    ]
                }
            });
            if (team) return true;
        }

        if (task.assignedToId) {
            return await isAuthorizedForTarget(user, task.assignedToId);
        }

        return false;
    }

    return false;
};

/**
 * Creates a new task with strict server-side tenant isolation and hierarchy validation.
 */
export const createTask = async (creator: User, data: CreateTaskInput) => {
    const organizationId = creator.organizationId;
    let targetEmployeeId = data.assignedEmployeeId || data.assignedToId || null;
    let targetLeadId = data.assignedTeamLeadId || null;
    let targetManagerId = data.assignedManagerId || null;
    let departmentId = data.departmentId || null;
    let teamId = data.teamId || null;

    // 1. Role-specific creation constraints
    if (creator.role === 'EMPLOYEE') {
        throw new Error('Employees are not authorized to create organization tasks');
    }

    if (creator.role === 'TEAM_LEAD') {
        // Team Lead must assign within own team
        const ledTeam = await prisma.team.findFirst({
            where: { organizationId, teamLeadId: creator.id }
        });

        if (!teamId && ledTeam) {
            teamId = ledTeam.id;
        } else if (teamId) {
            const validTeam = await prisma.team.findFirst({
                where: { id: teamId, organizationId, teamLeadId: creator.id }
            });
            if (!validTeam) {
                throw new Error('Team Leads can only create tasks for teams they lead');
            }
        }

        targetLeadId = creator.id;

        if (targetEmployeeId) {
            const validMember = await isAuthorizedForTarget(creator, targetEmployeeId);
            if (!validMember) {
                throw new Error('Cannot assign task to employee outside your team');
            }
        }
    }

    if (creator.role === 'MANAGER') {
        // Manager scopes to assigned department
        if (!departmentId && creator.departmentId) {
            departmentId = creator.departmentId;
        } else if (departmentId) {
            const validDept = await isAuthorizedForDepartment(creator, departmentId);
            if (!validDept) {
                throw new Error('Cannot create task for department outside your scope');
            }
        }

        targetManagerId = creator.id;

        if (targetLeadId) {
            const validLead = await isAuthorizedForTarget(creator, targetLeadId);
            if (!validLead) {
                throw new Error('Cannot assign task to Team Lead outside your scope');
            }
        }
    }

    // Determine initial status
    let initialStatus = normalizeStatus(data.status || 'DRAFT');
    if (initialStatus === 'DRAFT' && (targetEmployeeId || targetLeadId)) {
        initialStatus = 'ASSIGNED';
    }

    // Primary assignee for legacy compatibility
    const primaryAssigneeId = targetEmployeeId || targetLeadId || targetManagerId || creator.id;

    const task = await prisma.task.create({
        data: {
            title: data.title,
            description: data.description,
            priority: data.priority || 'MEDIUM',
            status: initialStatus,
            createdById: creator.id,
            assignedManagerId: targetManagerId,
            assignedTeamLeadId: targetLeadId,
            assignedEmployeeId: targetEmployeeId,
            assignedToId: primaryAssigneeId,
            departmentId,
            teamId,
            parentTaskId: data.parentTaskId || null,
            dependencies: data.dependencies || [],
            estimatedHours: data.estimatedHours,
            startDate: data.startDate ? new Date(data.startDate) : null,
            dueDate: data.dueDate ? new Date(data.dueDate) : null,
            organizationId
        },
        include: {
            assignedTo: { select: { id: true, name: true, email: true, role: true } },
            assignedManager: { select: { id: true, name: true, email: true } },
            assignedTeamLead: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true, role: true } },
            department: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } }
        }
    });

    // Create initial audit/history record
    await prisma.taskHistory.create({
        data: {
            taskId: task.id,
            userId: creator.id,
            action: 'CREATED',
            toStatus: initialStatus,
            details: `Task created with priority ${task.priority}`
        }
    });

    // Create assignment record if assigned to an employee
    if (targetEmployeeId) {
        await prisma.taskAssignment.create({
            data: {
                taskId: task.id,
                userId: targetEmployeeId,
                role: 'ASSIGNEE'
            }
        });
    }

    // Notify assigned participants
    if (targetEmployeeId || targetLeadId) {
        await notifyTaskParticipants(
            task.id,
            creator,
            'TASK_ASSIGNED',
            `You have been assigned to task: "${task.title}"`
        ).catch(() => {});
    }

    return task;
};

/**
 * Updates task fields (metadata, assignees, dates).
 */
export const updateTask = async (user: User, taskId: string, data: UpdateTaskInput) => {
    const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null }
    });

    if (!task) throw new Error('Task not found');
    if (!(await canAccessTask(user, task))) {
        throw new Error('Forbidden: You do not have access to this task');
    }

    // Role check for full edits
    if (user.role === 'EMPLOYEE') {
        throw new Error('Employees can only update progress and status on assigned tasks');
    }

    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.departmentId !== undefined) updateData.departmentId = data.departmentId;
    if (data.teamId !== undefined) updateData.teamId = data.teamId;
    if (data.dependencies !== undefined) updateData.dependencies = data.dependencies;
    if (data.estimatedHours !== undefined) updateData.estimatedHours = data.estimatedHours;
    if (data.actualHours !== undefined) updateData.actualHours = data.actualHours;
    if (data.progressPercent !== undefined) updateData.progressPercent = data.progressPercent;
    if (data.completionNotes !== undefined) updateData.completionNotes = data.completionNotes;
    if (data.reviewNotes !== undefined) updateData.reviewNotes = data.reviewNotes;
    if (data.startDate !== undefined) updateData.startDate = data.startDate ? new Date(data.startDate) : null;
    if (data.dueDate !== undefined) updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;

    if (data.assignedEmployeeId !== undefined) {
        updateData.assignedEmployeeId = data.assignedEmployeeId;
        if (data.assignedEmployeeId) updateData.assignedToId = data.assignedEmployeeId;
    }
    if (data.assignedTeamLeadId !== undefined) updateData.assignedTeamLeadId = data.assignedTeamLeadId;
    if (data.assignedManagerId !== undefined) updateData.assignedManagerId = data.assignedManagerId;

    const updatedTask = await prisma.task.update({
        where: { id: taskId },
        data: updateData,
        include: {
            assignedTo: { select: { id: true, name: true, email: true, role: true } },
            assignedManager: { select: { id: true, name: true } },
            assignedTeamLead: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } }
        }
    });

    await prisma.taskHistory.create({
        data: {
            taskId: task.id,
            userId: user.id,
            action: 'UPDATED',
            details: 'Task details updated'
        }
    });

    return updatedTask;
};

/**
 * Updates task status and logs progress through the defined state machine.
 */
export const updateTaskStatus = async (user: User, taskId: string, data: UpdateStatusInput) => {
    const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null }
    });

    if (!task) throw new Error('Task not found');
    if (!(await canAccessTask(user, task))) {
        throw new Error('Forbidden: You do not have access to this task');
    }

    const currentStatus = task.status;
    const targetStatus = normalizeStatus(data.status);

    // Validate state transitions per /PROJECT_SPEC.md
    if (user.role === 'EMPLOYEE') {
        const isAssignee = task.assignedToId === user.id || task.assignedEmployeeId === user.id;
        if (!isAssignee) {
            throw new Error('Forbidden: You can only update tasks assigned to you');
        }

        const allowedTransitions: Record<string, TaskStatus[]> = {
            ASSIGNED: ['ACCEPTED', 'IN_PROGRESS'],
            ACCEPTED: ['IN_PROGRESS', 'ON_HOLD'],
            IN_PROGRESS: ['ON_HOLD', 'SUBMITTED', 'UNDER_REVIEW'],
            ON_HOLD: ['IN_PROGRESS'],
            CHANGES_REQUESTED: ['IN_PROGRESS']
        };

        const allowed = allowedTransitions[currentStatus] || [];
        if (!allowed.includes(targetStatus) && targetStatus !== currentStatus) {
            throw new Error(
                `Invalid transition: Employees cannot change status from ${currentStatus} to ${targetStatus}`
            );
        }
    }

    if (targetStatus === 'COMPLETED' || targetStatus === 'CHANGES_REQUESTED') {
        // Review outcomes require manager, team lead, or admin
        if (user.role === 'EMPLOYEE') {
            throw new Error('Employees cannot approve completion or request changes. Please submit for review.');
        }
    }

    const updatePayload: any = {
        status: targetStatus
    };

    if (data.progressPercent !== undefined) {
        updatePayload.progressPercent = data.progressPercent;
    }

    if (data.hoursLogged && data.hoursLogged > 0) {
        updatePayload.actualHours = (task.actualHours || 0) + data.hoursLogged;
    }

    if (targetStatus === 'COMPLETED') {
        updatePayload.completedAt = new Date();
        updatePayload.progressPercent = 100;
        if (data.completionNotes) updatePayload.completionNotes = data.completionNotes;
    }

    if (data.reviewNotes) {
        updatePayload.reviewNotes = data.reviewNotes;
    }

    const updated = await prisma.task.update({
        where: { id: taskId },
        data: updatePayload,
        include: {
            assignedTo: { select: { id: true, name: true, email: true, role: true } },
            team: { select: { id: true, name: true } },
            department: { select: { id: true, name: true } }
        }
    });

    // Record audit history
    await prisma.taskHistory.create({
        data: {
            taskId: task.id,
            userId: user.id,
            action: 'STATUS_CHANGE',
            fromStatus: currentStatus,
            toStatus: targetStatus,
            details: data.comment || data.reviewNotes || data.completionNotes || `Status changed from ${currentStatus} to ${targetStatus}`
        }
    });

    // Record legacy TaskUpdate for backward compatibility with frontend
    if (data.progressPercent !== undefined || data.comment || data.hoursLogged) {
        await prisma.taskUpdate.create({
            data: {
                taskId: task.id,
                userId: user.id,
                progressPercent: data.progressPercent ?? task.progressPercent,
                comment: data.comment || null,
                hoursLogged: data.hoursLogged || null
            }
        });
    }

    // Notify other task stakeholders
    await notifyTaskParticipants(
        task.id,
        user,
        'TASK_STATUS_CHANGED',
        `Status updated from ${currentStatus} to ${targetStatus} by ${user.name}`
    ).catch(() => {});

    return updated;
};

/**
 * Logs progress, comments, and working hours on a task.
 */
export const logTaskProgress = async (
    user: User,
    taskId: string,
    data: { progressPercent: number; comment?: string; hoursLogged?: number }
) => {
    const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null }
    });

    if (!task) throw new Error('Task not found');
    if (!(await canAccessTask(user, task))) {
        throw new Error('Forbidden: You do not have access to this task');
    }

    const updates: any = {
        progressPercent: data.progressPercent
    };

    if (data.hoursLogged && data.hoursLogged > 0) {
        updates.actualHours = (task.actualHours || 0) + data.hoursLogged;
    }

    // If task was accepted and work started, advance to IN_PROGRESS
    if (task.status === 'ACCEPTED' || task.status === 'ASSIGNED') {
        updates.status = 'IN_PROGRESS';
    }

    await prisma.task.update({
        where: { id: taskId },
        data: updates
    });

    const updateRecord = await prisma.taskUpdate.create({
        data: {
            taskId,
            userId: user.id,
            progressPercent: data.progressPercent,
            comment: data.comment || null,
            hoursLogged: data.hoursLogged || null
        }
    });

    await prisma.taskHistory.create({
        data: {
            taskId,
            userId: user.id,
            action: 'PROGRESS_LOGGED',
            details: `Logged ${data.progressPercent}% progress. ${data.comment || ''}`.trim()
        }
    });

    return updateRecord;
};

/**
 * Adds a comment to a task.
 */
export const addComment = async (user: User, taskId: string, content: string) => {
    const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null }
    });

    if (!task) throw new Error('Task not found');
    if (!(await canAccessTask(user, task))) {
        throw new Error('Forbidden: You cannot comment on this task');
    }

    const comment = await prisma.taskComment.create({
        data: {
            taskId,
            userId: user.id,
            content
        },
        include: {
            user: { select: { id: true, name: true, email: true, role: true } }
        }
    });

    await prisma.taskHistory.create({
        data: {
            taskId,
            userId: user.id,
            action: 'COMMENT_ADDED',
            details: `Comment added by ${user.name}`
        }
    });

    // Notify other task participants
    await notifyTaskParticipants(
        taskId,
        user,
        'TASK_COMMENT',
        `${user.name} commented: "${content.length > 60 ? content.slice(0, 57) + '...' : content}"`
    ).catch(() => {});

    return comment;
};

/**
 * Gets comments for a task.
 */
export const getComments = async (user: User, taskId: string) => {
    const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null }
    });

    if (!task) throw new Error('Task not found');
    if (!(await canAccessTask(user, task))) {
        throw new Error('Forbidden: You cannot view comments for this task');
    }

    return prisma.taskComment.findMany({
        where: { taskId },
        include: {
            user: { select: { id: true, name: true, email: true, role: true } }
        },
        orderBy: { createdAt: 'asc' }
    });
};

/**
 * Gets a single task with all relational data.
 */
export const getTaskById = async (user: User, taskId: string) => {
    const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null },
        include: {
            assignedTo: { select: { id: true, name: true, email: true, role: true } },
            assignedManager: { select: { id: true, name: true, email: true } },
            assignedTeamLead: { select: { id: true, name: true, email: true } },
            createdBy: { select: { id: true, name: true, email: true, role: true } },
            department: { select: { id: true, name: true } },
            team: { select: { id: true, name: true } },
            subTasks: {
                where: { deletedAt: null },
                include: {
                    assignedTo: { select: { id: true, name: true } }
                }
            },
            attachments: true,
            comments: {
                include: {
                    user: { select: { id: true, name: true, role: true } }
                },
                orderBy: { createdAt: 'asc' }
            },
            history: {
                include: {
                    user: { select: { id: true, name: true, role: true } }
                },
                orderBy: { createdAt: 'desc' }
            },
            assignments: {
                include: {
                    user: { select: { id: true, name: true, role: true } }
                }
            }
        }
    });

    if (!task) throw new Error('Task not found');
    if (!(await canAccessTask(user, task))) {
        throw new Error('Forbidden: You do not have access to this task');
    }

    const isOverdue = !!(
        task.dueDate &&
        new Date(task.dueDate) < new Date() &&
        task.status !== 'COMPLETED' &&
        task.status !== 'CANCELLED'
    );

    return {
        ...task,
        isOverdue,
        computedStatus: isOverdue ? 'OVERDUE' : task.status
    };
};

/**
 * Delegates / splits a task to a subordinate Team Lead or Employee.
 */
export const delegateTask = async (
    user: User,
    taskId: string,
    data: { assignedTeamLeadId?: string; assignedEmployeeId?: string; teamId?: string; notes?: string }
) => {
    const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null }
    });

    if (!task) throw new Error('Task not found');
    if (!(await canAccessTask(user, task))) {
        throw new Error('Forbidden: You do not have access to this task');
    }

    if (user.role === 'EMPLOYEE') {
        throw new Error('Employees cannot delegate or reassign tasks');
    }

    const updates: any = {
        status: 'ASSIGNED'
    };

    if (data.assignedEmployeeId) {
        const authorized = await isAuthorizedForTarget(user, data.assignedEmployeeId);
        if (!authorized) throw new Error('Target employee is outside your organizational scope');
        updates.assignedEmployeeId = data.assignedEmployeeId;
        updates.assignedToId = data.assignedEmployeeId;

        // Record assignment
        await prisma.taskAssignment.upsert({
            where: { taskId_userId: { taskId, userId: data.assignedEmployeeId } },
            create: { taskId, userId: data.assignedEmployeeId, role: 'ASSIGNEE' },
            update: { assignedAt: new Date() }
        });
    }

    if (data.assignedTeamLeadId) {
        const authorized = await isAuthorizedForTarget(user, data.assignedTeamLeadId);
        if (!authorized) throw new Error('Target team lead is outside your organizational scope');
        updates.assignedTeamLeadId = data.assignedTeamLeadId;
        if (!data.assignedEmployeeId) {
            updates.assignedToId = data.assignedTeamLeadId;
        }
    }

    if (data.teamId) {
        updates.teamId = data.teamId;
    }

    const updated = await prisma.task.update({
        where: { id: taskId },
        data: updates,
        include: {
            assignedTo: { select: { id: true, name: true, role: true } },
            team: { select: { id: true, name: true } }
        }
    });

    await prisma.taskHistory.create({
        data: {
            taskId,
            userId: user.id,
            action: 'DELEGATED',
            toStatus: 'ASSIGNED',
            details: data.notes || `Task delegated to ${updated.assignedTo?.name || 'subordinate'}`
        }
    });

    return updated;
};

/**
 * Soft-deletes a task.
 */
export const deleteTask = async (user: User, taskId: string) => {
    const task = await prisma.task.findUnique({
        where: { id: taskId, deletedAt: null }
    });

    if (!task) throw new Error('Task not found');
    if (!(await canAccessTask(user, task))) {
        throw new Error('Forbidden: You cannot delete this task');
    }

    if (user.role === 'EMPLOYEE') {
        throw new Error('Employees cannot delete tasks');
    }

    await prisma.task.update({
        where: { id: taskId },
        data: { deletedAt: new Date(), status: 'CANCELLED' }
    });

    await prisma.taskHistory.create({
        data: {
            taskId,
            userId: user.id,
            action: 'DELETED',
            toStatus: 'CANCELLED',
            details: `Task soft deleted by ${user.name}`
        }
    });

    return { success: true };
};

/**
 * Lists tasks within the user's organizational scope with pagination and filters.
 */
export const getTasks = async (user: User, query: TaskQueryInput) => {
    const page = Number(query.page) || 1;
    const limit = Number(query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: any = {
        organizationId: user.organizationId,
        deletedAt: null
    };

    // Role-based scope filtering (Server-Enforced)
    if (user.role === 'EMPLOYEE') {
        where.OR = [
            { assignedToId: user.id },
            { assignedEmployeeId: user.id }
        ];
    } else if (user.role === 'TEAM_LEAD') {
        where.OR = [
            { createdById: user.id },
            { assignedTeamLeadId: user.id },
            { assignedToId: user.id },
            { team: { teamLeadId: user.id } },
            { assignedTo: { teamLeadId: user.id } }
        ];
    } else if (user.role === 'MANAGER') {
        where.OR = [
            { createdById: user.id },
            { assignedManagerId: user.id },
            { assignedToId: user.id },
            ...(user.departmentId ? [{ departmentId: user.departmentId }] : []),
            { department: { managerId: user.id } },
            { team: { teamLead: { managerId: user.id } } }
        ];
    }

    // Additional query filters
    if (query.status) {
        where.status = normalizeStatus(query.status);
    }

    if (query.priority) {
        where.priority = query.priority;
    }

    if (query.departmentId) {
        where.departmentId = query.departmentId;
    }

    if (query.teamId) {
        where.teamId = query.teamId;
    }

    if (query.assignedTo || query.assignedEmployeeId) {
        where.assignedToId = query.assignedTo || query.assignedEmployeeId;
    }

    if (query.assignedTeamLeadId) {
        where.assignedTeamLeadId = query.assignedTeamLeadId;
    }

    if (query.assignedManagerId) {
        where.assignedManagerId = query.assignedManagerId;
    }

    if (query.parentTaskId) {
        where.parentTaskId = query.parentTaskId;
    }

    if (query.search) {
        where.AND = [
            ...(where.AND || []),
            {
                OR: [
                    { title: { contains: query.search, mode: 'insensitive' } },
                    { description: { contains: query.search, mode: 'insensitive' } }
                ]
            }
        ];
    }

    const orderBy: any = {};
    const sortBy = query.sortBy || 'createdAt';
    const sortOrder = query.sortOrder || 'desc';
    orderBy[sortBy] = sortOrder;

    const [total, tasks] = await Promise.all([
        prisma.task.count({ where }),
        prisma.task.findMany({
            where,
            include: {
                assignedTo: { select: { id: true, name: true, email: true, role: true } },
                assignedManager: { select: { id: true, name: true } },
                assignedTeamLead: { select: { id: true, name: true } },
                createdBy: { select: { id: true, name: true, role: true } },
                department: { select: { id: true, name: true } },
                team: { select: { id: true, name: true } }
            },
            skip,
            take: limit,
            orderBy
        })
    ]);

    // Compute dynamic isOverdue flag
    const now = new Date();
    const tasksWithComputed = tasks.map((task) => {
        const isOverdue = !!(
            task.dueDate &&
            new Date(task.dueDate) < now &&
            task.status !== 'COMPLETED' &&
            task.status !== 'CANCELLED'
        );
        return {
            ...task,
            isOverdue,
            computedStatus: isOverdue ? 'OVERDUE' : task.status
        };
    });

    return {
        data: tasksWithComputed,
        meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        }
    };
};