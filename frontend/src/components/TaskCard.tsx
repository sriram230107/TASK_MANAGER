import React, { useState } from 'react';
import axios from 'axios';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';

export const TaskCard: React.FC<{ task: any }> = ({ task }) => {
    const [progress, setProgress] = useState(task.progressPercent || 0);
    const [comment, setComment] = useState('');
    const [hours, setHours] = useState('');
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    const handleSaveProgress = async () => {
        try {
            setSaving(true);
            setMessage('');

            const token = localStorage.getItem('token');

            if (!token) {
                setMessage('Authentication token not found');
                return;
            }

            await axios.post(
                `http://localhost:3000/api/v1/tasks/${task.id}/updates`,
                {
                    progressPercent: Number(progress),
                    comment: comment || undefined,
                    hoursLogged: hours ? Number(hours) : undefined
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            setMessage('Progress updated successfully');

            // Refresh the page so dashboard statistics update
            window.location.reload();

        } catch (error: any) {
            console.error('Progress update error:', error);

            setMessage(
                error.response?.data?.message ||
                'Failed to update progress'
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <div
            className="task-card"
            style={{ cursor: 'default' }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.5rem'
                }}
            >
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>
                    {task.title}
                </h3>

                <StatusBadge status={task.status} />
            </div>

            <p
                style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem'
                }}
            >
                Due:{' '}
                {task.dueDate
                    ? new Date(task.dueDate).toLocaleDateString()
                    : 'N/A'}
            </p>

            <div style={{ marginTop: '1rem' }}>
                <ProgressBar percent={progress} />
            </div>

            <div style={{ marginTop: '1rem' }}>
                <label>
                    <strong>Progress (%)</strong>
                </label>

                <input
                    type="number"
                    min="0"
                    max="100"
                    value={progress}
                    onChange={(e) =>
                        setProgress(
                            Math.min(
                                100,
                                Math.max(0, Number(e.target.value))
                            )
                        )
                    }
                    style={{
                        width: '100%',
                        marginTop: '0.4rem',
                        padding: '0.5rem'
                    }}
                />
            </div>

            <div style={{ marginTop: '1rem' }}>
                <label>
                    <strong>Comment</strong>
                </label>

                <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Enter your progress update"
                    style={{
                        width: '100%',
                        marginTop: '0.4rem',
                        padding: '0.5rem',
                        minHeight: '70px'
                    }}
                />
            </div>

            <div style={{ marginTop: '1rem' }}>
                <label>
                    <strong>Hours Logged</strong>
                </label>

                <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    placeholder="Example: 1"
                    style={{
                        width: '100%',
                        marginTop: '0.4rem',
                        padding: '0.5rem'
                    }}
                />
            </div>

            <button
                onClick={handleSaveProgress}
                disabled={saving}
                style={{
                    marginTop: '1rem',
                    width: '100%',
                    padding: '0.7rem',
                    cursor: saving ? 'not-allowed' : 'pointer'
                }}
            >
                {saving ? 'Saving...' : 'Save Progress'}
            </button>

            {message && (
                <p
                    style={{
                        marginTop: '0.75rem',
                        color: message.includes('successfully')
                            ? 'var(--success)'
                            : 'var(--danger)'
                    }}
                >
                    {message}
                </p>
            )}
        </div>
    );
};