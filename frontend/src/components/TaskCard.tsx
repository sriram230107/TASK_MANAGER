import React, { useState } from 'react';
import { taskService, type Task } from '../services/task.service';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';

interface TaskCardProps {
    task: Task;
    userRole?: string;
    onUpdated?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
    task,
    userRole = 'EMPLOYEE',
    onUpdated
}) => {
    const [progress, setProgress] = useState(task.progressPercent ?? 0);
    const [comment, setComment] = useState('');
    const [hoursLogged, setHoursLogged] = useState('');
    const [reviewNotes, setReviewNotes] = useState('');
    const [completionNotes, setCompletionNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
    const [showComments, setShowComments] = useState(false);
    const [newComment, setNewComment] = useState('');
    const [commentLoading, setCommentLoading] = useState(false);

    const isOverdue = task.isOverdue || task.computedStatus === 'OVERDUE';
    const effectiveStatus = isOverdue ? 'OVERDUE' : task.status;

    const handleAction = async (actionFn: () => Promise<any>, successMsg: string) => {
        try {
            setSaving(true);
            setMessage(null);
            await actionFn();
            setMessage({ text: successMsg, type: 'success' });
            setComment('');
            setHoursLogged('');
            setReviewNotes('');
            setCompletionNotes('');
            onUpdated?.();
        } catch (error: any) {
            const errText =
                error.response?.data?.error?.message ||
                error.response?.data?.message ||
                error.message ||
                'Action failed';
            setMessage({ text: errText, type: 'error' });
        } finally {
            setSaving(false);
        }
    };

    // Employee Actions
    const handleAccept = () => {
        handleAction(
            () => taskService.updateTaskStatus(task.id, { status: 'ACCEPTED' }),
            'Task accepted successfully'
        );
    };

    const handleStartWork = () => {
        handleAction(
            () => taskService.updateTaskStatus(task.id, { status: 'IN_PROGRESS' }),
            'Task is now in progress'
        );
    };

    const handleLogProgress = () => {
        handleAction(
            () =>
                taskService.logProgress(task.id, {
                    progressPercent: Number(progress),
                    comment: comment || undefined,
                    hoursLogged: hoursLogged ? Number(hoursLogged) : undefined
                }),
            'Progress and hours logged'
        );
    };

    const handlePutOnHold = () => {
        handleAction(
            () =>
                taskService.updateTaskStatus(task.id, {
                    status: 'ON_HOLD',
                    comment: comment || 'Task put on hold'
                }),
            'Task put on hold'
        );
    };

    const handleSubmitForReview = () => {
        handleAction(
            () =>
                taskService.updateTaskStatus(task.id, {
                    status: 'SUBMITTED',
                    progressPercent: Number(progress),
                    comment: comment || 'Submitted for review'
                }),
            'Task submitted for review'
        );
    };

    // Reviewer Actions (Team Lead, Manager, Admin)
    const handleApproveComplete = () => {
        handleAction(
            () =>
                taskService.updateTaskStatus(task.id, {
                    status: 'COMPLETED',
                    reviewNotes: reviewNotes || undefined,
                    completionNotes: completionNotes || undefined
                }),
            'Task approved and completed!'
        );
    };

    const handleRequestChanges = () => {
        if (!reviewNotes) {
            setMessage({ text: 'Review notes are required when requesting changes', type: 'error' });
            return;
        }
        handleAction(
            () =>
                taskService.updateTaskStatus(task.id, {
                    status: 'CHANGES_REQUESTED',
                    reviewNotes
                }),
            'Changes requested'
        );
    };

    // Comment Submission
    const handlePostComment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newComment.trim()) return;

        try {
            setCommentLoading(true);
            await taskService.addComment(task.id, newComment.trim());
            setNewComment('');
            onUpdated?.();
        } catch (err: any) {
            setMessage({
                text: err.response?.data?.error?.message || 'Failed to post comment',
                type: 'error'
            });
        } finally {
            setCommentLoading(false);
        }
    };

    const isEmployee = userRole === 'EMPLOYEE';
    const isReviewer = userRole === 'TEAM_LEAD' || userRole === 'MANAGER' || userRole === 'ADMIN';

    return (
        <div
            className="auth-card"
            style={{
                background: 'var(--bg-secondary)',
                padding: '1.5rem',
                borderRadius: '8px',
                border: isOverdue ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                position: 'relative'
            }}
        >
            {isOverdue && (
                <div
                    style={{
                        background: 'rgba(239, 68, 68, 0.15)',
                        color: 'var(--danger)',
                        padding: '0.25rem 0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        display: 'inline-block',
                        width: 'fit-content'
                    }}
                >
                    ⚠️ OVERDUE DEADLINE
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h4 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{task.title}</h4>
                    {task.description && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                            {task.description}
                        </p>
                    )}
                </div>
                <StatusBadge status={effectiveStatus} />
            </div>

            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {task.priority && <span>Priority: <strong>{task.priority}</strong></span>}
                {task.dueDate && <span>Due: <strong>{new Date(task.dueDate).toLocaleDateString()}</strong></span>}
                {task.estimatedHours != null && <span>Est: <strong>{task.estimatedHours}h</strong></span>}
                <span>Logged: <strong>{task.actualHours || 0}h</strong></span>
                {task.assignedTo && <span>Assignee: <strong>{task.assignedTo.name}</strong></span>}
                {task.team && <span>Team: <strong>{task.team.name}</strong></span>}
                {task.department && <span>Dept: <strong>{task.department.name}</strong></span>}
            </div>

            <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                    <span>Progress</span>
                    <strong>{task.progressPercent}%</strong>
                </div>
                <ProgressBar percent={task.progressPercent} />
            </div>

            {task.completionNotes && (
                <div style={{ padding: '0.5rem', background: 'rgba(34, 197, 94, 0.1)', borderRadius: '4px', fontSize: '0.8rem' }}>
                    <strong style={{ color: 'var(--success)' }}>Completion Notes:</strong> {task.completionNotes}
                </div>
            )}

            {task.reviewNotes && (
                <div style={{ padding: '0.5rem', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '4px', fontSize: '0.8rem' }}>
                    <strong style={{ color: 'var(--warning)' }}>Review Notes:</strong> {task.reviewNotes}
                </div>
            )}

            {message && (
                <div
                    style={{
                        padding: '0.5rem',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        background: message.type === 'success' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: message.type === 'success' ? 'var(--success)' : 'var(--danger)'
                    }}
                >
                    {message.text}
                </div>
            )}

            {/* EMPLOYEE CONTROLS */}
            {isEmployee && task.status !== 'COMPLETED' && task.status !== 'CANCELLED' && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {task.status === 'ASSIGNED' && (
                        <button className="btn" onClick={handleAccept} disabled={saving}>
                            {saving ? 'Processing...' : 'Accept Task'}
                        </button>
                    )}

                    {(task.status === 'ACCEPTED' || task.status === 'CHANGES_REQUESTED') && (
                        <button className="btn" onClick={handleStartWork} disabled={saving}>
                            {saving ? 'Processing...' : 'Start Working (In Progress)'}
                        </button>
                    )}

                    {task.status === 'IN_PROGRESS' && (
                        <>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Update Progress (%)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="100"
                                        value={progress}
                                        onChange={(e) => setProgress(Number(e.target.value))}
                                        style={{ width: '100%', padding: '0.3rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                    />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Hours to Log</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={hoursLogged}
                                        placeholder="e.g. 2.5"
                                        onChange={(e) => setHoursLogged(e.target.value)}
                                        style={{ width: '100%', padding: '0.3rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px' }}
                                    />
                                </div>
                            </div>
                            <input
                                type="text"
                                placeholder="Progress notes / what was done"
                                value={comment}
                                onChange={(e) => setComment(e.target.value)}
                                style={{ width: '100%', padding: '0.4rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}
                            />
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <button className="btn" onClick={handleLogProgress} disabled={saving} style={{ flex: 1 }}>
                                    Log Progress
                                </button>
                                <button className="btn-secondary" onClick={handlePutOnHold} disabled={saving}>
                                    Put On Hold
                                </button>
                                <button
                                    className="btn"
                                    onClick={handleSubmitForReview}
                                    disabled={saving}
                                    style={{ background: 'var(--warning)', color: '#000', fontWeight: 'bold' }}
                                >
                                    Submit for Review
                                </button>
                            </div>
                        </>
                    )}

                    {task.status === 'ON_HOLD' && (
                        <button className="btn" onClick={handleStartWork} disabled={saving}>
                            Resume Task
                        </button>
                    )}

                    {(task.status === 'SUBMITTED' || task.status === 'UNDER_REVIEW') && (
                        <div style={{ textAlign: 'center', color: 'var(--warning)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                            Task submitted. Awaiting review from Team Lead or Manager.
                        </div>
                    )}
                </div>
            )}

            {/* REVIEWER CONTROLS */}
            {isReviewer && (task.status === 'SUBMITTED' || task.status === 'UNDER_REVIEW') && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <h5 style={{ margin: 0, color: 'var(--warning)' }}>Review & Verification</h5>
                    <textarea
                        rows={2}
                        placeholder="Review notes / feedback / verification details"
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        style={{ width: '100%', padding: '0.4rem', background: 'var(--bg-primary)', color: '#fff', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.8rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            className="btn"
                            onClick={handleApproveComplete}
                            disabled={saving}
                            style={{ flex: 1, background: 'var(--success)' }}
                        >
                            Approve & Complete
                        </button>
                        <button
                            className="btn-secondary"
                            onClick={handleRequestChanges}
                            disabled={saving}
                            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        >
                            Request Changes
                        </button>
                    </div>
                </div>
            )}

            {/* COMMENTS & AUDIT TRAIL ACCORDION */}
            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
                <button
                    onClick={() => setShowComments(!showComments)}
                    style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent-color)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        padding: 0,
                        textDecoration: 'underline'
                    }}
                >
                    {showComments ? 'Hide Comments & History' : `Comments (${task.comments?.length || 0}) & History`}
                </button>

                {showComments && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        {/* Discussion List */}
                        <div style={{ maxHeight: '180px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {task.comments && task.comments.length > 0 ? (
                                task.comments.map((c) => (
                                    <div
                                        key={c.id}
                                        style={{
                                            background: 'var(--bg-primary)',
                                            padding: '0.5rem',
                                            borderRadius: '4px',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', fontSize: '0.7rem' }}>
                                            <span>{c.user?.name || 'User'} ({c.user?.role || 'MEMBER'})</span>
                                            <span>{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                        </div>
                                        <div style={{ marginTop: '0.25rem' }}>{c.content}</div>
                                    </div>
                                ))
                            ) : (
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>No comments yet.</p>
                            )}
                        </div>

                        {/* Add Comment */}
                        <form onSubmit={handlePostComment} style={{ display: 'flex', gap: '0.5rem' }}>
                            <input
                                type="text"
                                placeholder="Add a comment..."
                                value={newComment}
                                onChange={(e) => setNewComment(e.target.value)}
                                disabled={commentLoading}
                                style={{
                                    flex: 1,
                                    padding: '0.35rem',
                                    background: 'var(--bg-primary)',
                                    color: '#fff',
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem'
                                }}
                            />
                            <button type="submit" className="btn" disabled={commentLoading || !newComment.trim()} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}>
                                Post
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};
