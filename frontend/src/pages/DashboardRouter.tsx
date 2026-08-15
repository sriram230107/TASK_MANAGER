import React from 'react';
import { useAuth } from '../context/AuthContext';
import { EmployeeDashboard } from './EmployeeDashboard';
import { TeamLeadDashboard } from './TeamLeadDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { AdminDashboard } from './AdminDashboard';

export const DashboardRouter: React.FC = () => {
    const { user, logout } = useAuth();

    if (!user) return null;

    return (
        <div className="min-h-screen">
            <nav className="navbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <h2 style={{ color: 'var(--accent-color)', margin: 0 }}>TaskBot Pro</h2>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{user.role}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 500 }}>{user.name}</span>
                    <button onClick={logout} className="btn btn-secondary">Logout</button>
                </div>
            </nav>

            {user.role === 'EMPLOYEE' && <EmployeeDashboard />}
            {user.role === 'TEAM_LEAD' && <TeamLeadDashboard />}
            {user.role === 'MANAGER' && <ManagerDashboard />}
            {user.role === 'ADMIN' && <AdminDashboard />}
        </div>
    );
};
