import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { TaskCard } from '../components/TaskCard';

export const EmployeeDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const token = localStorage.getItem('token');

                if (!token) {
                    console.error('No authentication token found');
                    return;
                }

                const res = await axios.get(
                    'http://localhost:3000/api/v1/dashboard/employee',
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                );

                setData(res.data);
            } catch (e) {
                console.error('Employee dashboard error:', e);
            } finally {
                setLoading(false);
            }
        };

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

    return (
        <main className="dashboard-container">
            <div
                className="grid grid-cols-4"
                style={{ marginBottom: '2.5rem' }}
            >
                <div className="stat-card">
                    <h3>{data.stats.active}</h3>
                    <p>Active Tasks</p>
                </div>

                <div className="stat-card">
                    <h3>{data.stats.completed}</h3>
                    <p>Completed</p>
                </div>

                <div className="stat-card">
                    <h3>{data.stats.overdue}</h3>
                    <p>Overdue</p>
                </div>

                <div className="stat-card">
                    <h3>{data.stats.blocked}</h3>
                    <p>Blocked</p>
                </div>
            </div>

            <div
                style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 3fr',
                    gap: '2rem'
                }}
            >
                <div>
                    <h3
                        style={{
                            marginBottom: '1rem',
                            fontSize: '1.25rem'
                        }}
                    >
                        My Profile
                    </h3>

                    <div
                        className="auth-card"
                        style={{
                            padding: '1.5rem',
                            width: '100%',
                            maxWidth: '100%'
                        }}
                    >
                        <div style={{ marginBottom: '0.75rem' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>
                                Name:
                            </strong>
                            <br />
                            {data.profile.name}
                        </div>

                        <div style={{ marginBottom: '0.75rem' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>
                                Email:
                            </strong>
                            <br />
                            {data.profile.email}
                        </div>

                        <div style={{ marginBottom: '0.75rem' }}>
                            <strong style={{ color: 'var(--text-secondary)' }}>
                                Manager:
                            </strong>
                            <br />
                            {data.profile.manager?.name || 'None'}
                        </div>
                    </div>
                </div>

                <div>
                    <h3
                        style={{
                            marginBottom: '1rem',
                            fontSize: '1.25rem'
                        }}
                    >
                        Assigned Tasks
                    </h3>

                    <div className="grid grid-cols-2">
                        {data.tasks.map((t: any) => (
                            <TaskCard key={t.id} task={t} />
                        ))}

                        {data.tasks.length === 0 && (
                            <p style={{ color: 'var(--text-secondary)' }}>
                                No tasks assigned right now.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
};