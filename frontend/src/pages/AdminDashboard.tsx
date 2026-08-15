import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { PaginatedTable } from '../components/PaginatedTable';

export const AdminDashboard: React.FC = () => {
    const [orgStats, setOrgStats] = useState<any>(null);

    useEffect(() => {
        api.get('/admin/dashboard')
            .then(res => setOrgStats(res.data))
            .catch(err => console.error(err));
    }, []);

    const downloadReport = (format: 'csv' | 'pdf') => {
        window.open(`http://localhost:3000/api/v1/reports?targetType=MANAGER&targetId=all&format=${format}`, '_blank');
    };

    if (!orgStats) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Admin Panel...</div>;

    const userTable = orgStats.users.map((u: any) => ({ Name: u.name, Role: u.role, Email: u.email }));
    const teamTable = orgStats.teams.map((t: any) => ({ Team: t.name, Lead: t.teamLead.name }));

    return (
        <main className="dashboard-container">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2rem' }}>
                <h2>Admin Global Dashboard</h2>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="btn" onClick={() => downloadReport('csv')}>Export Org (CSV)</button>
                    <button className="btn" onClick={() => downloadReport('pdf')}>Export Org (PDF)</button>
                </div>
            </div>

            <div className="grid grid-cols-4" style={{ marginBottom: '2.5rem' }}>
                <div className="stat-card"><h3>{orgStats.totalUsers}</h3><p>Total Users</p></div>
                <div className="stat-card"><h3>{orgStats.totalTeams}</h3><p>Total Teams</p></div>
                <div className="stat-card"><h3>{orgStats.totalTasks}</h3><p>Total Tasks</p></div>
                <div className="stat-card"><h3>{orgStats.activityCount}</h3><p>Activity Logs Trailed</p></div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: '2rem' }}>
                <div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Org Users</h3>
                    <PaginatedTable columns={['Name', 'Role', 'Email']} data={userTable} />
                </div>
                <div>
                    <h3 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Org Teams</h3>
                    <PaginatedTable columns={['Team', 'Lead']} data={teamTable} />
                </div>
            </div>
        </main>
    );
};
