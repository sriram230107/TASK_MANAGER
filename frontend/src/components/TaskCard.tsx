import React, { useState } from 'react';
import axios from 'axios';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';

interface Task {
    id: string;
    title: string;
    description?: string;
    status: string;
    progressPercent: number;
    actualHours?: number;
    dueDate?: string;
}

interface TaskCardProps {
    task: Task;
    userRole?: string;
    onUpdated?: () => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
    task,
    userRole,
    onUpdated
}) => {
    const [progress, setProgress] = useState(
        task.progressPercent ?? 0
    );

    const [comment, setComment] = useState('');
    const [hoursLogged, setHoursLogged] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const apiUrl = 'http://localhost:3000/api/v1';

    const handleSaveProgress = async () => {
        try {
            setSaving(true);
            setMessage('');

            await axios.post(
                `${apiUrl}/tasks/${task.id}/updates`,
                {
                    progressPercent: Number(progress),
                    comment: comment || undefined,
                    hoursLogged: hoursLogged
                        ? Number(hoursLogged)
                        : undefined
                },
                {
                    withCredentials: true
                }
            );

            setMessage('Progress updated successfully');
            onUpdated?.();
        } catch (error: any) {
            console.error(
                'Progress update error:',
                error
            );

            setMessage(
                error?.response?.data?.message ||
                'Failed to update progress'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleSubmitForReview = async () => {
        try {
            setSaving(true);
            setMessage('');

            await axios.put(
                `${apiUrl}/tasks/${task.id}/status`,
                {
                    status: 'PENDING_REVIEW',
                    progressPercent: progress,
                    comment: comment || undefined
                },
                {
                    withCredentials: true
                }
            );

            setMessage(
                'Task submitted for review'
            );

            onUpdated?.();
        } catch (error: any) {
            console.error(
                'Submit review error:',
                error
            );

            setMessage(
                error?.response?.data?.message ||
                'Failed to submit task for review'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleApprove = async () => {
        try {
            setSaving(true);
            setMessage('');

            await axios.put(
                `${apiUrl}/tasks/${task.id}/status`,
                {
                    status: 'COMPLETED',
                    progressPercent: 100
                },
                {
                    withCredentials: true
                }
            );

            setMessage(
                'Task approved and completed'
            );

            onUpdated?.();
        } catch (error: any) {
            console.error(
                'Approval error:',
                error
            );

            setMessage(
                error?.response?.data?.message ||
                'Failed to approve task'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleReject = async () => {
        if (!comment.trim()) {
            setMessage(
                'Please enter a comment when rejecting a task'
            );
            return;
        }

        try {
            setSaving(true);
            setMessage('');

            await axios.put(
                `${apiUrl}/tasks/${task.id}/status`,
                {
                    status: 'IN_PROGRESS',
                    comment
                },
                {
                    withCredentials: true
                }
            );

            setMessage(
                'Task returned to employee'
            );

            onUpdated?.();
        } catch (error: any) {
            console.error(
                'Reject error:',
                error
            );

            setMessage(
                error?.response?.data?.message ||
                'Failed to reject task'
            );
        } finally {
            setSaving(false);
        }
    };

    const employeeCanEdit =
        userRole === 'EMPLOYEE' &&
        task.status !== 'PENDING_REVIEW' &&
        task.status !== 'COMPLETED';

    const teamLeadCanReview =
        userRole === 'TEAM_LEAD' &&
        task.status === 'PENDING_REVIEW';

    return (
        <div
            className="task-card"
            style={{
                padding: '1.25rem',
                marginBottom: '1rem',
                border: '1px solid var(--border)',
                borderRadius: '10px'
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.75rem'
                }}
            >
                <h3>{task.title}</h3>

                <StatusBadge
                    status={task.status}
                />
            </div>

            {task.description && (
                <p
                    style={{
                        color: 'var(--text-secondary)'
                    }}
                >
                    {task.description}
                </p>
            )}

            <ProgressBar
                percent={progress}
            />

            <div
                style={{
                    marginTop: '0.75rem'
                }}
            >
                <strong>
                    Progress: {progress}%
                </strong>
            </div>

            {task.dueDate && (
                <p>
                    Due:{' '}
                    {new Date(
                        task.dueDate
                    ).toLocaleDateString()}
                </p>
            )}

            {employeeCanEdit && (
                <>
                    <div
                        style={{
                            marginTop: '1rem'
                        }}
                    >
                        <label>
                            Progress (%)
                        </label>

                        <input
                            type="number"
                            min="0"
                            max="99"
                            value={progress}
                            onChange={(e) =>
                                setProgress(
                                    Math.min(
                                        99,
                                        Math.max(
                                            0,
                                            Number(
                                                e.target.value
                                            )
                                        )
                                    )
                                )
                            }
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                marginTop: '0.25rem'
                            }}
                        />
                    </div>

                    <div
                        style={{
                            marginTop: '1rem'
                        }}
                    >
                        <label>
                            Comment
                        </label>

                        <textarea
                            value={comment}
                            onChange={(e) =>
                                setComment(
                                    e.target.value
                                )
                            }
                            placeholder="Enter your progress update"
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                marginTop: '0.25rem'
                            }}
                        />
                    </div>

                    <div
                        style={{
                            marginTop: '1rem'
                        }}
                    >
                        <label>
                            Hours Logged
                        </label>

                        <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={hoursLogged}
                            onChange={(e) =>
                                setHoursLogged(
                                    e.target.value
                                )
                            }
                            placeholder="Example: 1.5"
                            style={{
                                width: '100%',
                                padding: '0.5rem',
                                marginTop: '0.25rem'
                            }}
                        />
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: '0.75rem',
                            marginTop: '1rem',
                            flexWrap: 'wrap'
                        }}
                    >
                        <button
                            className="btn"
                            onClick={
                                handleSaveProgress
                            }
                            disabled={saving}
                        >
                            {saving
                                ? 'Saving...'
                                : 'Save Progress'}
                        </button>

                        {progress >= 100 && (
                            <button
                                className="btn"
                                onClick={
                                    handleSubmitForReview
                                }
                                disabled={saving}
                            >
                                Submit for Review
                            </button>
                        )}

                        {progress < 100 && (
                            <button
                                className="btn"
                                onClick={
                                    handleSubmitForReview
                                }
                                disabled={saving}
                            >
                                Submit for Review
                            </button>
                        )}
                    </div>
                </>
            )}

            {teamLeadCanReview && (
                <>
                    <div
                        style={{
                            marginTop: '1rem'
                        }}
                    >
                        <label>
                            Review Comment
                        </label>

                        <textarea
                            value={comment}
                            onChange={(e) =>
                                setComment(
                                    e.target.value
                                )
                            }
                            placeholder="Enter approval or rejection comment"
                            style={{
                                width: '100%',
                                minHeight: '80px',
                                marginTop: '0.25rem'
                            }}
                        />
                    </div>

                    <div
                        style={{
                            display: 'flex',
                            gap: '0.75rem',
                            marginTop: '1rem'
                        }}
                    >
                        <button
                            className="btn"
                            onClick={
                                handleApprove
                            }
                            disabled={saving}
                        >
                            {saving
                                ? 'Processing...'
                                : 'Approve & Complete'}
                        </button>

                        <button
                            className="btn"
                            onClick={
                                handleReject
                            }
                            disabled={saving}
                        >
                            {saving
                                ? 'Processing...'
                                : 'Reject & Return'}
                        </button>
                    </div>
                </>
            )}

            {message && (
                <div
                    style={{
                        marginTop: '1rem',
                        padding: '0.75rem',
                        borderRadius: '6px'
                    }}
                >
                    {message}
                </div>
            )}
        </div>
    );
};