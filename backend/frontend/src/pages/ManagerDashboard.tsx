import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { PaginatedTable } from '../components/PaginatedTable';

export const ManagerDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const res = await axios.get('http://localhost:3000/api/v1/dashboard/manager', { withCredentials: true });
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

    const teamTableData = data.teamBreakdown.map((t: any) => ({
        'Team Name': t.name,
        'Lead': t.teamLead.name,
        'Members': t.memberCount,
        'Total Tasks': t.stats.total,
        'Completion %': `${t.stats.completionRate}%`
    }));

    return (
        <main className="dashboard-container">
            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Regional Overview</h3>
            <div className="grid grid-cols-4" style={{ marginBottom: '2.5rem' }}>
                <div className="stat-card"><h3>{data.aggregated.totalTeams}</h3><p>Total Teams</p></div>
                <div className="stat-card"><h3>{data.aggregated.totalTasks}</h3><p>Total Tasks</p></div>
                <div className="stat-card"><h3>{data.aggregated.completed}</h3><p>Completed Tasks</p></div>
                <div className="stat-card" style={{ borderColor: 'var(--danger)' }}>
                    <h3 style={{ color: 'var(--danger)' }}>{data.aggregated.overdue}</h3>
                    <p>Overdue System-Wide</p>
                </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Team Completion Rates</h3>
                <PaginatedTable columns={['Team Name', 'Lead', 'Members', 'Total Tasks', 'Completion %']} data={teamTableData} />
            </div>
        </main>
    );
};
