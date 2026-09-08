import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { EmployeeDashboard } from './EmployeeDashboard';
import { TeamLeadDashboard } from './TeamLeadDashboard';
import { ManagerDashboard } from './ManagerDashboard';
import { AdminDashboard } from './AdminDashboard';
import { EmployeeDirectory } from '../components/EmployeeDirectory';
import { UserProfileModal } from '../components/UserProfileModal';
import { AttendanceManagement } from '../components/AttendanceManagement';
import { LeaveManagement } from '../components/LeaveManagement';
import { PerformanceManagement } from '../components/PerformanceManagement';
import { ReportManagement } from '../components/ReportManagement';
import { NotificationCenter, NotificationBell } from '../components/NotificationCenter';
import { PayrollManagement } from '../components/PayrollManagement';
import { DocumentManagement } from '../components/DocumentManagement';
import { AuditLogViewer } from '../components/AuditLogViewer';
import { OrganizationSettings } from '../components/OrganizationSettings';
import { TaskManagementPanel } from '../components/TaskManagementPanel';

type NavView = 'dashboard' | 'employees' | 'tasks' | 'attendance' | 'leave' | 'performance' | 'reports' | 'notifications' | 'payroll' | 'documents' | 'audit' | 'settings';

export const DashboardRouter: React.FC = () => {
    const { user, logout } = useAuth();
    const [currentView, setCurrentView] = useState<NavView>('dashboard');
    const [showProfileModal, setShowProfileModal] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    if (!user) return null;

    // Build role-authorized navigation items per /PROJECT_SPEC.md
    const getNavItems = () => {
        switch (user.role) {
            case 'ADMIN':
                return [
                    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                    { id: 'employees', label: 'Employees & Org', icon: '👥' },
                    { id: 'tasks', label: 'All Tasks', icon: '✓' },
                    { id: 'attendance', label: 'Attendance & Hours', icon: '⏱' },
                    { id: 'leave', label: 'Leave Management', icon: '🏖' },
                    { id: 'performance', label: 'Performance & Goals', icon: '🎯' },
                    { id: 'reports', label: 'Reports & Analytics', icon: '📈' },
                    { id: 'payroll', label: 'Payroll & Comp', icon: '💰' },
                    { id: 'documents', label: 'Documents & Files', icon: '📁' },
                    { id: 'audit', label: 'Security & Audit', icon: '📋' },
                    { id: 'settings', label: 'Org Settings', icon: '⚙️' },
                    { id: 'notifications', label: 'Notifications', icon: '🔔' }
                ];
            case 'MANAGER':
                return [
                    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                    { id: 'employees', label: 'My Department', icon: '🏢' },
                    { id: 'tasks', label: 'Department Tasks', icon: '✓' },
                    { id: 'attendance', label: 'Attendance', icon: '⏱' },
                    { id: 'leave', label: 'Leave Requests', icon: '🏖' },
                    { id: 'performance', label: 'Performance & Goals', icon: '🎯' },
                    { id: 'reports', label: 'Reports & Analytics', icon: '📈' },
                    { id: 'payroll', label: 'Department Payroll', icon: '💰' },
                    { id: 'documents', label: 'Documents', icon: '📁' },
                    { id: 'audit', label: 'Audit Trail', icon: '📋' },
                    { id: 'settings', label: 'Org Policies', icon: '⚙️' },
                    { id: 'notifications', label: 'Notifications', icon: '🔔' }
                ];
            case 'TEAM_LEAD':
                return [
                    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                    { id: 'employees', label: 'My Team', icon: '👥' },
                    { id: 'tasks', label: 'Team Tasks', icon: '✓' },
                    { id: 'attendance', label: 'Team Attendance', icon: '⏱' },
                    { id: 'leave', label: 'Leave Requests', icon: '🏖' },
                    { id: 'performance', label: 'Performance & Goals', icon: '🎯' },
                    { id: 'reports', label: 'Reports & Analytics', icon: '📈' },
                    { id: 'documents', label: 'Documents', icon: '📁' },
                    { id: 'settings', label: 'Org Policies', icon: '⚙️' },
                    { id: 'notifications', label: 'Notifications', icon: '🔔' }
                ];
            case 'EMPLOYEE':
            default:
                return [
                    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                    { id: 'employees', label: 'Colleague Directory', icon: '👥' },
                    { id: 'tasks', label: 'My Tasks', icon: '✓' },
                    { id: 'attendance', label: 'Attendance & Hours', icon: '⏱' },
                    { id: 'leave', label: 'My Leave', icon: '🏖' },
                    { id: 'performance', label: 'Goals & Performance', icon: '🎯' },
                    { id: 'reports', label: 'My Analytics', icon: '📈' },
                    { id: 'payroll', label: 'My Payslips', icon: '💰' },
                    { id: 'documents', label: 'Documents', icon: '📁' },
                    { id: 'settings', label: 'Org Policies', icon: '⚙️' },
                    { id: 'notifications', label: 'Notifications', icon: '🔔' }
                ];
        }
    };

    const navItems = getNavItems();

    const getRoleColor = (role: string) => {
        switch (role) {
            case 'ADMIN': return '#a855f7';
            case 'MANAGER': return '#3b82f6';
            case 'TEAM_LEAD': return '#10b981';
            case 'EMPLOYEE': return '#64748b';
            default: return '#64748b';
        }
    };

    return (
        <div className="app-layout">
            {/* Mobile Backdrop */}
            <div
                className={`sidebar-backdrop ${mobileMenuOpen ? 'active' : ''}`}
                onClick={() => setMobileMenuOpen(false)}
            />

            {/* Left Sidebar */}
            <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '6px',
                        background: 'linear-gradient(135deg, var(--accent-color), #6366f1)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: '#fff'
                    }}>
                        T
                    </div>
                    <div>
                        <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 700, color: 'var(--text-primary)' }}>
                            TaskBot Pro
                        </h2>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            Workforce Platform
                        </span>
                    </div>
                </div>

                <div className="sidebar-nav">
                    <div style={{
                        padding: '0.5rem 0.5rem 0.25rem 0.5rem',
                        fontSize: '0.6875rem',
                        textTransform: 'uppercase',
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.05em',
                        fontWeight: 600
                    }}>
                        Main Menu
                    </div>

                    {navItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => {
                                setCurrentView(item.id as NavView);
                                setMobileMenuOpen(false);
                            }}
                            className={`sidebar-item ${currentView === item.id ? 'active' : ''}`}
                        >
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                                <span>{item.icon}</span>
                                <span>{item.label}</span>
                            </span>
                        </button>
                    ))}

                    <div style={{
                        marginTop: '1.5rem',
                        padding: '0.5rem 0.5rem 0.25rem 0.5rem',
                        fontSize: '0.6875rem',
                        textTransform: 'uppercase',
                        color: 'var(--text-secondary)',
                        letterSpacing: '0.05em',
                        fontWeight: 600
                    }}>
                        My Account
                    </div>

                    <button
                        onClick={() => {
                            setShowProfileModal(true);
                            setMobileMenuOpen(false);
                        }}
                        className="sidebar-item"
                    >
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                            <span>👤</span>
                            <span>My Profile</span>
                        </span>
                    </button>
                </div>

                {/* Sidebar Footer */}
                <div style={{
                    padding: '1rem',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    background: 'rgba(0,0,0,0.1)'
                }}>
                    <div
                        onClick={() => setShowProfileModal(true)}
                        style={{ cursor: 'pointer', overflow: 'hidden', marginRight: '0.5rem' }}
                        title="Click to view profile"
                    >
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {user.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: getRoleColor(user.role), fontWeight: 500 }}>
                            {user.role.replace('_', ' ')}
                        </div>
                    </div>
                    <button
                        onClick={logout}
                        className="btn btn-secondary"
                        style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem' }}
                    >
                        Logout
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="main-content">
                {/* Top Nav Bar */}
                <nav className="navbar">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                            type="button"
                            className="mobile-menu-btn"
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            aria-label="Toggle navigation menu"
                        >
                            ☰
                        </button>
                        <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                            {navItems.find((n) => n.id === currentView)?.label || 'Overview'}
                        </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <NotificationBell onOpenCenter={() => setCurrentView('notifications')} />

                        <button
                            onClick={() => setShowProfileModal(true)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                background: 'var(--bg-primary)',
                                border: '1px solid var(--border-color)',
                                padding: '0.4rem 0.8rem',
                                borderRadius: '6px',
                                color: 'var(--text-primary)',
                                cursor: 'pointer',
                                fontSize: '0.8125rem'
                            }}
                        >
                            <span>👤</span>
                            <span>{user.name}</span>
                            <span style={{
                                background: getRoleColor(user.role),
                                color: '#fff',
                                fontSize: '0.625rem',
                                padding: '0.1rem 0.4rem',
                                borderRadius: '9999px',
                                fontWeight: 700
                            }}>
                                {user.role}
                            </span>
                        </button>

                        <button onClick={logout} className="btn btn-secondary" style={{ padding: '0.45rem 0.85rem', fontSize: '0.8125rem' }}>
                            Logout
                        </button>
                    </div>
                </nav>

                {/* View Content */}
                <div style={{ padding: '0 1.5rem', flex: 1 }}>
                    {currentView === 'attendance' ? (
                        <AttendanceManagement />
                    ) : currentView === 'leave' ? (
                        <LeaveManagement />
                    ) : currentView === 'performance' ? (
                        <PerformanceManagement />
                    ) : currentView === 'reports' ? (
                        <ReportManagement />
                    ) : currentView === 'payroll' ? (
                        <PayrollManagement />
                    ) : currentView === 'documents' ? (
                        <DocumentManagement />
                    ) : currentView === 'audit' ? (
                        <AuditLogViewer />
                    ) : currentView === 'settings' ? (
                        <OrganizationSettings />
                    ) : currentView === 'notifications' ? (
                        <NotificationCenter />
                    ) : currentView === 'employees' ? (
                        <EmployeeDirectory />
                    ) : currentView === 'tasks' ? (
                        <TaskManagementPanel userRole={user.role} />
                    ) : (
                        <>
                            {user.role === 'EMPLOYEE' && <EmployeeDashboard />}
                            {user.role === 'TEAM_LEAD' && <TeamLeadDashboard />}
                            {user.role === 'MANAGER' && <ManagerDashboard />}
                            {user.role === 'ADMIN' && <AdminDashboard />}
                        </>
                    )}
                </div>
            </main>

            {/* Profile Modal */}
            <UserProfileModal
                userId={showProfileModal ? user.id : null}
                onClose={() => setShowProfileModal(false)}
            />
        </div>
    );
};
