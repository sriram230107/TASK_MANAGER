import React, { useEffect, useState } from 'react';
import { dashboardService } from '../services/dashboard.service';
import { PaginatedTable } from '../components/PaginatedTable';
import { TaskManagementPanel } from '../components/TaskManagementPanel';
import api from '../api/axios';

export const AdminDashboard: React.FC = () => {
    const [orgStats, setOrgStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState<string | null>(null);

    const loadDashboard = async () => {
        try {
            setError(null);
            const data = await dashboardService.getAdminDashboard();
            setOrgStats(data);
        } catch (err: any) {
            console.error('Failed to load admin dashboard:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to load organization dashboard');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDashboard();
    }, []);

    const downloadReport = async (format: 'csv' | 'pdf') => {
        try {
            setExporting(format);
            const res = await api.get(`/reports?type=overview&format=${format}`, {
                responseType: 'blob'
            });
            const blob = new Blob([res.data], {
                type: format === 'pdf' ? 'application/pdf' : 'text/csv'
            });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `org_report_${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            console.error('Download report error:', err);
            alert('Failed to export report with authentication.');
        } finally {
            setExporting(null);
        }
    };

    if (loading) {
        return (
            <main className="dashboard-container" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading Admin Control Center...</p>
            </main>
        );
    }

    if (error || !orgStats) {
        return (
            <main className="dashboard-container" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error || 'Failed to load data'}</div>
                <button className="btn" onClick={() => { setLoading(true); loadDashboard(); }}>Retry</button>
            </main>
        );
    }

    const userTable = (orgStats.users || []).map((u: any) => ({
        Name: u.name,
        Role: u.role,
        Email: u.email
    }));

    const teamTable = (orgStats.teams || []).map((t: any) => ({
        Team: t.name,
        Lead: t.teamLead?.name || 'Unassigned'
    }));

    return (
        <main className="dashboard-container">
            <TaskManagementPanel
                userRole="ADMIN"
                onCreated={loadDashboard}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '1.5rem' }}>Admin Global Operations</h2>
                    <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        Organization-wide statistics, user registry, and reporting
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button
                        className="btn-secondary"
                        onClick={() => downloadReport('csv')}
                        disabled={exporting !== null}
                    >
                        {exporting === 'csv' ? 'Exporting...' : 'Export Org (CSV)'}
                    </button>
                    <button
                        className="btn"
                        onClick={() => downloadReport('pdf')}
                        disabled={exporting !== null}
                    >
                        {exporting === 'pdf' ? 'Exporting...' : 'Export Org (PDF)'}
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-4" style={{ marginBottom: '2.5rem', gap: '1.25rem' }}>
                <div className="stat-card">
                    <h3>{orgStats.totalUsers || 0}</h3>
                    <p>Total Users</p>
                </div>
                <div className="stat-card">
                    <h3>{orgStats.totalTeams || 0}</h3>
                    <p>Total Teams</p>
                </div>
                <div className="stat-card">
                    <h3>{orgStats.totalTasks || 0}</h3>
                    <p>Total Tasks</p>
                </div>
                <div className="stat-card">
                    <h3>{orgStats.activityCount || 0}</h3>
                    <p>Activity Logs Trailed</p>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: '2rem' }}>
                <div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Organization Users</h3>
                    <PaginatedTable columns={['Name', 'Role', 'Email']} data={userTable} />
                </div>
                <div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Teams & Leads</h3>
                    <PaginatedTable columns={['Team', 'Lead']} data={teamTable} />
                </div>
            </div>
        </main>
    );
};
