import React from 'react';

export const ProgressBar: React.FC<{ percent: number }> = ({ percent }) => {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ flexGrow: 1, background: 'var(--border-color)', height: '6px', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${percent}%`, background: 'var(--accent-color)', height: '100%', transition: 'width 0.3s' }}></div>
            </div>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, minWidth: '30px' }}>{percent}%</span>
        </div>
    );
};
