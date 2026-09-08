import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/auth.service';

interface DemoAccount {
    role: string;
    label: string;
    email: string;
    color: string;
}

const DEMO_ACCOUNTS: DemoAccount[] = [
    { role: 'ADMIN', label: 'Organization Admin', email: 'admin@taskbot.com', color: '#a855f7' },
    { role: 'MANAGER', label: 'Engineering Manager', email: 'manager.eng@taskbot.com', color: '#3b82f6' },
    { role: 'TEAM_LEAD', label: 'Backend Team Lead', email: 'lead.backend@taskbot.com', color: '#10b981' },
    { role: 'EMPLOYEE', label: 'Senior Engineer', email: 'emp.dev1@taskbot.com', color: '#94a3b8' },
];

export const Login: React.FC = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e?: React.FormEvent, customCreds?: { email: string; pass: string }) => {
        if (e) e.preventDefault();
        setError('');
        setLoading(true);

        const targetEmail = customCreds ? customCreds.email : email;
        const targetPassword = customCreds ? customCreds.pass : password;

        try {
            const data = await authService.login({ email: targetEmail, password: targetPassword });
            login(data.user, data.accessToken);
            navigate('/');
        } catch (err: any) {
            const msg =
                err.response?.data?.error?.message ||
                err.response?.data?.message ||
                err.message ||
                'Login failed. Please check your credentials.';
            setError(msg);
        } finally {
            setLoading(false);
        }
    };

    const handleQuickLogin = (acc: DemoAccount) => {
        setEmail(acc.email);
        setPassword('password123');
        setError('');
        handleSubmit(undefined, { email: acc.email, pass: 'password123' });
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '48px',
                        height: '48px',
                        borderRadius: '12px',
                        background: 'linear-gradient(135deg, var(--accent-color), #8b5cf6)',
                        color: '#fff',
                        fontWeight: 800,
                        fontSize: '1.5rem',
                        marginBottom: '0.75rem',
                        boxShadow: '0 8px 16px rgba(59, 130, 246, 0.25)'
                    }}>
                        T
                    </div>
                    <h1 style={{ fontSize: '1.5rem', margin: '0 0 0.35rem 0', fontWeight: 700 }}>TaskBot Pro</h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        Enterprise Workforce & Task Management
                    </p>
                </div>

                {error && (
                    <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
                        <span>⚠️</span>
                        <span>{error}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="login-email">Email Address</label>
                        <input
                            id="login-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="user@taskbot.com"
                            disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="login-password">Password</label>
                        <input
                            id="login-password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            disabled={loading}
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn"
                        disabled={loading}
                        style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.5rem',
                            marginTop: '0.5rem'
                        }}
                    >
                        {loading ? (
                            <>
                                <span className="spinner" />
                                <span>Signing in...</span>
                            </>
                        ) : (
                            <span>Sign In to Dashboard</span>
                        )}
                    </button>
                </form>

                {/* 1-Click Demo Accounts */}
                <div className="demo-accounts">
                    <div className="demo-accounts-title">Quick Demo Login (1-Click)</div>
                    <div className="demo-grid">
                        {DEMO_ACCOUNTS.map((acc) => (
                            <button
                                key={acc.role}
                                type="button"
                                className="demo-chip"
                                onClick={() => handleQuickLogin(acc)}
                                disabled={loading}
                                title={`Login as ${acc.label} (${acc.email})`}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.15rem' }}>
                                    <span style={{
                                        display: 'inline-block',
                                        width: '8px',
                                        height: '8px',
                                        borderRadius: '50%',
                                        backgroundColor: acc.color
                                    }} />
                                    <span className="demo-chip-role" style={{ color: acc.color }}>
                                        {acc.role.replace('_', ' ')}
                                    </span>
                                </div>
                                <span className="demo-chip-email">{acc.email}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
