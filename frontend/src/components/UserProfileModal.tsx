import React, { useState, useEffect } from 'react';
import { userService, type UserProfile, type UpdateUserDTO } from '../services/user.service';
import { useAuth } from '../context/AuthContext';

interface UserProfileModalProps {
    userId: string | null;
    onClose: () => void;
    onUpdateSuccess?: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
    userId,
    onClose,
    onUpdateSuccess
}) => {
    const { user: currentUser, refreshUser } = useAuth();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Edit mode state
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editFormData, setEditFormData] = useState<UpdateUserDTO>({
        name: '',
        role: undefined,
        departmentId: '',
        managerId: '',
        teamLeadId: ''
    });

    const isSelf = currentUser?.id === userId;
    const isAdmin = currentUser?.role === 'ADMIN';
    const canEdit = isSelf || isAdmin;

    const loadProfile = async (id: string) => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await userService.getUserProfile(id);
            setProfile(data);
            setEditFormData({
                name: data.name,
                role: data.role,
                departmentId: data.departmentId || '',
                managerId: data.managerId || '',
                teamLeadId: data.teamLeadId || ''
            });
        } catch (err: any) {
            console.error('Failed to fetch user profile:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to load profile');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (userId) {
            setIsEditing(false);
            loadProfile(userId);
        }
    }, [userId]);

    if (!userId) return null;

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        try {
            const payload: UpdateUserDTO = {
                name: editFormData.name
            };

            if (isAdmin) {
                payload.role = editFormData.role;
                payload.departmentId = editFormData.departmentId || null;
                payload.managerId = editFormData.managerId || null;
                payload.teamLeadId = editFormData.teamLeadId || null;
            }

            const updated = await userService.updateUserProfile(userId, payload);
            setProfile(updated);
            setIsEditing(false);

            if (isSelf) {
                await refreshUser();
            }

            if (onUpdateSuccess) {
                onUpdateSuccess();
            }
        } catch (err: any) {
            console.error('Failed to update profile:', err);
            setError(err.response?.data?.error?.message || err.message || 'Failed to update profile');
        } finally {
            setIsSaving(false);
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
        <div className="modal-overlay" onClick={onClose}>
            <div
                className="modal-content"
                style={{ maxWidth: '680px' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="modal-header">
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>Employee Profile</h3>
                    <button
                        onClick={onClose}
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

                {isLoading ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Loading profile...
                    </div>
                ) : error && !profile ? (
                    <div style={{ padding: '2rem', textAlign: 'center' }}>
                        <div style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{error}</div>
                        <button className="btn btn-secondary" onClick={() => loadProfile(userId)}>Retry</button>
                    </div>
                ) : profile ? (
                    <div>
                        {error && (
                            <div style={{
                                padding: '0.75rem',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid var(--danger)',
                                borderRadius: '6px',
                                color: 'var(--danger)',
                                marginBottom: '1rem',
                                fontSize: '0.875rem'
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Top Hero Card */}
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1.25rem',
                            background: 'var(--bg-secondary)',
                            padding: '1.5rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)',
                            marginBottom: '1.5rem'
                        }}>
                            <div style={{
                                width: '64px',
                                height: '64px',
                                borderRadius: '50%',
                                background: `linear-gradient(135deg, ${getRoleColor(profile.role)}, #1e293b)`,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                fontWeight: 700,
                                fontSize: '1.5rem',
                                border: '2px solid rgba(255,255,255,0.2)'
                            }}>
                                {getInitials(profile.name)}
                            </div>

                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <h2 style={{ fontSize: '1.5rem', margin: 0 }}>{profile.name}</h2>
                                    <span style={{
                                        background: getRoleColor(profile.role),
                                        color: '#fff',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        padding: '0.2rem 0.6rem',
                                        borderRadius: '9999px',
                                        textTransform: 'uppercase'
                                    }}>
                                        {profile.role.replace('_', ' ')}
                                    </span>
                                    {profile.department && (
                                        <span style={{
                                            background: 'rgba(59, 130, 246, 0.15)',
                                            color: '#60a5fa',
                                            fontSize: '0.75rem',
                                            fontWeight: 500,
                                            padding: '0.2rem 0.6rem',
                                            borderRadius: '9999px',
                                            border: '1px solid rgba(59, 130, 246, 0.3)'
                                        }}>
                                            {profile.department.name}
                                        </span>
                                    )}
                                </div>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.35rem 0 0 0' }}>
                                    {profile.email}
                                </p>
                            </div>

                            {canEdit && (
                                <button
                                    onClick={() => setIsEditing(!isEditing)}
                                    className={`btn ${isEditing ? 'btn-secondary' : ''}`}
                                    style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
                                >
                                    {isEditing ? 'Cancel' : 'Edit Profile'}
                                </button>
                            )}
                        </div>

                        {/* Edit Form */}
                        {isEditing ? (
                            <form onSubmit={handleSave} style={{
                                background: 'var(--bg-secondary)',
                                padding: '1.5rem',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                marginBottom: '1.5rem'
                            }}>
                                <h4 style={{ marginBottom: '1rem' }}>Edit Profile Information</h4>

                                <div className="form-group">
                                    <label>Full Name</label>
                                    <input
                                        type="text"
                                        value={editFormData.name || ''}
                                        onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                                        required
                                    />
                                </div>

                                {isAdmin && (
                                    <>
                                        <div className="form-group">
                                            <label>System Role (Admin Only)</label>
                                            <select
                                                value={editFormData.role || 'EMPLOYEE'}
                                                onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value as any })}
                                            >
                                                <option value="EMPLOYEE">EMPLOYEE</option>
                                                <option value="TEAM_LEAD">TEAM_LEAD</option>
                                                <option value="MANAGER">MANAGER</option>
                                                <option value="ADMIN">ADMIN</option>
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                                            <div className="form-group">
                                                <label>Department ID</label>
                                                <input
                                                    type="text"
                                                    placeholder="UUID or leave empty"
                                                    value={editFormData.departmentId || ''}
                                                    onChange={(e) => setEditFormData({ ...editFormData, departmentId: e.target.value })}
                                                />
                                            </div>

                                            <div className="form-group">
                                                <label>Assigned Manager ID</label>
                                                <input
                                                    type="text"
                                                    placeholder="UUID or leave empty"
                                                    value={editFormData.managerId || ''}
                                                    onChange={(e) => setEditFormData({ ...editFormData, managerId: e.target.value })}
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label>Assigned Team Lead ID</label>
                                            <input
                                                type="text"
                                                placeholder="UUID or leave empty"
                                                value={editFormData.teamLeadId || ''}
                                                onChange={(e) => setEditFormData({ ...editFormData, teamLeadId: e.target.value })}
                                            />
                                        </div>
                                    </>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        onClick={() => setIsEditing(false)}
                                        disabled={isSaving}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn"
                                        disabled={isSaving}
                                    >
                                        {isSaving ? 'Saving Changes...' : 'Save Changes'}
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <>
                                {/* Workload & Task Statistics */}
                                {profile.stats && (
                                    <div style={{ marginBottom: '1.5rem' }}>
                                        <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                                            Task & Goal Statistics
                                        </h4>
                                        <div className="grid grid-cols-4" style={{ gap: '0.75rem' }}>
                                            <div className="stat-card" style={{ padding: '1rem' }}>
                                                <h3 style={{ fontSize: '1.75rem', margin: 0 }}>{profile.stats.totalTasks}</h3>
                                                <p style={{ margin: '0.25rem 0 0 0' }}>Total Tasks</p>
                                            </div>
                                            <div className="stat-card" style={{ padding: '1rem' }}>
                                                <h3 style={{ fontSize: '1.75rem', margin: 0, color: 'var(--success)' }}>{profile.stats.completedTasks}</h3>
                                                <p style={{ margin: '0.25rem 0 0 0' }}>Completed</p>
                                            </div>
                                            <div className="stat-card" style={{ padding: '1rem' }}>
                                                <h3 style={{ fontSize: '1.75rem', margin: 0, color: 'var(--accent-color)' }}>{profile.stats.inProgressTasks}</h3>
                                                <p style={{ margin: '0.25rem 0 0 0' }}>In Progress</p>
                                            </div>
                                            <div className="stat-card" style={{ padding: '1rem' }}>
                                                <h3 style={{ fontSize: '1.75rem', margin: 0, color: 'var(--warning)' }}>{profile.stats.activeGoals}</h3>
                                                <p style={{ margin: '0.25rem 0 0 0' }}>Active Goals</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Reporting & Organization Relationships */}
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    padding: '1.25rem',
                                    marginBottom: '1.5rem'
                                }}>
                                    <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                                        Organizational Hierarchy
                                    </h4>

                                    <div className="grid grid-cols-2" style={{ gap: '1rem', fontSize: '0.875rem' }}>
                                        <div>
                                            <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Reporting Manager</span>
                                            <span style={{ fontWeight: 500 }}>
                                                {profile.manager ? `${profile.manager.name} (${profile.manager.email})` : 'None / Top Level'}
                                            </span>
                                        </div>

                                        <div>
                                            <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Team Lead</span>
                                            <span style={{ fontWeight: 500 }}>
                                                {profile.teamLead ? `${profile.teamLead.name} (${profile.teamLead.email})` : 'None'}
                                            </span>
                                        </div>

                                        <div>
                                            <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Department</span>
                                            <span style={{ fontWeight: 500 }}>
                                                {profile.department ? `${profile.department.name} ${profile.department.code ? `(${profile.department.code})` : ''}` : 'Unassigned'}
                                            </span>
                                        </div>

                                        <div>
                                            <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Assigned Team(s)</span>
                                            <span style={{ fontWeight: 500 }}>
                                                {profile.memberships && profile.memberships.length > 0 ? (
                                                    profile.memberships.map((m) => m.team.name).join(', ')
                                                ) : (
                                                    'No team memberships'
                                                )}
                                            </span>
                                        </div>

                                        <div>
                                            <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '0.25rem' }}>Member Since</span>
                                            <span style={{ fontWeight: 500 }}>
                                                {new Date(profile.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Leadership Section (if Manager or Team Lead) */}
                                {((profile.directReports && profile.directReports.length > 0) || (profile.ledTeams && profile.ledTeams.length > 0)) && (
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        padding: '1.25rem'
                                    }}>
                                        <h4 style={{ fontSize: '0.875rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                                            Direct Reports & Led Teams
                                        </h4>

                                        {profile.ledTeams && profile.ledTeams.length > 0 && (
                                            <div style={{ marginBottom: '1rem' }}>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Led Teams: </span>
                                                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                                    {profile.ledTeams.map((t) => t.name).join(', ')}
                                                </span>
                                            </div>
                                        )}

                                        {profile.directReports && profile.directReports.length > 0 && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                                                    Direct Reports ({profile.directReports.length}):
                                                </span>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                                    {profile.directReports.map((report) => (
                                                        <span
                                                            key={report.id}
                                                            style={{
                                                                background: 'var(--bg-primary)',
                                                                padding: '0.35rem 0.75rem',
                                                                borderRadius: '6px',
                                                                border: '1px solid var(--border-color)',
                                                                fontSize: '0.8125rem'
                                                            }}
                                                        >
                                                            {report.name} <span style={{ color: 'var(--text-secondary)' }}>({report.role})</span>
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                ) : null}
            </div>
        </div>
    );
};
