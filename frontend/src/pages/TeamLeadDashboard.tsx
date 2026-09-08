import React, { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboard.service';
import { PaginatedTable } from '../components/PaginatedTable';
import { TaskCard } from '../components/TaskCard';
import { TaskManagementPanel } from '../components/TaskManagementPanel';

export const TeamLeadDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setError(null);
            const res = await dashboardService.getTeamLeadDashboard();
            setData(res);
        } catch (e: any) {
            console.error('Team lead dashboard error:', e);
            setError(e.response?.data?.error?.message || e.message || 'Failed to load dashboard');
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
                <p style={{ color: 'var(--text-secondary)' }}>Loading Team Lead Dashboard...</p>
            </main>
        );
    }

    if (error || !data) {
        return (
            <main className="dashboard-container" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error || 'Failed to load data'}</div>
                <button className="btn" onClick={() => { setLoading(true); fetchData(); }}>Retry</button>
            </main>
        );
    }

    const employeeTableData = (data.employees || []).map((e: any) => ({
        Employee: e.name,
        Team: e.teamName || 'Primary Team',
        'Active Tasks': e.stats?.active || 0,
        Completed: e.stats?.completed || 0
    }));

    const pendingReviewTasks = data.pendingReview || [];

    return (
        <main className="dashboard-container">
            <TaskManagementPanel
                userRole="TEAM_LEAD"
                onCreated={fetchData}
            />

            <div className="grid grid-cols-4" style={{ marginBottom: '2.5rem', gap: '1.25rem' }}>
                <div className="stat-card">
                    <h3>{data.overall?.active || 0}</h3>
                    <p>Active Tasks</p>
                </div>
                <div className="stat-card">
                    <h3 style={{ color: 'var(--success)' }}>{data.overall?.completed || 0}</h3>
                    <p>Completed</p>
                </div>
                <div className="stat-card">
                    <h3 style={{ color: (data.overall?.overdue || 0) > 0 ? 'var(--danger)' : undefined }}>
                        {data.overall?.overdue || 0}
                    </h3>
                    <p>Overdue</p>
                </div>
                <div className="stat-card" style={{ borderColor: 'var(--warning)' }}>
                    <h3 style={{ color: 'var(--warning)' }}>{pendingReviewTasks.length}</h3>
                    <p>Pending Review</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
                {/* APPROVAL QUEUE */}
                <div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>
                        Review Queue ({pendingReviewTasks.length})
                    </h3>

                    {pendingReviewTasks.length === 0 ? (
                        <div style={{ padding: '2rem', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No tasks currently awaiting review.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1" style={{ gap: '1rem' }}>
                            {pendingReviewTasks.map((task: any) => (
                                <TaskCard
                                    key={task.id}
                                    task={task}
                                    userRole="TEAM_LEAD"
                                    onUpdated={fetchData}
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* TEAM OVERVIEW */}
                <div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Team Members</h3>
                    <PaginatedTable
                        columns={['Employee', 'Team', 'Active Tasks', 'Completed']}
                        data={employeeTableData}
                    />
                </div>
            </div>
        </main>
    );
};
