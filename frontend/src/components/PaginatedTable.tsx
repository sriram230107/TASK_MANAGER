import React from 'react';

export const PaginatedTable: React.FC<{ columns: string[], data: any[] }> = ({ columns, data }) => {
    return (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <tr>
                        {columns.map(c => <th key={c} style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.875rem', fontWeight: 600 }}>{c}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {data.length === 0 ? (
                        <tr><td colSpan={columns.length} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>No items found</td></tr>
                    ) : data.map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--border-color)' }}>
                            {columns.map((c, j) => (
                                <td key={j} style={{ padding: '1rem', fontSize: '0.875rem' }}>{row[c]}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};
