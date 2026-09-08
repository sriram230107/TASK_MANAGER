import React, { useEffect, useState } from 'react';
import { taskService, type Task, type TaskPriority } from '../services/task.service';
import { TaskCard } from './TaskCard';
import api from '../api/axios';

type UserRole = 'ADMIN' | 'MANAGER' | 'TEAM_LEAD' | 'EMPLOYEE';

interface TaskManagementPanelProps {
    userRole: UserRole;
    onCreated?: () => void;
}

interface UserOption {
    id: string;
    name: string;
    email?: string;
    role?: string;
}

interface TeamOption {
    id: string;
    name: string;
}

export const TaskManagementPanel: React.FC<TaskManagementPanelProps> = ({
    userRole,
    onCreated
}) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [teams, setTeams] = useState<TeamOption[]>([]);
    const [users, setUsers] = useState<UserOption[]>([]);
    const [filterStatus, setFilterStatus] = useState<string>('ALL');

    // Create Task Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<TaskPriority>('MEDIUM');
    const [departmentId, setDepartmentId] = useState('');
    const [teamId, setTeamId] = useState('');
    const [assigneeId, setAssigneeId] = useState('');
    const [estimatedHours, setEstimatedHours] = useState('');
    const [dueDate, setDueDate] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const loadData = async () => {
        try {
            setLoading(true);
            const taskRes = await taskService.listTasks({ limit: 50 });
            setTasks(taskRes.data);

            // Fetch team and user options based on role for assignment
            if (userRole === 'ADMIN') {
                const adminDashRes = await api.get('/admin/dashboard');
                const adminData = adminDashRes.data.data || adminDashRes.data;
                if (adminData.users) {
                    setUsers(adminData.users.map((u: any) => ({ id: u.id, name: u.name, role: u.role })));
                }
                if (adminData.teams) {
                    setTeams(adminData.teams.map((t: any) => ({ id: t.id, name: t.name })));
                }
            } else if (userRole === 'MANAGER') {
                const mgrDashRes = await api.get('/dashboard/manager');
                const mgrData = mgrDashRes.data.data || mgrDashRes.data;
                if (mgrData.teamBreakdown) {
                    setTeams(mgrData.teamBreakdown.map((t: any) => ({ id: t.id, name: t.name })));
                    const allMembers: UserOption[] = [];
                    mgrData.teamBreakdown.forEach((t: any) => {
                        if (t.teamLead) allMembers.push({ id: t.teamLead.id, name: t.teamLead.name, role: 'TEAM_LEAD' });
                    });
                    setUsers(allMembers);
                }
            } else if (userRole === 'TEAM_LEAD') {
                const leadDashRes = await api.get('/dashboard/team-lead');
                const leadData = leadDashRes.data.data || leadDashRes.data;
                if (leadData.employees) {
                    setUsers(leadData.employees.map((e: any) => ({ id: e.id, name: e.name, role: 'EMPLOYEE' })));
                }
            }
            // EMPLOYEE role only views assigned tasks; no assignment options needed
        } catch (error: any) {
            console.error('Failed to load task management data:', error);
            setMessage({ text: 'Failed to load task data', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [userRole]);

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return;

        try {
            setSaving(true);
            setMessage(null);

            await taskService.createTask({
                title: title.trim(),
                description: description.trim() || undefined,
                priority,
                departmentId: departmentId || undefined,
                teamId: teamId || undefined,
                assignedToId: assigneeId || undefined,
                assignedEmployeeId: assigneeId || undefined,
                estimatedHours: estimatedHours ? Number(estimatedHours) : undefined,
                dueDate: dueDate ? new Date(dueDate).toISOString() : undefined
            });

            setMessage({ text: 'Task created successfully and saved to DB!', type: 'success' });
            setTitle('');
            setDescription('');
            setDepartmentId('');
            setTeamId('');
            setAssigneeId('');
            setEstimatedHours('');
            setDueDate('');
            setShowCreateModal(false);

            await loadData();
            onCreated?.();
        } catch (error: any) {
            const errText =
                error.response?.data?.error?.message ||
                error.response?.data?.message ||
                error.message ||
                'Failed to create task';
            setMessage({ text: errText, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Filter tasks based on selected tab
    const filteredTasks = tasks.filter((t) => {
        if (filterStatus === 'ALL') return true;
        if (filterStatus === 'ACTIVE') {
            return t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED' || t.status === 'ASSIGNED';
        }
        if (filterStatus === 'REVIEW') {
            return t.status === 'SUBMITTED' || t.status === 'UNDER_REVIEW';
        }
        if (filterStatus === 'COMPLETED') {
            return t.status === 'COMPLETED';
        }
        if (filterStatus === 'OVERDUE') {
            return t.isOverdue || t.computedStatus === 'OVERDUE';
        }
        return true;
    });

    return (
        <div style={{ marginBottom: '2.5rem' }}>
            {/* Header with Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
                        {userRole === 'EMPLOYEE' ? 'My Assigned Tasks' : 'Task Operations'}
                    </h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        {userRole === 'EMPLOYEE'
                            ? 'Manage your active work sessions, submit for review, and update progress'
                            : 'Full lifecycle tracking, assignment delegation, and review workflows'}
                    </p>
                </div>

                {userRole !== 'EMPLOYEE' && (
                    <button
                        className="btn"
                        onClick={() => setShowCreateModal(!showCreateModal)}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                    >
                        {showCreateModal ? 'Close Form' : '+ Create New Task'}
                    </button>
                )}
            </div>

            {message && (
                <div
                    style={{
                        padding: '0.75rem 1rem',
                        marginBottom: '1rem',
                        borderRadius: '6px',
                        background: message.type === 'success' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        border: `1px solid ${message.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                        color: message.type === 'success' ? 'var(--success)' : 'var(--danger)',
                        fontSize: '0.875rem'
                    }}
                >
                    {message.text}
                </div>
            )}

            {/* CREATE TASK MODAL / EXPANDABLE PANEL */}
            {showCreateModal && (
                <div
                    className="auth-card"
                    style={{
                        maxWidth: '100%',
                        marginBottom: '2rem',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--accent-color)',
                        padding: '1.5rem'
                    }}
                >
                    <h3 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>New Organization Task</h3>
                    <form onSubmit={handleCreateTask}>
                        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Task Title *</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    required
                                    placeholder="e.g. Implement OAuth2 Refresh Strategy"
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Priority</label>
                                <select
                                    value={priority}
                                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                >
                                    <option value="LOW">LOW</option>
                                    <option value="MEDIUM">MEDIUM</option>
                                    <option value="HIGH">HIGH</option>
                                    <option value="URGENT">URGENT</option>
                                </select>
                            </div>
                        </div>

                        <div className="form-group" style={{ marginBottom: '1rem' }}>
                            <label>Description</label>
                            <textarea
                                rows={2}
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Detailed task objectives, requirements, and deliverables"
                                style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                            {teams.length > 0 && (
                                <div className="form-group" style={{ margin: 0 }}>
                                    <label>Assign Team</label>
                                    <select
                                        value={teamId}
                                        onChange={(e) => setTeamId(e.target.value)}
                                        style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                    >
                                        <option value="">Select Team (Optional)</option>
                                        {teams.map((t) => (
                                            <option key={t.id} value={t.id}>{t.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Assignee</label>
                                <select
                                    value={assigneeId}
                                    onChange={(e) => setAssigneeId(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                >
                                    <option value="">Select Assignee (Optional)</option>
                                    {users.map((u) => (
                                        <option key={u.id} value={u.id}>{u.name} ({u.role || 'Member'})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Estimated Hours</label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.5"
                                    placeholder="e.g. 16"
                                    value={estimatedHours}
                                    onChange={(e) => setEstimatedHours(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                            </div>

                            <div className="form-group" style={{ margin: 0 }}>
                                <label>Due Date</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={(e) => setDueDate(e.target.value)}
                                    style={{ width: '100%', padding: '0.5rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                />
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                            <button
                                type="button"
                                className="btn-secondary"
                                onClick={() => setShowCreateModal(false)}
                                disabled={saving}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="btn"
                                disabled={saving || !title.trim()}
                            >
                                {saving ? 'Creating in Database...' : 'Save & Publish Task'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', flexWrap: 'wrap' }}>
                {[
                    { key: 'ALL', label: `All (${tasks.length})` },
                    { key: 'ACTIVE', label: 'Active Work' },
                    { key: 'REVIEW', label: 'In Review' },
                    { key: 'OVERDUE', label: 'Overdue' },
                    { key: 'COMPLETED', label: 'Completed' }
                ].map((tab) => (
                    <button
                        key={tab.key}
                        onClick={() => setFilterStatus(tab.key)}
                        style={{
                            background: filterStatus === tab.key ? 'var(--accent-color)' : 'transparent',
                            color: filterStatus === tab.key ? '#fff' : 'var(--text-secondary)',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.85rem',
                            fontWeight: 500
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Task Grid */}
            {loading ? (
                <div style={{ padding: '3rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                    <span className="spinner" style={{ width: '1.75rem', height: '1.75rem', marginBottom: '0.75rem' }} />
                    <p style={{ margin: 0 }}>Loading tasks from database...</p>
                </div>
            ) : filteredTasks.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📋</div>
                    <div className="empty-state-title">No tasks found</div>
                    <p className="empty-state-desc">
                        {filterStatus === 'ALL'
                            ? 'There are currently no tasks assigned or available in your scope.'
                            : `No tasks matching the "${filterStatus}" filter.`}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-2" style={{ gap: '1.25rem' }}>
                    {filteredTasks.map((t) => (
                        <TaskCard
                            key={t.id}
                            task={t}
                            userRole={userRole}
                            onUpdated={loadData}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};