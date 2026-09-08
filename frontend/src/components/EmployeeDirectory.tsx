import React, { useState, useEffect } from 'react';
import {
    userService,
    type UserListItem,
    type OrgHierarchy,
    type CreateUserDTO
} from '../services/user.service';
import { useAuth } from '../context/AuthContext';
import { UserProfileModal } from './UserProfileModal';

export const EmployeeDirectory: React.FC = () => {
    const { user: currentUser } = useAuth();

    // Data state
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [hierarchy, setHierarchy] = useState<OrgHierarchy | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // View & Filter state
    const [activeTab, setActiveTab] = useState<'directory' | 'hierarchy'>('directory');
    const [searchTerm, setSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('ALL');

    // Selected user for profile modal
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    // Create user modal state (Admin only)
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isCreating, setIsCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [newUserData, setNewUserData] = useState<CreateUserDTO>({
        name: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
        departmentId: '',
        managerId: '',
        teamLeadId: ''
    });

    const isAdmin = currentUser?.role === 'ADMIN';

    const loadDirectoryData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const queryParams: any = {};
            if (roleFilter !== 'ALL') {
                queryParams.role = roleFilter;
            }
            if (searchTerm.trim()) {
                queryParams.search = searchTerm.trim();
            }

            const [usersRes, hierRes] = await Promise.all([
                userService.listUsers(queryParams),
                userService.getOrgHierarchy().catch(() => null)
            ]);

            setUsers(usersRes.users);
            if (hierRes) {
                setHierarchy(hierRes);
            }
        } catch (err: any) {
            console.error('Failed to load directory:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to load employee directory');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadDirectoryData();
    }, [roleFilter, searchTerm]);

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsCreating(true);
        setCreateError(null);

        try {
            await userService.createUser({
                ...newUserData,
                departmentId: newUserData.departmentId || null,
                managerId: newUserData.managerId || null,
                teamLeadId: newUserData.teamLeadId || null
            });

            setShowCreateModal(false);
            setNewUserData({
                name: '',
                email: '',
                password: '',
                role: 'EMPLOYEE',
                departmentId: '',
                managerId: '',
                teamLeadId: ''
            });

            await loadDirectoryData();
        } catch (err: any) {
            console.error('Failed to create user:', err);
            setCreateError(err.response?.data?.error?.message || err.message || 'Failed to create user');
        } finally {
            setIsCreating(false);
        }
    };

    const getRoleColor = (role?: string) => {
        switch (role) {
            case 'ADMIN': return '#a855f7';
            case 'MANAGER': return '#3b82f6';
            case 'TEAM_LEAD': return '#10b981';
            case 'EMPLOYEE': return '#64748b';
            default: return '#64748b';
        }
    };

    const getInitials = (name?: string) => {
        if (!name) return '?';
        return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 0' }}>
            {/* Header / Actions Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                flexWrap: 'wrap',
                gap: '1rem'
            }}>
                <div>
                    <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
                        Organization Directory
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                        Browse team members, reporting relationships, and organizational hierarchy.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{
                        display: 'flex',
                        background: 'var(--bg-secondary)',
                        borderRadius: '6px',
                        border: '1px solid var(--border-color)',
                        overflow: 'hidden'
                    }}>
                        <button
                            onClick={() => setActiveTab('directory')}
                            style={{
                                padding: '0.5rem 1rem',
                                background: activeTab === 'directory' ? 'var(--accent-color)' : 'transparent',
                                color: activeTab === 'directory' ? '#fff' : 'var(--text-secondary)',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 500,
                                fontSize: '0.875rem'
                            }}
                        >
                            Directory List
                        </button>
                        <button
                            onClick={() => setActiveTab('hierarchy')}
                            style={{
                                padding: '0.5rem 1rem',
                                background: activeTab === 'hierarchy' ? 'var(--accent-color)' : 'transparent',
                                color: activeTab === 'hierarchy' ? '#fff' : 'var(--text-secondary)',
                                border: 'none',
                                cursor: 'pointer',
                                fontWeight: 500,
                                fontSize: '0.875rem'
                            }}
                        >
                            Org Hierarchy
                        </button>
                    </div>

                    {isAdmin && (
                        <button
                            className="btn"
                            onClick={() => setShowCreateModal(true)}
                            style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                        >
                            + Add Employee
                        </button>
                    )}
                </div>
            </div>

            {/* Filter Controls (for Directory Tab) */}
            {activeTab === 'directory' && (
                <div style={{
                    display: 'flex',
                    gap: '1rem',
                    marginBottom: '1.5rem',
                    flexWrap: 'wrap',
                    background: 'var(--bg-secondary)',
                    padding: '1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                }}>
                    <div style={{ flex: '1', minWidth: '240px' }}>
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '0.6rem 0.85rem',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-primary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.875rem'
                            }}
                        />
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {['ALL', 'ADMIN', 'MANAGER', 'TEAM_LEAD', 'EMPLOYEE'].map((role) => (
                            <button
                                key={role}
                                onClick={() => setRoleFilter(role)}
                                style={{
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: roleFilter === role ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    background: roleFilter === role ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-primary)',
                                    color: roleFilter === role ? '#60a5fa' : 'var(--text-secondary)'
                                }}
                            >
                                {role.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Content Loading & Error States */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                    Loading employee directory...
                </div>
            ) : error ? (
                <div style={{
                    padding: '2rem',
                    textAlign: 'center',
                    background: 'var(--bg-secondary)',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)'
                }}>
                    <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</p>
                    <button className="btn btn-secondary" onClick={loadDirectoryData}>Retry</button>
                </div>
            ) : activeTab === 'directory' ? (
                /* Directory Cards Grid */
                users.length === 0 ? (
                    <div style={{
                        textAlign: 'center',
                        padding: '4rem',
                        background: 'var(--bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--border-color)',
                        color: 'var(--text-secondary)'
                    }}>
                        No employees found matching the filter criteria.
                    </div>
                ) : (
                    <div className="grid grid-cols-3" style={{ gap: '1rem' }}>
                        {users.map((emp) => (
                            <div
                                key={emp.id}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '8px',
                                    padding: '1.25rem',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    justifyContent: 'space-between',
                                    transition: 'border-color 0.2s, transform 0.2s'
                                }}
                            >
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '1rem' }}>
                                        <div style={{
                                            width: '44px',
                                            height: '44px',
                                            borderRadius: '50%',
                                            background: `linear-gradient(135deg, ${getRoleColor(emp.role)}, #1e293b)`,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: '#fff',
                                            fontWeight: 700,
                                            fontSize: '1.1rem'
                                        }}>
                                            {getInitials(emp.name)}
                                        </div>

                                        <div style={{ overflow: 'hidden' }}>
                                            <h4 style={{ margin: 0, fontSize: '1rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {emp.name}
                                            </h4>
                                            <span style={{
                                                background: getRoleColor(emp.role),
                                                color: '#fff',
                                                fontSize: '0.6875rem',
                                                fontWeight: 600,
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '9999px',
                                                textTransform: 'uppercase',
                                                display: 'inline-block',
                                                marginTop: '0.2rem'
                                            }}>
                                                {emp.role.replace('_', ' ')}
                                            </span>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                                        <div>
                                            <span style={{ color: 'var(--text-primary)' }}>Email: </span>
                                            {emp.email}
                                        </div>
                                        <div>
                                            <span style={{ color: 'var(--text-primary)' }}>Department: </span>
                                            {emp.department ? emp.department.name : 'Unassigned'}
                                        </div>
                                        {emp.manager && (
                                            <div>
                                                <span style={{ color: 'var(--text-primary)' }}>Manager: </span>
                                                {emp.manager.name}
                                            </div>
                                        )}
                                        {emp.memberships && emp.memberships.length > 0 && (
                                            <div>
                                                <span style={{ color: 'var(--text-primary)' }}>Teams: </span>
                                                {emp.memberships.map(m => m.team.name).join(', ')}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    className="btn btn-secondary"
                                    onClick={() => setSelectedUserId(emp.id)}
                                    style={{ width: '100%', fontSize: '0.8125rem', padding: '0.45rem' }}
                                >
                                    View Full Profile
                                </button>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                /* Org Hierarchy Tree View */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {hierarchy?.departments && hierarchy.departments.length > 0 ? (
                        hierarchy.departments.map((dept) => (
                            <div
                                key={dept.id}
                                style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    padding: '1.5rem'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                                            Department: {dept.name} {dept.code && <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>({dept.code})</span>}
                                        </h3>
                                        <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                                            Manager: {dept.manager ? (
                                                <button
                                                    onClick={() => dept.manager && setSelectedUserId(dept.manager.id)}
                                                    style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                                                >
                                                    {dept.manager.name} ({dept.manager.email})
                                                </button>
                                            ) : 'None assigned'}
                                        </p>
                                    </div>
                                </div>

                                {/* Teams under department */}
                                {dept.teams && dept.teams.length > 0 ? (
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                                        {dept.teams.map((team) => (
                                            <div
                                                key={team.id}
                                                style={{
                                                    background: 'var(--bg-primary)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '6px',
                                                    padding: '1rem'
                                                }}
                                            >
                                                <div style={{ marginBottom: '0.75rem' }}>
                                                    <h4 style={{ margin: 0, fontSize: '1rem' }}>Team: {team.name}</h4>
                                                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                                                        Lead: {team.teamLead ? (
                                                            <button
                                                                onClick={() => team.teamLead && setSelectedUserId(team.teamLead.id)}
                                                                style={{ background: 'none', border: 'none', color: '#10b981', cursor: 'pointer', padding: 0, fontWeight: 500 }}
                                                            >
                                                                {team.teamLead.name}
                                                            </button>
                                                        ) : 'None'}
                                                    </div>
                                                </div>

                                                <div style={{ fontSize: '0.8125rem' }}>
                                                    <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.35rem' }}>
                                                        Members ({team.members?.length || 0}):
                                                    </span>
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                                        {team.members && team.members.length > 0 ? (
                                                            team.members.map((m) => (
                                                                <button
                                                                    key={m.user.id}
                                                                    onClick={() => setSelectedUserId(m.user.id)}
                                                                    style={{
                                                                        background: 'var(--bg-secondary)',
                                                                        border: '1px solid var(--border-color)',
                                                                        borderRadius: '4px',
                                                                        padding: '0.2rem 0.5rem',
                                                                        color: 'var(--text-primary)',
                                                                        fontSize: '0.75rem',
                                                                        cursor: 'pointer'
                                                                    }}
                                                                >
                                                                    {m.user.name}
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>No members</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ color: 'var(--text-secondary)', fontStyle: 'italic', fontSize: '0.875rem' }}>
                                        No teams in this department yet.
                                    </div>
                                )}
                            </div>
                        ))
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                            No departments established in organization hierarchy.
                        </div>
                    )}

                    {/* Unassigned Users */}
                    {hierarchy?.unassignedUsers && hierarchy.unassignedUsers.length > 0 && (
                        <div style={{
                            background: 'var(--bg-secondary)',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            padding: '1.25rem'
                        }}>
                            <h4 style={{ margin: '0 0 0.75rem 0', fontSize: '1rem', color: 'var(--warning)' }}>
                                Unassigned Personnel ({hierarchy.unassignedUsers.length})
                            </h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                {hierarchy.unassignedUsers.map((u) => (
                                    <button
                                        key={u.id}
                                        onClick={() => setSelectedUserId(u.id)}
                                        style={{
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            padding: '0.35rem 0.75rem',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.8125rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {u.name} <span style={{ color: 'var(--text-secondary)' }}>({u.role})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* User Profile Modal */}
            <UserProfileModal
                userId={selectedUserId}
                onClose={() => setSelectedUserId(null)}
                onUpdateSuccess={() => loadDirectoryData()}
            />

            {/* Admin Add Employee Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0 }}>Add New Employee</h3>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer'
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        {createError && (
                            <div style={{
                                padding: '0.75rem',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid var(--danger)',
                                borderRadius: '6px',
                                color: 'var(--danger)',
                                marginBottom: '1rem',
                                fontSize: '0.875rem'
                            }}>
                                {createError}
                            </div>
                        )}

                        <form onSubmit={handleCreateUser}>
                            <div className="form-group">
                                <label>Full Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={newUserData.name}
                                    onChange={(e) => setNewUserData({ ...newUserData, name: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Work Email *</label>
                                <input
                                    type="email"
                                    required
                                    value={newUserData.email}
                                    onChange={(e) => setNewUserData({ ...newUserData, email: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Password *</label>
                                <input
                                    type="password"
                                    required
                                    minLength={6}
                                    value={newUserData.password}
                                    onChange={(e) => setNewUserData({ ...newUserData, password: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Role *</label>
                                <select
                                    value={newUserData.role}
                                    onChange={(e) => setNewUserData({ ...newUserData, role: e.target.value as any })}
                                >
                                    <option value="EMPLOYEE">EMPLOYEE</option>
                                    <option value="TEAM_LEAD">TEAM_LEAD</option>
                                    <option value="MANAGER">MANAGER</option>
                                    <option value="ADMIN">ADMIN</option>
                                </select>
                            </div>

                            <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Department ID (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="UUID"
                                        value={newUserData.departmentId || ''}
                                        onChange={(e) => setNewUserData({ ...newUserData, departmentId: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label>Manager ID (Optional)</label>
                                    <input
                                        type="text"
                                        placeholder="UUID"
                                        value={newUserData.managerId || ''}
                                        onChange={(e) => setNewUserData({ ...newUserData, managerId: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Team Lead ID (Optional)</label>
                                <input
                                    type="text"
                                    placeholder="UUID"
                                    value={newUserData.teamLeadId || ''}
                                    onChange={(e) => setNewUserData({ ...newUserData, teamLeadId: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowCreateModal(false)}
                                    disabled={isCreating}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn"
                                    disabled={isCreating}
                                >
                                    {isCreating ? 'Creating...' : 'Create Employee'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
