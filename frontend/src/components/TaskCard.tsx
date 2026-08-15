import React from 'react';
import { StatusBadge } from './StatusBadge';
import { ProgressBar } from './ProgressBar';

export const TaskCard: React.FC<{ task: any, onClick?: () => void }> = ({ task, onClick }) => {
    return (
        <div className="task-card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem' }}>{task.title}</h3>
                <StatusBadge status={task.status} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                Due: {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : 'N/A'}
            </p>
            <div style={{ marginTop: '1rem' }}>
                <ProgressBar percent={task.progressPercent || 0} />
            </div>
        </div>
    );
};
