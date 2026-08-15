import React from 'react';

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const colors: any = {
        NOT_STARTED: '#64748b',
        IN_PROGRESS: '#3b82f6',
        PENDING_REVIEW: '#eab308',
        COMPLETED: '#22c55e',
        BLOCKED: '#ef4444'
    };

    return (
        <span style={{
            background: colors[status] || '#64748b',
            color: '#fff',
            padding: '0.25rem 0.6rem',
            borderRadius: '9999px',
            fontSize: '0.75rem',
            fontWeight: '600'
        }}>
            {status.replace(/_/g, ' ')}
        </span>
    );
};
