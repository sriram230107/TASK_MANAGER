import React, { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';

type UserRole = 'ADMIN' | 'MANAGER' | 'TEAM_LEAD';

interface TaskManagementPanelProps {
    userRole: UserRole;
    onCreated?: () => void;
}

interface User {
    id: string;
    name: string;
    email?: string;
    role?: string;
}

interface Team {
    id: string;
    name: string;
    teamLead?: {
        id: string;
        name: string;
    };
    members?: User[];
}

interface Task {
    id: string;
    title: string;
    description?: string;
    status: string;
    priority?: string;
    progressPercent?: number;
    dueDate?: string;
    assignedTo?: {
        id: string;
        name: string;
        email?: string;
    };
    team?: {
        id: string;
        name: string;
    };
    createdBy?: {
        id: string;
        name: string;
    };
}

const statusLabel = (status: string) => {
    return status.replaceAll('_', ' ');
};

export const TaskManagementPanel: React.FC<TaskManagementPanelProps> = ({
    userRole,
    onCreated
}) => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('MEDIUM');
    const [dueDate, setDueDate] = useState('');

    const [teamId, setTeamId] = useState('');
    const [assignedToId, setAssignedToId] = useState('');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    /*
     * ---------------------------------------------------------
     * LOAD DATA
     * ---------------------------------------------------------
     */
    const loadData = async () => {
        try {
            setLoading(true);
            setMessage('');

            const requests: Promise<any>[] = [
                api.get('/tasks')
            ];

            if (userRole === 'ADMIN') {
                requests.push(api.get('/admin/dashboard'));
            } else if (userRole === 'MANAGER') {
                requests.push(api.get('/dashboard/manager'));
            } else if (userRole === 'TEAM_LEAD') {
                requests.push(api.get('/dashboard/team-lead'));
            }

            const responses = await Promise.all(requests);

            const taskResponse = responses[0];
            const taskData = taskResponse.data;

            /*
             * Support both:
             *
             * { data: [...] }
             *
             * and
             *
             * [...]
             */
            const loadedTasks =
                Array.isArray(taskData)
                    ? taskData
                    : Array.isArray(taskData?.data)
                        ? taskData.data
                        : Array.isArray(taskData?.tasks)
                            ? taskData.tasks
                            : [];

            setTasks(loadedTasks);

            if (userRole === 'ADMIN') {
                const dashboard = responses[1]?.data;

                setTeams(dashboard?.teams || []);

                const employees =
                    dashboard?.employees ||
                    dashboard?.users ||
                    [];

                setUsers(
                    employees.map((user: any) => ({
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role || 'EMPLOYEE'
                    }))
                );
            }

            if (userRole === 'MANAGER') {
                const dashboard = responses[1]?.data;

                const managerTeams =
                    dashboard?.teamBreakdown ||
                    dashboard?.teams ||
                    [];

                const normalizedTeams: Team[] =
                    managerTeams.map((team: any) => ({
                        id: team.id,
                        name: team.name,
                        teamLead: team.teamLead,
                        members: team.members || []
                    }));

                setTeams(normalizedTeams);

                /*
                 * Manager can assign to:
                 * - Team Leads of managed teams
                 * - Employees inside managed teams
                 */
                const managerUsers: User[] = [];

                normalizedTeams.forEach((team) => {
                    if (team.teamLead?.id) {
                        managerUsers.push({
                            id: team.teamLead.id,
                            name: team.teamLead.name,
                            role: 'TEAM_LEAD'
                        });
                    }

                    (team.members || []).forEach((member) => {
                        managerUsers.push({
                            id: member.id,
                            name: member.name,
                            email: member.email,
                            role: member.role || 'EMPLOYEE'
                        });
                    });
                });

                const uniqueUsers = Array.from(
                    new Map(
                        managerUsers.map((user) => [
                            user.id,
                            user
                        ])
                    ).values()
                );

                setUsers(uniqueUsers);
            }

            if (userRole === 'TEAM_LEAD') {
                const dashboard = responses[1]?.data;

                /*
                 * IMPORTANT:
                 *
                 * Team Lead does NOT select a team.
                 * The dashboard already knows their team.
                 */
                const teamMembers =
                    dashboard?.employees ||
                    dashboard?.members ||
                    [];

                setUsers(
                    teamMembers
                        .filter(
                            (user: any) =>
                                user.role !== 'TEAM_LEAD'
                        )
                        .map((user: any) => ({
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            role: user.role || 'EMPLOYEE'
                        }))
                );

                /*
                 * We intentionally do NOT populate a team
                 * dropdown for Team Lead.
                 */
                setTeams([]);
            }
        } catch (error: any) {
            console.error(
                'Task management load error:',
                error
            );

            setMessage(
                error?.response?.data?.message ||
                'Unable to load task management data'
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [userRole]);

    /*
     * ---------------------------------------------------------
     * FILTER USERS BY SELECTED TEAM
     * ---------------------------------------------------------
     */
    const availableUsers = useMemo(() => {
        if (userRole === 'TEAM_LEAD') {
            return users;
        }

        if (!teamId) {
            return users;
        }

        const selectedTeam = teams.find(
            (team) => team.id === teamId
        );

        if (!selectedTeam) {
            return users;
        }

        const allowedIds = new Set<string>();

        if (selectedTeam.teamLead?.id) {
            allowedIds.add(selectedTeam.teamLead.id);
        }

        (selectedTeam.members || []).forEach((member) => {
            allowedIds.add(member.id);
        });

        return users.filter((user) =>
            allowedIds.has(user.id)
        );
    }, [users, teams, teamId, userRole]);

    /*
     * ---------------------------------------------------------
     * CREATE TASK
     * ---------------------------------------------------------
     */
    const createTask = async (
        event: React.FormEvent
    ) => {
        event.preventDefault();

        setMessage('');

        if (!title.trim()) {
            setMessage('Task title is required');
            return;
        }

        if (!assignedToId) {
            setMessage('Please select an assignee');
            return;
        }

        /*
         * Only ADMIN and MANAGER choose a team.
         * Team Lead's backend scope should determine the team.
         */
        if (
            (userRole === 'ADMIN' ||
                userRole === 'MANAGER') &&
            !teamId
        ) {
            setMessage('Please select a team');
            return;
        }

        try {
            setSaving(true);

            const payload: any = {
                title: title.trim(),
                description: description.trim() || undefined,
                priority,
                assignedToId,
                dueDate: dueDate || undefined
            };

            /*
             * Team Lead does not manually provide teamId.
             */
            if (
                userRole === 'ADMIN' ||
                userRole === 'MANAGER'
            ) {
                payload.teamId = teamId;
            }

            await api.post('/tasks', payload);

            setMessage(
                'Task created and assigned successfully'
            );

            setTitle('');
            setDescription('');
            setPriority('MEDIUM');
            setDueDate('');
            setAssignedToId('');
            setTeamId('');

            await loadData();

            onCreated?.();
        } catch (error: any) {
            console.error(
                'Create task error:',
                error
            );

            setMessage(
                error?.response?.data?.message ||
                'Failed to create task'
            );
        } finally {
            setSaving(false);
        }
    };

    /*
     * ---------------------------------------------------------
     * TASKS VISIBLE TO CURRENT ROLE
     * ---------------------------------------------------------
     *
     * Backend should already enforce authorization.
     * This frontend filter is only for presentation.
     */
    const visibleTasks = useMemo(() => {
        return tasks;
    }, [tasks]);

    /*
     * ---------------------------------------------------------
     * UI
     * ---------------------------------------------------------
     */
    return (
        <section
            style={{
                marginBottom: '2rem'
            }}
        >
            {/* =================================================
                CREATE TASK
            ================================================= */}
            <div
                style={{
                    padding: '1.25rem',
                    border: '1px solid var(--border)',
                    borderRadius: '10px',
                    marginBottom: '1.5rem'
                }}
            >
                <h2 style={{ marginBottom: '0.5rem' }}>
                    Create Task
                </h2>

                <p
                    style={{
                        color: 'var(--text-secondary)',
                        marginBottom: '1.25rem'
                    }}
                >
                    {userRole === 'TEAM_LEAD'
                        ? 'Create and assign tasks to members of your team.'
                        : userRole === 'MANAGER'
                            ? 'Create and assign tasks to teams and team members under your management.'
                            : 'Create and assign tasks across your organization.'}
                </p>

                <form onSubmit={createTask}>
                    {/* TITLE */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label>
                            <strong>Task Title</strong>
                        </label>

                        <input
                            type="text"
                            value={title}
                            onChange={(event) =>
                                setTitle(event.target.value)
                            }
                            placeholder="Enter task title"
                            style={{
                                width: '100%',
                                padding: '0.6rem',
                                marginTop: '0.25rem'
                            }}
                        />
                    </div>

                    {/* DESCRIPTION */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label>
                            <strong>Description</strong>
                        </label>

                        <textarea
                            value={description}
                            onChange={(event) =>
                                setDescription(
                                    event.target.value
                                )
                            }
                            placeholder="Describe the task"
                            style={{
                                width: '100%',
                                minHeight: '90px',
                                marginTop: '0.25rem'
                            }}
                        />
                    </div>

                    {/* TEAM
                        ONLY ADMIN + MANAGER
                    */}
                    {(
                        userRole === 'ADMIN' ||
                        userRole === 'MANAGER'
                    ) && (
                        <div style={{ marginBottom: '1rem' }}>
                            <label>
                                <strong>Team</strong>
                            </label>

                            <select
                                value={teamId}
                                onChange={(event) => {
                                    setTeamId(
                                        event.target.value
                                    );
                                    setAssignedToId('');
                                }}
                                style={{
                                    width: '100%',
                                    padding: '0.6rem',
                                    marginTop: '0.25rem'
                                }}
                            >
                                <option value="">
                                    Select team
                                </option>

                                {teams.map((team) => (
                                    <option
                                        key={team.id}
                                        value={team.id}
                                    >
                                        {team.name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* ASSIGNEE */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label>
                            <strong>Assign To</strong>
                        </label>

                        <select
                            value={assignedToId}
                            onChange={(event) =>
                                setAssignedToId(
                                    event.target.value
                                )
                            }
                            style={{
                                width: '100%',
                                padding: '0.6rem',
                                marginTop: '0.25rem'
                            }}
                        >
                            <option value="">
                                Select assignee
                            </option>

                            {availableUsers.map((user) => (
                                <option
                                    key={user.id}
                                    value={user.id}
                                >
                                    {user.name}
                                    {user.role
                                        ? ` (${user.role})`
                                        : ''}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* PRIORITY */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label>
                            <strong>Priority</strong>
                        </label>

                        <select
                            value={priority}
                            onChange={(event) =>
                                setPriority(
                                    event.target.value
                                )
                            }
                            style={{
                                width: '100%',
                                padding: '0.6rem',
                                marginTop: '0.25rem'
                            }}
                        >
                            <option value="LOW">
                                Low
                            </option>
                            <option value="MEDIUM">
                                Medium
                            </option>
                            <option value="HIGH">
                                High
                            </option>
                            <option value="URGENT">
                                Urgent
                            </option>
                        </select>
                    </div>

                    {/* DUE DATE */}
                    <div style={{ marginBottom: '1rem' }}>
                        <label>
                            <strong>Due Date</strong>
                        </label>

                        <input
                            type="date"
                            value={dueDate}
                            onChange={(event) =>
                                setDueDate(
                                    event.target.value
                                )
                            }
                            style={{
                                width: '100%',
                                padding: '0.6rem',
                                marginTop: '0.25rem'
                            }}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn"
                        disabled={saving}
                    >
                        {saving
                            ? 'Creating...'
                            : 'Create & Assign Task'}
                    </button>
                </form>

                {message && (
                    <div
                        style={{
                            marginTop: '1rem',
                            padding: '0.75rem',
                            borderRadius: '6px'
                        }}
                    >
                        {message}
                    </div>
                )}
            </div>

            {/* =================================================
                TASK LIST
            ================================================= */}
            <div
                style={{
                    padding: '1.25rem',
                    border: '1px solid var(--border)',
                    borderRadius: '10px'
                }}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '1rem'
                    }}
                >
                    <div>
                        <h2>
                            {userRole === 'TEAM_LEAD'
                                ? 'My Team Tasks'
                                : userRole === 'MANAGER'
                                    ? 'Managed Team Tasks'
                                    : 'Organization Tasks'}
                        </h2>

                        <p
                            style={{
                                color: 'var(--text-secondary)'
                            }}
                        >
                            Tasks visible to your role.
                        </p>
                    </div>

                    <button
                        type="button"
                        className="btn"
                        onClick={loadData}
                        disabled={loading}
                    >
                        {loading
                            ? 'Loading...'
                            : 'Refresh'}
                    </button>
                </div>

                {loading ? (
                    <p>Loading tasks...</p>
                ) : visibleTasks.length === 0 ? (
                    <p
                        style={{
                            color: 'var(--text-secondary)'
                        }}
                    >
                        No tasks available.
                    </p>
                ) : (
                    <div
                        style={{
                            display: 'grid',
                            gap: '0.75rem'
                        }}
                    >
                        {visibleTasks.map((task) => (
                            <div
                                key={task.id}
                                style={{
                                    padding: '1rem',
                                    border:
                                        '1px solid var(--border)',
                                    borderRadius: '8px'
                                }}
                            >
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent:
                                            'space-between',
                                        gap: '1rem',
                                        flexWrap: 'wrap'
                                    }}
                                >
                                    <div>
                                        <strong>
                                            {task.title}
                                        </strong>

                                        {task.description && (
                                            <p
                                                style={{
                                                    margin:
                                                        '0.4rem 0',
                                                    color:
                                                        'var(--text-secondary)'
                                                }}
                                            >
                                                {
                                                    task.description
                                                }
                                            </p>
                                        )}
                                    </div>

                                    <span>
                                        {statusLabel(
                                            task.status
                                        )}
                                    </span>
                                </div>

                                <div
                                    style={{
                                        display: 'grid',
                                        gap: '0.25rem',
                                        marginTop: '0.75rem',
                                        fontSize: '0.9rem'
                                    }}
                                >
                                    <div>
                                        <strong>
                                            Assigned To:
                                        </strong>{' '}
                                        {task.assignedTo?.name ||
                                            'Unassigned'}
                                    </div>

                                    {task.team?.name && (
                                        <div>
                                            <strong>
                                                Team:
                                            </strong>{' '}
                                            {task.team.name}
                                        </div>
                                    )}

                                    {task.priority && (
                                        <div>
                                            <strong>
                                                Priority:
                                            </strong>{' '}
                                            {statusLabel(
                                                task.priority
                                            )}
                                        </div>
                                    )}

                                    <div>
                                        <strong>
                                            Progress:
                                        </strong>{' '}
                                        {task.progressPercent ??
                                            0}
                                        %
                                    </div>

                                    {task.dueDate && (
                                        <div>
                                            <strong>
                                                Due:
                                            </strong>{' '}
                                            {new Date(
                                                task.dueDate
                                            ).toLocaleDateString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};