import React from 'react';

export const AdminDashboard: React.FC = () => {
    return (
        <main className="dashboard-container">
            <div className="auth-card" style={{ maxWidth: '100%' }}>
                <h1 style={{ textAlign: 'left', marginBottom: '0.5rem' }}>Admin Control Panel</h1>
                <p style={{ color: 'var(--text-secondary)' }}>
                    Administrative controls (User mutations, Org structuring, Tenant adjustments) are out of scope for the current design phase.
                </p>
            </div>
        </main>
    );
};
