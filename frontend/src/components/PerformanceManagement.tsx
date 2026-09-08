import React, { useState, useEffect } from 'react';
import {
    performanceService,
    type Goal,
    type GoalLevel,
    type PerformanceMetrics,
    type PerformanceReview,
    type CreateGoalDTO,
    type CreateReviewDTO
} from '../services/performance.service';
import { userService, type UserListItem } from '../services/user.service';
import { useAuth } from '../context/AuthContext';

export const PerformanceManagement: React.FC = () => {
    const { user } = useAuth();

    const [activeTab, setActiveTab] = useState<'metrics' | 'goals' | 'evaluate'>('metrics');
    const [metricsLevel, setMetricsLevel] = useState<'EMPLOYEE' | 'TEAM' | 'DEPARTMENT' | 'ORGANIZATION'>('EMPLOYEE');

    // Data states
    const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [reviews, setReviews] = useState<PerformanceReview[]>([]);
    const [subordinates, setSubordinates] = useState<UserListItem[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [goalLevelFilter, setGoalLevelFilter] = useState<string>('ALL');

    // Goal creation modal
    const [showGoalModal, setShowGoalModal] = useState(false);
    const [isSavingGoal, setIsSavingGoal] = useState(false);
    const [goalError, setGoalError] = useState<string | null>(null);
    const [goalForm, setGoalForm] = useState<CreateGoalDTO>({
        title: '',
        description: '',
        level: 'EMPLOYEE',
        target: '',
        deadline: ''
    });

    // Evaluate form
    const [isSubmittingReview, setIsSubmittingReview] = useState(false);
    const [reviewError, setReviewError] = useState<string | null>(null);
    const [reviewSuccess, setReviewSuccess] = useState<string | null>(null);
    const [reviewForm, setReviewForm] = useState<CreateReviewDTO>({
        employeeId: '',
        rating: 5,
        cadence: 'QUARTERLY',
        comments: '',
        periodStart: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        periodEnd: new Date().toISOString().split('T')[0]
    });

    const isSupervisor = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'TEAM_LEAD';
    const isAdmin = user?.role === 'ADMIN';

    const loadMetrics = async () => {
        try {
            const data = await performanceService.getMetrics({
                level: metricsLevel,
                id: metricsLevel === 'EMPLOYEE' ? user?.id : undefined
            });
            setMetrics(data);
        } catch (err: any) {
            console.error('Failed to load metrics:', err);
        }
    };

    const loadGoals = async () => {
        try {
            const params: any = {};
            if (goalLevelFilter !== 'ALL') {
                params.level = goalLevelFilter as GoalLevel;
            }
            const data = await performanceService.listGoals(params);
            setGoals(data.goals);
        } catch (err: any) {
            console.error('Failed to load goals:', err);
        }
    };

    const loadReviews = async () => {
        try {
            const data = await performanceService.listReviews();
            setReviews(data);
        } catch (err: any) {
            console.error('Failed to load reviews:', err);
        }
    };

    const loadSubordinates = async () => {
        if (!isSupervisor) return;
        try {
            const data = await userService.listUsers({ limit: 100 });
            // Exclude self from evaluation targets
            setSubordinates(data.users.filter(u => u.id !== user?.id));
            if (data.users.length > 0 && !reviewForm.employeeId) {
                const firstTarget = data.users.find(u => u.id !== user?.id);
                if (firstTarget) {
                    setReviewForm(prev => ({ ...prev, employeeId: firstTarget.id }));
                }
            }
        } catch (err: any) {
            console.error('Failed to load evaluation targets:', err);
        }
    };

    const refreshData = async () => {
        setIsLoading(true);
        await Promise.all([
            loadMetrics(),
            loadGoals(),
            loadReviews(),
            loadSubordinates()
        ]);
        setIsLoading(false);
    };

    useEffect(() => {
        refreshData();
    }, [metricsLevel, goalLevelFilter]);

    // Handle Quick Goal Progress Update
    const handleUpdateGoalProgress = async (goalId: string, currentProgress: number, increment: number) => {
        const nextProgress = Math.min(100, Math.max(0, currentProgress + increment));
        try {
            await performanceService.updateGoal(goalId, { progress: nextProgress });
            await loadGoals();
            await loadMetrics();
        } catch (err: any) {
            console.error('Failed to update goal progress:', err);
        }
    };

    // Handle Create Goal
    const handleCreateGoal = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingGoal(true);
        setGoalError(null);

        try {
            await performanceService.createGoal(goalForm);
            setShowGoalModal(false);
            setGoalForm({
                title: '',
                description: '',
                level: 'EMPLOYEE',
                target: '',
                deadline: ''
            });
            await loadGoals();
            await loadMetrics();
        } catch (err: any) {
            console.error('Failed to create goal:', err);
            setGoalError(err.response?.data?.error?.message || err.message || 'Failed to create goal');
        } finally {
            setIsSavingGoal(false);
        }
    };

    // Handle Submit Review
    const handleSubmitReview = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmittingReview(true);
        setReviewError(null);
        setReviewSuccess(null);

        try {
            await performanceService.submitReview(reviewForm);
            setReviewSuccess('Performance evaluation successfully submitted with auto-verified metrics!');
            setReviewForm(prev => ({ ...prev, comments: '' }));
            await loadReviews();
            await loadMetrics();
        } catch (err: any) {
            console.error('Failed to submit review:', err);
            setReviewError(err.response?.data?.error?.message || err.message || 'Failed to submit review');
        } finally {
            setIsSubmittingReview(false);
        }
    };

    const getGoalLevelColor = (lvl: string) => {
        switch (lvl) {
            case 'ORGANIZATION': return '#a855f7';
            case 'DEPARTMENT': return '#3b82f6';
            case 'TEAM': return '#10b981';
            case 'EMPLOYEE': return '#64748b';
            default: return '#64748b';
        }
    };

    const getGoalStatusColor = (st: string) => {
        switch (st) {
            case 'ACHIEVED': return 'var(--success)';
            case 'IN_PROGRESS': return 'var(--accent-color)';
            case 'MISSED': return 'var(--danger)';
            default: return 'var(--text-secondary)';
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
                        Performance & Cascading Goals
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                        Multi-dimensional performance evaluation, goal cascading, and automated metric auditing.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button
                        onClick={() => setShowGoalModal(true)}
                        className="btn"
                        style={{ padding: '0.6rem 1.2rem', fontSize: '0.875rem' }}
                    >
                        + Create Goal
                    </button>
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
                    onClick={() => setActiveTab('metrics')}
                    style={{
                        padding: '0.75rem 1.25rem',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'metrics' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'metrics' ? 'var(--accent-color)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                    }}
                >
                    Metrics & Reviews
                </button>

                <button
                    onClick={() => setActiveTab('goals')}
                    style={{
                        padding: '0.75rem 1.25rem',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: activeTab === 'goals' ? '2px solid var(--accent-color)' : '2px solid transparent',
                        color: activeTab === 'goals' ? 'var(--accent-color)' : 'var(--text-secondary)',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '0.875rem'
                    }}
                >
                    Cascading Goals ({goals.length})
                </button>

                {isSupervisor && (
                    <button
                        onClick={() => setActiveTab('evaluate')}
                        style={{
                            padding: '0.75rem 1.25rem',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === 'evaluate' ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeTab === 'evaluate' ? 'var(--accent-color)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            cursor: 'pointer',
                            fontSize: '0.875rem'
                        }}
                    >
                        Evaluate Subordinate
                    </button>
                )}
            </div>

            {/* Tab 1: Metrics & Reviews */}
            {activeTab === 'metrics' && (
                <div>
                    {/* Level Switcher (if supervisor) */}
                    {isSupervisor && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            marginBottom: '1.5rem',
                            background: 'var(--bg-secondary)',
                            padding: '0.75rem 1rem',
                            borderRadius: '8px',
                            border: '1px solid var(--border-color)'
                        }}>
                            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                                View Metrics Level:
                            </span>
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                {['EMPLOYEE', ...(user?.role === 'TEAM_LEAD' ? ['TEAM'] : []), ...(user?.role === 'MANAGER' || isAdmin ? ['TEAM', 'DEPARTMENT'] : []), ...(isAdmin ? ['ORGANIZATION'] : [])].map((lvl) => (
                                    <button
                                        key={lvl}
                                        onClick={() => setMetricsLevel(lvl as any)}
                                        style={{
                                            padding: '0.35rem 0.75rem',
                                            borderRadius: '6px',
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            border: metricsLevel === lvl ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                            background: metricsLevel === lvl ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-primary)',
                                            color: metricsLevel === lvl ? '#60a5fa' : 'var(--text-secondary)'
                                        }}
                                    >
                                        {lvl}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Metrics Cards */}
                    {metrics && (
                        <div style={{ marginBottom: '2rem' }}>
                            <div className="grid grid-cols-4" style={{ gap: '1rem' }}>
                                <div className="stat-card">
                                    <h3 style={{ color: 'var(--accent-color)' }}>{metrics.tasks.completionRate}%</h3>
                                    <p>Task Completion Rate ({metrics.tasks.completed}/{metrics.tasks.total})</p>
                                </div>
                                <div className="stat-card">
                                    <h3 style={{ color: 'var(--success)' }}>{metrics.tasks.onTimeRate}%</h3>
                                    <p>On-Time Delivery Rate</p>
                                </div>
                                <div className="stat-card">
                                    <h3 style={{ color: '#38bdf8' }}>{metrics.attendance.consistencyRate}%</h3>
                                    <p>Attendance Consistency</p>
                                </div>
                                <div className="stat-card">
                                    <h3 style={{ color: metrics.goals.achievedRate > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>
                                        {metrics.goals.achievedRate}%
                                    </h3>
                                    <p>Goals Achieved ({metrics.goals.achieved}/{metrics.goals.total})</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Formal Reviews List */}
                    <div style={{
                        background: 'var(--bg-secondary)',
                        borderRadius: '12px',
                        border: '1px solid var(--border-color)',
                        padding: '1.5rem'
                    }}>
                        <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.125rem' }}>
                            Formal Performance Reviews
                        </h3>

                        {isLoading ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                Loading performance reviews...
                            </div>
                        ) : reviews.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                                No formal evaluations recorded yet.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {reviews.map((rev) => (
                                    <div
                                        key={rev.id}
                                        style={{
                                            background: 'var(--bg-primary)',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color)',
                                            padding: '1.25rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                                            <div>
                                                <span style={{ fontWeight: 700, fontSize: '1rem' }}>
                                                    {rev.employee?.name}
                                                </span>
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginLeft: '0.5rem' }}>
                                                    Evaluated by {rev.reviewer?.name} ({rev.cadence})
                                                </span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <span style={{ color: 'var(--warning)', fontSize: '1.1rem', fontWeight: 700 }}>
                                                    {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                                                </span>
                                                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{rev.rating}/5</span>
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                            <span>Task Completion: <strong style={{ color: 'var(--text-primary)' }}>{rev.taskCompletionRate}%</strong></span>
                                            <span>On-Time Rate: <strong style={{ color: 'var(--text-primary)' }}>{rev.onTimeRate}%</strong></span>
                                            <span>Attendance: <strong style={{ color: 'var(--text-primary)' }}>{rev.attendanceConsistency}%</strong></span>
                                            <span>Period: {new Date(rev.periodStart).toLocaleDateString()} - {new Date(rev.periodEnd).toLocaleDateString()}</span>
                                        </div>

                                        {rev.comments && (
                                            <p style={{ margin: 0, fontSize: '0.875rem', background: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '6px', fontStyle: 'italic' }}>
                                                "{rev.comments}"
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab 2: Cascading Goals */}
            {activeTab === 'goals' && (
                <div>
                    {/* Goal Filters */}
                    <div style={{
                        display: 'flex',
                        gap: '0.5rem',
                        marginBottom: '1.5rem',
                        flexWrap: 'wrap'
                    }}>
                        {['ALL', 'ORGANIZATION', 'DEPARTMENT', 'TEAM', 'EMPLOYEE'].map((lvl) => (
                            <button
                                key={lvl}
                                onClick={() => setGoalLevelFilter(lvl)}
                                style={{
                                    padding: '0.4rem 0.8rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: goalLevelFilter === lvl ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    background: goalLevelFilter === lvl ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-secondary)',
                                    color: goalLevelFilter === lvl ? '#60a5fa' : 'var(--text-secondary)'
                                }}
                            >
                                {lvl}
                            </button>
                        ))}
                    </div>

                    {/* Goals Cards Grid */}
                    {isLoading ? (
                        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                            Loading cascading goals...
                        </div>
                    ) : goals.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '3rem', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                            No goals found matching the selected level.
                        </div>
                    ) : (
                        <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                            {goals.map((g) => (
                                <div
                                    key={g.id}
                                    style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '10px',
                                        padding: '1.25rem',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'space-between'
                                    }}
                                >
                                    <div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{
                                                fontSize: '0.6875rem',
                                                fontWeight: 700,
                                                padding: '0.15rem 0.5rem',
                                                borderRadius: '9999px',
                                                background: getGoalLevelColor(g.level),
                                                color: '#fff',
                                                textTransform: 'uppercase'
                                            }}>
                                                {g.level}
                                            </span>

                                            <span style={{
                                                fontSize: '0.75rem',
                                                fontWeight: 700,
                                                color: getGoalStatusColor(g.status)
                                            }}>
                                                {g.status.replace('_', ' ')}
                                            </span>
                                        </div>

                                        <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{g.title}</h4>
                                        {g.description && (
                                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: '0 0 0.75rem 0' }}>
                                                {g.description}
                                            </p>
                                        )}

                                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                                            <div>Target: <strong style={{ color: 'var(--text-primary)' }}>{g.target}</strong></div>
                                            <div>Deadline: {new Date(g.deadline).toLocaleDateString()}</div>
                                            {g.owner && <div>Owner: {g.owner.name}</div>}
                                            {g.team && <div>Team: {g.team.name}</div>}
                                            {g.department && <div>Department: {g.department.name}</div>}
                                        </div>

                                        {/* Progress bar */}
                                        <div style={{ marginBottom: '1rem' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                                <span>Progress</span>
                                                <span style={{ fontWeight: 700 }}>{g.progress}%</span>
                                            </div>
                                            <div style={{
                                                width: '100%',
                                                height: '8px',
                                                background: 'rgba(255,255,255,0.08)',
                                                borderRadius: '9999px',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    width: `${g.progress}%`,
                                                    height: '100%',
                                                    background: g.progress >= 100 ? 'var(--success)' : 'var(--accent-color)'
                                                }} />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Quick Update Progress Controls */}
                                    <div style={{ display: 'flex', gap: '0.4rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
                                        <button
                                            onClick={() => handleUpdateGoalProgress(g.id, g.progress, 10)}
                                            className="btn btn-secondary"
                                            style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                        >
                                            +10%
                                        </button>
                                        <button
                                            onClick={() => handleUpdateGoalProgress(g.id, g.progress, 25)}
                                            className="btn btn-secondary"
                                            style={{ flex: 1, padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                        >
                                            +25%
                                        </button>
                                        <button
                                            onClick={() => handleUpdateGoalProgress(g.id, g.progress, 100)}
                                            className="btn"
                                            style={{ flex: 1.5, padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: 'var(--success)' }}
                                        >
                                            Complete (100%)
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Tab 3: Evaluate Subordinate */}
            {activeTab === 'evaluate' && isSupervisor && (
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    padding: '2rem',
                    maxWidth: '680px',
                    margin: '0 auto'
                }}>
                    <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.25rem' }}>
                        Conduct Formal Performance Review
                    </h3>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Task completion rates, on-time delivery rates, and attendance consistency are verified and computed automatically from live database records.
                    </p>

                    {reviewError && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {reviewError}
                        </div>
                    )}

                    {reviewSuccess && (
                        <div style={{ padding: '0.75rem 1rem', background: 'rgba(34, 197, 94, 0.15)', border: '1px solid var(--success)', borderRadius: '6px', color: 'var(--success)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                            {reviewSuccess}
                        </div>
                    )}

                    <form onSubmit={handleSubmitReview}>
                        <div className="form-group">
                            <label>Employee Under Review *</label>
                            <select
                                required
                                value={reviewForm.employeeId}
                                onChange={(e) => setReviewForm({ ...reviewForm, employeeId: e.target.value })}
                            >
                                {subordinates.map((sub) => (
                                    <option key={sub.id} value={sub.id}>
                                        {sub.name} ({sub.email}) - {sub.role}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                            <div className="form-group">
                                <label>Evaluation Cadence</label>
                                <select
                                    value={reviewForm.cadence}
                                    onChange={(e) => setReviewForm({ ...reviewForm, cadence: e.target.value })}
                                >
                                    <option value="MONTHLY">Monthly</option>
                                    <option value="QUARTERLY">Quarterly</option>
                                    <option value="ANNUAL">Annual</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Performance Rating (1 - 5 Stars) *</label>
                                <select
                                    value={reviewForm.rating}
                                    onChange={(e) => setReviewForm({ ...reviewForm, rating: Number(e.target.value) })}
                                >
                                    <option value={5}>★★★★★ (5 - Exceptional)</option>
                                    <option value={4}>★★★★☆ (4 - Exceeds Expectations)</option>
                                    <option value={3}>★★★☆☆ (3 - Meets Expectations)</option>
                                    <option value={2}>★★☆☆☆ (2 - Needs Improvement)</option>
                                    <option value={1}>★☆☆☆☆ (1 - Unsatisfactory)</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-2" style={{ gap: '1rem' }}>
                            <div className="form-group">
                                <label>Evaluation Period Start *</label>
                                <input
                                    type="date"
                                    required
                                    value={reviewForm.periodStart}
                                    onChange={(e) => setReviewForm({ ...reviewForm, periodStart: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Evaluation Period End *</label>
                                <input
                                    type="date"
                                    required
                                    value={reviewForm.periodEnd}
                                    onChange={(e) => setReviewForm({ ...reviewForm, periodEnd: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label>Review Feedback & Development Notes</label>
                            <textarea
                                rows={4}
                                placeholder="Detail strengths, accomplishments, areas for growth, and coaching guidance..."
                                value={reviewForm.comments}
                                onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                            <button
                                type="submit"
                                className="btn"
                                disabled={isSubmittingReview || !reviewForm.employeeId}
                            >
                                {isSubmittingReview ? 'Verifying & Submitting...' : 'Submit Formal Evaluation'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Create Goal Modal */}
            {showGoalModal && (
                <div className="modal-overlay" onClick={() => setShowGoalModal(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0 }}>Create Cascading Goal</h3>
                            <button
                                onClick={() => setShowGoalModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>

                        {goalError && (
                            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid var(--danger)', borderRadius: '6px', color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                                {goalError}
                            </div>
                        )}

                        <form onSubmit={handleCreateGoal}>
                            <div className="form-group">
                                <label>Goal Cascade Level *</label>
                                <select
                                    value={goalForm.level}
                                    onChange={(e) => setGoalForm({ ...goalForm, level: e.target.value as GoalLevel })}
                                >
                                    <option value="EMPLOYEE">Employee Goal</option>
                                    {isSupervisor && <option value="TEAM">Team Goal</option>}
                                    {(user?.role === 'MANAGER' || isAdmin) && <option value="DEPARTMENT">Department Goal</option>}
                                    {isAdmin && <option value="ORGANIZATION">Organization-Wide Goal</option>}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Goal Title *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Increase Sprint Velocity by 15%"
                                    value={goalForm.title}
                                    onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Target Key Result / Metric *</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Deliver 12 story points per dev"
                                    value={goalForm.target}
                                    onChange={(e) => setGoalForm({ ...goalForm, target: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Target Deadline *</label>
                                <input
                                    type="date"
                                    required
                                    value={goalForm.deadline}
                                    onChange={(e) => setGoalForm({ ...goalForm, deadline: e.target.value })}
                                />
                            </div>

                            <div className="form-group">
                                <label>Description / Context</label>
                                <textarea
                                    rows={3}
                                    placeholder="Describe strategic context or execution approach..."
                                    value={goalForm.description}
                                    onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setShowGoalModal(false)}
                                    disabled={isSavingGoal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn"
                                    disabled={isSavingGoal}
                                >
                                    {isSavingGoal ? 'Creating...' : 'Create Goal'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
