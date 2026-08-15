import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TaskCard } from '../components/TaskCard';
import { PaginatedTable } from '../components/PaginatedTable';
import { StatusBadge } from '../components/StatusBadge';
import { Calendar } from '../components/Calendar';

export const TeamLeadDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get('http://localhost:3000/api/v1/dashboard/team-lead', { withCredentials: true });
                setData(res.data);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading dashboard...</div>;
    if (!data) return <div style={{ padding: '2rem', color: 'var(--danger)' }}>Failed to load data</div>;

    const employeeTableData = data.employees.map((e: any) => ({
        'Employee': e.name,
        'Team': e.teamName,
        'Active Tasks': e.stats?.active || 0,
        'Completed': e.stats?.completed || 0
    }));

    return (
        <main className="dashboard-container">
            <div className="grid grid-cols-4" style={{ marginBottom: '2.5rem' }}>
                <div className="stat-card"><h3>{data.overall.active}</h3><p>Active</p></div>
                <div className="stat-card"><h3>{data.overall.completed}</h3><p>Completed</p></div>
                <div className="stat-card"><h3>{data.overall.overdue}</h3><p>Overdue</p></div>
                <div className="stat-card" style={{ borderColor: 'var(--warning)' }}>
                    <h3 style={{ color: 'var(--warning)' }}>{data.pendingReview.length}</h3>
                    <p>Pending Review</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem', marginBottom: '2rem' }}>
                <div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Approval Queue</h3>
                    {data.pendingReview.length === 0 ? (
                        <div style={{ padding: '2rem', background: 'var(--bg-secondary)', borderRadius: '8px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No tasks pending review.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1">
                            {data.pendingReview.map((t: any) => (
                                <div key={t.id} className="task-card" style={{ borderLeft: '4px solid var(--warning)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                        <h4 style={{ margin: 0, fontSize: '1.125rem' }}>{t.title}</h4>
                                        <StatusBadge status={t.status} />
                                    </div>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>Assignee: {t.assignedTo.name}</p>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button className="btn" style={{ padding: '0.5rem 1rem', background: 'var(--success)' }}>Approve</button>
                                        <button className="btn" style={{ padding: '0.5rem 1rem', background: 'var(--danger)' }}>Reject</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Team Overview</h3>
                    <PaginatedTable columns={['Employee', 'Team', 'Active Tasks', 'Completed']} data={employeeTableData} />
                </div>
            </div>
        </main>
    );
};
