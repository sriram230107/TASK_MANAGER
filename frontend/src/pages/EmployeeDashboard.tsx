import React, { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboard.service';
import { TaskCard } from '../components/TaskCard';
import { Calendar } from '../components/Calendar';
import type { Task } from '../services/task.service';

export const EmployeeDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [viewMode, setViewMode] = useState<'cards' | 'calendar'>('cards');

    const fetchData = async () => {
        try {
            setError(null);
            const res = await dashboardService.getEmployeeDashboard();
            setData(res);
        } catch (e: any) {
            console.error('Employee dashboard error:', e);
            setError(e.response?.data?.error?.message || e.message || 'Failed to load employee dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <main className="dashboard-container" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading your dashboard & assigned tasks...</p>
            </main>
        );
    }

    if (error || !data) {
        return (
            <main className="dashboard-container" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error || 'Failed to load data'}</div>
                <button className="btn" onClick={() => { setLoading(true); fetchData(); }}>
                    Retry
                </button>
            </main>
        );
    }

    const tasks: Task[] = data.tasks || [];
    const stats = data.stats || {
        active: tasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'ACCEPTED').length,
        completed: tasks.filter(t => t.status === 'COMPLETED').length,
        overdue: tasks.filter(t => t.isOverdue || t.computedStatus === 'OVERDUE').length,
        blocked: tasks.filter(t => t.status === 'ON_HOLD').length
    };

    return (
        <main className="dashboard-container">
            {/* Stat Cards */}
            <div className="grid grid-cols-4" style={{ marginBottom: '2.5rem', gap: '1.25rem' }}>
                <div className="stat-card">
                    <h3>{stats.active}</h3>
                    <p>Active Tasks</p>
                </div>
                <div className="stat-card">
                    <h3 style={{ color: 'var(--success)' }}>{stats.completed}</h3>
                    <p>Completed</p>
                </div>
                <div className="stat-card" style={{ borderColor: stats.overdue > 0 ? 'var(--danger)' : undefined }}>
                    <h3 style={{ color: stats.overdue > 0 ? 'var(--danger)' : undefined }}>{stats.overdue}</h3>
                    <p>Overdue</p>
                </div>
                <div className="stat-card">
                    <h3 style={{ color: 'var(--warning)' }}>{stats.blocked}</h3>
                    <p>On Hold</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '2rem', alignItems: 'start' }}>
                {/* My Profile Column */}
                <div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>My Profile</h3>
                    <div
                        className="auth-card"
                        style={{
                            padding: '1.5rem',
                            width: '100%',
                            maxWidth: '100%',
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px'
                        }}
                    >
                        <div style={{ marginBottom: '0.75rem' }}>
                            <strong style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>NAME</strong>
                            <div style={{ fontSize: '1rem', fontWeight: 500, marginTop: '0.15rem' }}>{data.profile?.name}</div>
                        </div>

                        <div style={{ marginBottom: '0.75rem' }}>
                            <strong style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>EMAIL</strong>
                            <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: '0.15rem' }}>{data.profile?.email}</div>
                        </div>

                        <div style={{ marginBottom: '0.75rem' }}>
                            <strong style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>ROLE</strong>
                            <div style={{ fontSize: '0.9rem', color: 'var(--accent-color)', fontWeight: 600, marginTop: '0.15rem' }}>{data.profile?.role}</div>
                        </div>

                        {data.profile?.department && (
                            <div style={{ marginBottom: '0.75rem' }}>
                                <strong style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>DEPARTMENT</strong>
                                <div style={{ fontSize: '0.9rem', marginTop: '0.15rem' }}>{data.profile.department.name}</div>
                            </div>
                        )}

                        <div>
                            <strong style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>REPORTING MANAGER</strong>
                            <div style={{ fontSize: '0.9rem', marginTop: '0.15rem' }}>{data.profile?.manager?.name || 'None Assigned'}</div>
                        </div>
                    </div>
                </div>

                {/* Assigned Tasks Column */}
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Assigned Tasks ({tasks.length})</h3>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                className={viewMode === 'cards' ? 'btn' : 'btn-secondary'}
                                onClick={() => setViewMode('cards')}
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                            >
                                Cards
                            </button>
                            <button
                                className={viewMode === 'calendar' ? 'btn' : 'btn-secondary'}
                                onClick={() => setViewMode('calendar')}
                                style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                            >
                                Calendar
                            </button>
                            <button className="btn-secondary" onClick={fetchData} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>
                                ↻ Refresh
                            </button>
                        </div>
                    </div>

                    {viewMode === 'calendar' ? (
                        <Calendar />
                    ) : tasks.length === 0 ? (
                        <div style={{ padding: '3rem 1rem', textAlign: 'center', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
                            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>No tasks currently assigned to you.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2" style={{ gap: '1.25rem' }}>
                            {tasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    userRole="EMPLOYEE"
                                    onUpdated={fetchData}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
};
