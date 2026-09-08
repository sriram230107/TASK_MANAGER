import React from 'react';

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const colors: Record<string, string> = {
        DRAFT: '#64748b',
        ASSIGNED: '#6366f1',
        ACCEPTED: '#0284c7',
        IN_PROGRESS: '#3b82f6',
        ON_HOLD: '#f97316',
        SUBMITTED: '#d97706',
        UNDER_REVIEW: '#eab308',
        COMPLETED: '#22c55e',
        CHANGES_REQUESTED: '#f43f5e',
        CANCELLED: '#475569',
        OVERDUE: '#ef4444',
        // Legacy fallbacks
        NOT_STARTED: '#64748b',
        BLOCKED: '#f97316',
        PENDING_REVIEW: '#eab308'
    };

    const bg = colors[status] || '#64748b';

    return (
        <span
            style={{
                background: bg,
                color: '#fff',
                padding: '0.25rem 0.65rem',
                borderRadius: '9999px',
                fontSize: '0.75rem',
                fontWeight: '600',
                letterSpacing: '0.025em',
                textTransform: 'uppercase',
                display: 'inline-block'
            }}
        >
            {status ? status.replace(/_/g, ' ') : 'UNKNOWN'}
        </span>
    );
};
