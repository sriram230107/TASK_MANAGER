import React from 'react';
import { useAuth } from '../context/AuthContext';

export const DashboardStub: React.FC = () => {
    const { user, logout } = useAuth();

    return (
        <div className="min-h-screen">
            <nav className="navbar">
                <h2>TaskBot Pro</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span>{user?.name} ({user?.role})</span>
                    <button onClick={logout} className="btn btn-secondary" style={{ padding: '0.5rem 1rem' }}>Logout</button>
                </div>
            </nav>
            <main className="dashboard-container">
                <div className="auth-card" style={{ maxWidth: '100%' }}>
                    <h1>Welcome, {user?.name}!</h1>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        Logged in as <strong>{user?.role}</strong>
                    </p>
                    <p style={{ marginTop: '1rem', color: 'var(--text-secondary)' }}>
                        Phase 3 will implement real dashboard content here.
                    </p>
                </div>
            </main>
        </div>
    );
};
