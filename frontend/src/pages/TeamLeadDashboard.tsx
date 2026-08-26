import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { PaginatedTable } from '../components/PaginatedTable';
import { TaskCard } from '../components/TaskCard';
import { TaskManagementPanel } from '../components/TaskManagementPanel';

export const TeamLeadDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const res = await api.get('/dashboard/team-lead');
            setData(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    if (loading) {
        return (
            <div style={{ padding: '2rem', textAlign: 'center' }}>
                Loading dashboard...
            </div>
        );
    }

    if (!data) {
        return (
            <div style={{ padding: '2rem', color: 'var(--danger)' }}>
                Failed to load data
            </div>
        );
    }

    const employeeTableData = data.employees.map((e: any) => ({
        Employee: e.name,
        Team: e.teamName,
        'Active Tasks': e.stats?.active || 0,
        Completed: e.stats?.completed || 0
    }));

    return (
        <main className="dashboard-container">

            <TaskManagementPanel
                userRole="TEAM_LEAD"
                onCreated={fetchData}
            />

            <div
                className="grid grid-cols-4"
                style={{ marginBottom: '2.5rem' }}
            >
                <div className="stat-card">
                    <h3>{data.overall.active}</h3>
                    <p>Active</p>
                </div>

                <div className="stat-card">
                    <h3>{data.overall.completed}</h3>
                    <p>Completed</p>
                </div>

                <div className="stat-card">
                    <h3>{data.overall.overdue}</h3>
                    <p>Overdue</p>
                </div>

                <div
                    className="stat-card"
                    style={{ borderColor: 'var(--warning)' }}
                >
                    <h3 style={{ color: 'var(--warning)' }}>
                        {data.pendingReview.length}
                    </h3>
                    <p>Pending Review</p>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns:
                        'minmax(0, 1fr) minmax(0, 1fr)',
                    gap: '2rem',
                    marginBottom: '2rem'
                }}
            >

                {/* APPROVAL QUEUE */}
                <div>
                    <h3
                        style={{
                            marginBottom: '1rem',
                            fontSize: '1.25rem'
                        }}
                    >
                        Approval Queue
                    </h3>

                    {data.pendingReview.length === 0 ? (
                        <div
                            style={{
                                padding: '2rem',
                                background: 'var(--bg-secondary)',
                                borderRadius: '8px',
                                textAlign: 'center',
                                color: 'var(--text-secondary)'
                            }}
                        >
                            No tasks pending review.
                        </div>
                    ) : (
                        <div className="grid grid-cols-1">
                            {data.pendingReview.map((task: any) => (
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
                    <h3
                        style={{
                            marginBottom: '1rem',
                            fontSize: '1.25rem'
                        }}
                    >
                        Team Overview
                    </h3>

                    <PaginatedTable
                        columns={[
                            'Employee',
                            'Team',
                            'Active Tasks',
                            'Completed'
                        ]}
                        data={employeeTableData}
                    />
                </div>

            </div>
        </main>
    );
};


