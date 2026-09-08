import React, { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboard.service';
import { PaginatedTable } from '../components/PaginatedTable';
import { TaskManagementPanel } from '../components/TaskManagementPanel';

export const ManagerDashboard: React.FC = () => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = async () => {
        try {
            setError(null);
            const res = await dashboardService.getManagerDashboard();
            setData(res);
        } catch (e: any) {
            console.error('Manager dashboard error:', e);
            setError(e.response?.data?.error?.message || e.message || 'Failed to load manager dashboard');
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
                <p style={{ color: 'var(--text-secondary)' }}>Loading Regional / Department Dashboard...</p>
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

    const teamTableData = (data.teamBreakdown || []).map((t: any) => ({
        'Team Name': t.name,
        'Lead': t.teamLead?.name || 'Unassigned',
        'Members': t.memberCount || 0,
        'Total Tasks': t.stats?.total || 0,
        'Completion %': `${t.stats?.completionRate || 0}%`
    }));

    return (
        <main className="dashboard-container">
            <TaskManagementPanel
                userRole="MANAGER"
                onCreated={fetchData}
            />

            <h3 style={{ marginBottom: '1.5rem', fontSize: '1.5rem' }}>Regional & Departmental Overview</h3>
            <div className="grid grid-cols-4" style={{ marginBottom: '2.5rem', gap: '1.25rem' }}>
                <div className="stat-card">
                    <h3>{data.aggregated?.totalTeams || 0}</h3>
                    <p>Total Teams</p>
                </div>
                <div className="stat-card">
                    <h3>{data.aggregated?.totalTasks || 0}</h3>
                    <p>Total Tasks</p>
                </div>
                <div className="stat-card">
                    <h3 style={{ color: 'var(--success)' }}>{data.aggregated?.completed || 0}</h3>
                    <p>Completed Tasks</p>
                </div>
                <div className="stat-card" style={{ borderColor: 'var(--danger)' }}>
                    <h3 style={{ color: 'var(--danger)' }}>{data.aggregated?.overdue || 0}</h3>
                    <p>Overdue Department-Wide</p>
                </div>
            </div>

            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Team Completion Rates</h3>
                <PaginatedTable
                    columns={['Team Name', 'Lead', 'Members', 'Total Tasks', 'Completion %']}
                    data={teamTableData}
                />
            </div>
        </main>
    );
};
