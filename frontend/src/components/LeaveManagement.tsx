import React, { useState, useEffect } from 'react';
import {
    leaveService,
    type LeaveBalance,
    type LeaveRequest,
    type LeaveType,
    type CreateLeaveDTO
} from '../services/leave.service';
import { useAuth } from '../context/AuthContext';

export const LeaveManagement: React.FC = () => {
    const { user } = useAuth();

    // Data state
    const [balances, setBalances] = useState<LeaveBalance[]>([]);
    const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
    const [pendingApprovals, setPendingApprovals] = useState<LeaveRequest[]>([]);
    const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'my-leaves' | 'approvals' | 'all-leaves'>('my-leaves');
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    // Apply modal state
    const [showApplyModal, setShowApplyModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [applyError, setApplyError] = useState<string | null>(null);
    const [applySuccess, setApplySuccess] = useState<string | null>(null);
    const [applyForm, setApplyForm] = useState<CreateLeaveDTO>({
        type: 'ANNUAL',
        startDate: '',
        endDate: '',
        reason: ''
    });

    // Review action state
    const [reviewingId, setReviewingId] = useState<string | null>(null);
    const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [isReviewing, setIsReviewing] = useState(false);

    const isSupervisor = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'TEAM_LEAD';

    const loadBalances = async () => {
        try {
            const data = await leaveService.getBalances();
            setBalances(data);
        } catch (err: any) {
            console.error('Failed to load leave balances:', err);
        }
    };

    const loadMyLeaves = async () => {
        try {
            const data = await leaveService.listLeaves({ limit: 50 });
            setMyLeaves(data.requests);
        } catch (err: any) {
            console.error('Failed to load my leaves:', err);
        }
    };

    const loadPendingApprovals = async () => {
        if (!isSupervisor) return;
        try {
            const data = await leaveService.listLeaves({ pendingReview: true, limit: 50 });
            setPendingApprovals(data.requests);
        } catch (err: any) {
            console.error('Failed to load pending approvals:', err);
        }
    };

    const loadAllLeaves = async () => {
        if (!isSupervisor) return;
        try {
            const params: any = { limit: 50 };
            if (statusFilter !== 'ALL') {
                params.status = statusFilter;
            }
            const data = await leaveService.listLeaves(params);
            setAllLeaves(data.requests);
        } catch (err: any) {
            console.error('Failed to load all leaves:', err);
        }
    };

    const refreshAll = async () => {
        setIsLoading(true);
        await Promise.all([
            loadBalances(),
            loadMyLeaves(),
            loadPendingApprovals(),
            loadAllLeaves()
        ]);
        setIsLoading(false);
    };

    useEffect(() => {
        refreshAll();
    }, [statusFilter]);

    // Calculate duration for apply modal
    const calculateDays = () => {
        if (!applyForm.startDate || !applyForm.endDate) return 0;
        const start = new Date(applyForm.startDate);
        const end = new Date(applyForm.endDate);
        if (end < start) return 0;
        const diff = Math.abs(end.getTime() - start.getTime());
        return Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
    };

    const handleApply = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setApplyError(null);
        setApplySuccess(null);

        try {
            await leaveService.applyLeave(applyForm);
            setShowApplyModal(false);
            setApplyForm({ type: 'ANNUAL', startDate: '', endDate: '', reason: '' });
            setApplySuccess('Leave request submitted successfully!');
            await refreshAll();
        } catch (err: any) {
            console.error('Failed to apply leave:', err);
            setApplyError(err.response?.data?.error?.message || err.message || 'Failed to submit leave');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleReviewSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reviewingId || !reviewAction) return;

        setIsReviewing(true);
        try {
            await leaveService.reviewLeave(reviewingId, {
                action: reviewAction,
                notes: reviewNotes.trim() || undefined
            });
            setReviewingId(null);
            setReviewAction(null);
            setReviewNotes('');
            await refreshAll();
        } catch (err: any) {
            console.error('Failed to review leave:', err);
            alert(err.response?.data?.error?.message || err.message || 'Failed to review request');
        } finally {
            setIsReviewing(false);
        }
    };

    const handleCancel = async (id: string) => {
        if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
        try {
            await leaveService.cancelLeave(id);
            await refreshAll();
        } catch (err: any) {
            console.error('Failed to cancel leave:', err);
            alert(err.response?.data?.error?.message || err.message || 'Failed to cancel request');
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return { bg: 'rgba(34, 197, 94, 0.2)', color: '#22c55e', border: '#22c55e', label: 'Approved' };
            case 'PENDING_LEAD':
                return { bg: 'rgba(99, 102, 241, 0.2)', color: '#818cf8', border: '#818cf8', label: 'Pending Lead Review' };
            case 'PENDING_MANAGER':
                return { bg: 'rgba(234, 179, 8, 0.2)', color: '#eab308', border: '#eab308', label: 'Pending Manager Review' };
            case 'REJECTED':
                return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '#ef4444', label: 'Rejected' };
            case 'CANCELLED':
            default:
                return { bg: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8', border: '#64748b', label: 'Cancelled' };
        }
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 0' }}>
            {/* Header */}
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
                        Leave Management
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                        Track balances, submit leave applications, and review workforce time-off requests.
                    </p>
                </div>

                <button
                    onClick={() => setShowApplyModal(true)}
                    className="btn"
                    style={{
                        background: 'linear-gradient(135deg, var(--accent-color), #2563eb)',
                        padding: '0.65rem 1.25rem',
                        fontWeight: 600,
                        fontSize: '0.875rem'
                    }}
                >
                    + Apply for Leave
                </button>
            </div>

            {/* Notification Alert */}
            {applySuccess && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid var(--success)',
                    borderRadius: '8px',
                    color: 'var(--success)',
                    marginBottom: '1rem',
                    fontSize: '0.875rem'
                }}>
                    {applySuccess}
                </div>
            )}

            {/* Leave Balances Grid */}
            <div style={{ marginBottom: '2rem' }}>
                <h3 style={{ fontSize: '0.9375rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
                    Your Available Leave Balances ({new Date().getFullYear()})
                </h3>

                <div className="grid grid-cols-4" style={{ gap: '1rem' }}>
                    {balances.filter(b => ['ANNUAL', 'SICK', 'CASUAL', 'UNPAID'].includes(b.leaveType)).map((bal) => (
                        <div
                            key={bal.id}
                            style={{
                                background: 'var(--bg-secondary)',
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '1.25rem'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{bal.leaveType}</span>
                                <span style={{
                                    fontSize: '0.75rem',
                                    color: bal.remainingDays > 0 ? 'var(--success)' : 'var(--text-secondary)',
                                    fontWeight: 700
                                }}>
                                    {bal.remainingDays} left
                                </span>
                            </div>

                            <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.25rem 0' }}>
                                {bal.remainingDays} <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>/ {bal.allocatedDays} days</span>
                            </div>

                            <div style={{
                                width: '100%',
                                height: '6px',
                                background: 'rgba(255,255,255,0.08)',
                                borderRadius: '9999px',
                                overflow: 'hidden',
                                marginTop: '0.5rem'
                            }}>
                                <div style={{
                                    width: `${Math.min(100, (bal.usedDays / bal.allocatedDays) * 100)}%`,
                                    height: '100%',
                                    background: 'var(--accent-color)'
                                }} />
                            </div>

                            <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.4rem', textAlign: 'right' }}>
                                {bal.usedDays} days used
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '1.5rem'
            }}>
                <button
                    onClick={() => setActiveTab('my-leaves')}
                    style={{
                        padding: '0.75rem 1.25rem',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'my-leaves' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'my-leaves' ? 'var(--accent-color)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                    }}
                >
                    My Leave Requests ({myLeaves.length})
                </button>

                {isSupervisor && (
                    <button
                        onClick={() => setActiveTab('approvals')}
                        style={{
                            padding: '0.75rem 1.25rem',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'approvals' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeTab === 'approvals' ? 'var(--accent-color)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                        }}
                    >
                        <span>Pending Approvals</span>
                        {pendingApprovals.length > 0 && (
                            <span style={{
                                background: 'var(--warning)',
                                color: '#000',
                                fontSize: '0.6875rem',
                                padding: '0.1rem 0.45rem',
                                borderRadius: '9999px',
                                fontWeight: 700
                            }}>
                                {pendingApprovals.length}
                            </span>
                        )}
                    </button>
                )}

                {isSupervisor && (
                    <button
                        onClick={() => setActiveTab('all-leaves')}
                        style={{
                            padding: '0.75rem 1.25rem',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'all-leaves' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeTab === 'all-leaves' ? 'var(--accent-color)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                        }}
                    >
                        All Team Requests
                    </button>
                )}
            </div>

            {/* Content Tab: My Leaves */}
            {activeTab === 'my-leaves' && (
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    padding: '1.5rem'
                }}>
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            Loading leave requests...
                        </div>
                    ) : myLeaves.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            You have not submitted any leave requests yet.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                        <th style={{ padding: '0.75rem' }}>Type</th>
                                        <th style={{ padding: '0.75rem' }}>Duration</th>
                                        <th style={{ padding: '0.75rem' }}>Days</th>
                                        <th style={{ padding: '0.75rem' }}>Status</th>
                                        <th style={{ padding: '0.75rem' }}>Reason</th>
                                        <th style={{ padding: '0.75rem' }}>Reviewer Notes</th>
                                        <th style={{ padding: '0.75rem' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {myLeaves.map((req) => {
                                        const badge = getStatusBadge(req.status);
                                        const canCancel = ['PENDING_LEAD', 'PENDING_MANAGER', 'APPROVED'].includes(req.status);
                                        return (
                                            <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{req.type}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{req.daysCount} d</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <span style={{
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '9999px',
                                                        fontSize: '0.6875rem',
                                                        fontWeight: 700,
                                                        background: badge.bg,
                                                        color: badge.color,
                                                        border: `1px solid ${badge.border}`
                                                    }}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {req.reason}
                                                </td>
                                                <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    {req.reviewerNotes || '-'}
                                                </td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {canCancel && (
                                                        <button
                                                            onClick={() => handleCancel(req.id)}
                                                            className="btn btn-secondary"
                                                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', color: 'var(--danger)', borderColor: 'var(--danger)' }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Content Tab: Pending Approvals */}
            {activeTab === 'approvals' && (
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    padding: '1.5rem'
                }}>
                    {pendingApprovals.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            🎉 No pending leave requests awaiting your review!
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                        <th style={{ padding: '0.75rem' }}>Employee</th>
                                        <th style={{ padding: '0.75rem' }}>Type</th>
                                        <th style={{ padding: '0.75rem' }}>Dates</th>
                                        <th style={{ padding: '0.75rem' }}>Days</th>
                                        <th style={{ padding: '0.75rem' }}>Stage</th>
                                        <th style={{ padding: '0.75rem' }}>Reason</th>
                                        <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pendingApprovals.map((req) => (
                                        <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>
                                                {req.employee?.name}
                                                <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                                    {req.employee?.email}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem' }}>{req.type}</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                            </td>
                                            <td style={{ padding: '0.75rem', fontWeight: 600 }}>{req.daysCount} d</td>
                                            <td style={{ padding: '0.75rem' }}>
                                                <span style={{
                                                    fontSize: '0.6875rem',
                                                    padding: '0.2rem 0.5rem',
                                                    borderRadius: '9999px',
                                                    background: 'rgba(234, 179, 8, 0.2)',
                                                    color: 'var(--warning)',
                                                    fontWeight: 700
                                                }}>
                                                    {req.status === 'PENDING_LEAD' ? 'Lead Review' : 'Manager Review'}
                                                </span>
                                            </td>
                                            <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', maxWidth: '200px' }}>
                                                {req.reason}
                                            </td>
                                            <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                                                <div style={{ display: 'inline-flex', gap: '0.5rem' }}>
                                                    <button
                                                        onClick={() => {
                                                            setReviewingId(req.id);
                                                            setReviewAction('APPROVE');
                                                        }}
                                                        className="btn"
                                                        style={{
                                                            background: 'var(--success)',
                                                            padding: '0.3rem 0.65rem',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        Approve
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setReviewingId(req.id);
                                                            setReviewAction('REJECT');
                                                        }}
                                                        className="btn"
                                                        style={{
                                                            background: 'var(--danger)',
                                                            padding: '0.3rem 0.65rem',
                                                            fontSize: '0.75rem',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        Reject
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Content Tab: All Team Requests */}
            {activeTab === 'all-leaves' && (
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    padding: '1.5rem'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <h4 style={{ margin: 0, fontSize: '1rem' }}>Team Leave History</h4>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            {['ALL', 'PENDING_LEAD', 'PENDING_MANAGER', 'APPROVED', 'REJECTED', 'CANCELLED'].map((st) => (
                                <button
                                    key={st}
                                    onClick={() => setStatusFilter(st)}
                                    style={{
                                        padding: '0.3rem 0.6rem',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        border: statusFilter === st ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                        background: statusFilter === st ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-primary)',
                                        color: statusFilter === st ? '#60a5fa' : 'var(--text-secondary)'
                                    }}
                                >
                                    {st.replace('_', ' ')}
                                </button>
                            ))}
                        </div>
                    </div>

                    {allLeaves.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            No leave records found matching the criteria.
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                                <thead>
                                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                        <th style={{ padding: '0.75rem' }}>Employee</th>
                                        <th style={{ padding: '0.75rem' }}>Type</th>
                                        <th style={{ padding: '0.75rem' }}>Dates</th>
                                        <th style={{ padding: '0.75rem' }}>Days</th>
                                        <th style={{ padding: '0.75rem' }}>Status</th>
                                        <th style={{ padding: '0.75rem' }}>Reason</th>
                                        <th style={{ padding: '0.75rem' }}>Reviewers</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {allLeaves.map((req) => {
                                        const badge = getStatusBadge(req.status);
                                        return (
                                            <tr key={req.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{req.employee?.name}</td>
                                                <td style={{ padding: '0.75rem' }}>{req.type}</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    {new Date(req.startDate).toLocaleDateString()} - {new Date(req.endDate).toLocaleDateString()}
                                                </td>
                                                <td style={{ padding: '0.75rem', fontWeight: 600 }}>{req.daysCount} d</td>
                                                <td style={{ padding: '0.75rem' }}>
                                                    <span style={{
                                                        padding: '0.2rem 0.6rem',
                                                        borderRadius: '9999px',
                                                        fontSize: '0.6875rem',
                                                        fontWeight: 700,
                                                        background: badge.bg,
                                                        color: badge.color,
                                                        border: `1px solid ${badge.border}`
                                                    }}>
                                                        {badge.label}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {req.reason}
                                                </td>
                                                <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                                                    {req.teamLeadReviewer && <div>Lead: {req.teamLeadReviewer.name}</div>}
                                                    {req.managerReviewer && <div>Manager: {req.managerReviewer.name}</div>}
                                                    {!req.teamLeadReviewer && !req.managerReviewer && '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Apply Leave Modal */}
            {showApplyModal && (
                <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0 }}>Apply for Leave</h3>
                            <button
                                onClick={() => setShowApplyModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>

                        {applyError && (
                            <div style={{
                                padding: '0.75rem',
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid var(--danger)',
                                borderRadius: '6px',
                                color: 'var(--danger)',
                                marginBottom: '1rem',
                                fontSize: '0.875rem'
                            }}>
                                {applyError}
                            </div>
                        )}

                        <form onSubmit={handleApply}>
                            <div className="form-group">
                                <label>Leave Type *</label>
                                <select
                                    value={applyForm.type}
                                    onChange={(e) => setApplyForm({ ...applyForm, type: e.target.value as LeaveType })}
                                >
                                    {balances.map((b) => (
                                        <option key={b.id} value={b.leaveType}>
                                            {b.leaveType} ({b.remainingDays} days remaining)
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                                <div className="form-group">
                                    <label>Start Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={applyForm.startDate}
                                        onChange={(e) => setApplyForm({ ...applyForm, startDate: e.target.value })}
                                    />
                                </div>

                                <div className="form-group">
                                    <label>End Date *</label>
                                    <input
                                        type="date"
                                        required
                                        value={applyForm.endDate}
                                        onChange={(e) => setApplyForm({ ...applyForm, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            {calculateDays() > 0 && (
                                <div style={{
                                    marginBottom: '1rem',
                                    fontSize: '0.875rem',
                                    color: '#38bdf8',
                                    fontWeight: 600
                                }}>
                                    Total requested duration: {calculateDays()} calendar day(s)
                                </div>
                            )}

                            <div className="form-group">
                                <label>Reason for Leave *</label>
                                <textarea
                                    rows={3}
                                    required
                                    placeholder="Please describe reason for time off..."
                                    value={applyForm.reason}
                                    onChange={(e) => setApplyForm({ ...applyForm, reason: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowApplyModal(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn"
                                    disabled={isSubmitting || calculateDays() === 0}
                                >
                                    {isSubmitting ? 'Submitting...' : 'Submit Application'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Review Leave Modal */}
            {reviewingId && (
                <div className="modal-overlay" onClick={() => setReviewingId(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0 }}>
                                {reviewAction === 'APPROVE' ? 'Approve Leave Request' : 'Reject Leave Request'}
                            </h3>
                            <button
                                onClick={() => setReviewingId(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleReviewSubmit}>
                            <div className="form-group">
                                <label>Reviewer Notes / Feedback (Optional)</label>
                                <textarea
                                    rows={3}
                                    placeholder="Add any notes or justification..."
                                    value={reviewNotes}
                                    onChange={(e) => setReviewNotes(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setReviewingId(null)}
                                    disabled={isReviewing}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn"
                                    style={{
                                        background: reviewAction === 'APPROVE' ? 'var(--success)' : 'var(--danger)'
                                    }}
                                    disabled={isReviewing}
                                >
                                    {isReviewing ? 'Submitting...' : `Confirm ${reviewAction === 'APPROVE' ? 'Approval' : 'Rejection'}`}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
