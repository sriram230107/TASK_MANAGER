import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auditService, type AuditLogItem, type AuditSummary } from '../services/audit.service';

export const AuditLogViewer: React.FC = () => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<AuditLogItem[]>([]);
    const [summary, setSummary] = useState<AuditSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [entityFilter, setEntityFilter] = useState<string>('');
    const [actionFilter, setActionFilter] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [page, setPage] = useState<number>(1);
    const [totalPages, setTotalPages] = useState<number>(1);
    const [totalCount, setTotalCount] = useState<number>(0);

    // Selected log for metadata inspection
    const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);

    const isAuthorized = user?.role === 'ADMIN' || user?.role === 'MANAGER';

    const loadData = async () => {
        if (!isAuthorized) return;
        setIsLoading(true);
        setError(null);
        try {
            const [logsRes, summaryRes] = await Promise.all([
                auditService.list({
                    entity: entityFilter || undefined,
                    action: actionFilter || undefined,
                    search: searchQuery.trim() || undefined,
                    page,
                    limit: 25
                }),
                auditService.getSummary().catch(() => null)
            ]);

            setLogs(logsRes.logs);
            setTotalPages(logsRes.pagination.totalPages);
            setTotalCount(logsRes.pagination.total);
            if (summaryRes) {
                setSummary(summaryRes);
            }
        } catch (err: any) {
            console.error('Failed to load audit logs:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load audit logs');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) {
            loadData();
        }
    }, [entityFilter, actionFilter, page]);

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1);
        loadData();
    };

    if (!isAuthorized) {
        return (
            <div style={{ padding: '60px 20px', textAlign: 'center', maxWidth: '600px', margin: '40px auto' }}>
                <span style={{ fontSize: '3.5rem' }}>🔒</span>
                <h2 style={{ color: 'var(--text-primary)', marginTop: '16px' }}>Access Restricted</h2>
                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Audit logs contain sensitive organization compliance data and are strictly restricted to Administrators and Department Managers per organization security policies.
                </p>
            </div>
        );
    }

    const getActionBadge = (action: string) => {
        const act = action.toUpperCase();
        let bg = 'rgba(59, 130, 246, 0.15)';
        let color = '#3b82f6';

        if (act.includes('DELETE') || act.includes('REJECT') || act.includes('TERMINATE')) {
            bg = 'rgba(239, 68, 68, 0.15)';
            color = '#ef4444';
        } else if (act.includes('CREATE') || act.includes('APPROVE') || act.includes('CHECK_IN')) {
            bg = 'rgba(16, 185, 129, 0.15)';
            color = '#10b981';
        } else if (act.includes('UPDATE') || act.includes('ADJUST') || act.includes('STATUS')) {
            bg = 'rgba(245, 158, 11, 0.15)';
            color = '#f59e0b';
        }

        return (
            <span style={{ padding: '4px 10px', borderRadius: '6px', background: bg, color, fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.3px' }}>
                {action}
            </span>
        );
    };

    const getRoleBadge = (role?: string) => {
        switch (role) {
            case 'ADMIN':
                return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(168, 85, 247, 0.15)', color: '#a855f7', fontSize: '0.7rem', fontWeight: 600 }}>ADMIN</span>;
            case 'MANAGER':
                return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.7rem', fontWeight: 600 }}>MGR</span>;
            case 'TEAM_LEAD':
                return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontSize: '0.7rem', fontWeight: 600 }}>LEAD</span>;
            default:
                return <span style={{ padding: '2px 6px', borderRadius: '4px', background: 'rgba(100, 116, 139, 0.15)', color: '#64748b', fontSize: '0.7rem', fontWeight: 600 }}>EMP</span>;
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Security & Audit Trail
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Immutable ledger of security-sensitive operations, state mutations, and administrative overrides.
                    </p>
                </div>

                <button
                    onClick={() => { setPage(1); loadData(); }}
                    style={{
                        padding: '9px 16px',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span>🔄</span> Refresh Log
                </button>
            </div>

            {error && (
                <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', marginBottom: '20px', fontSize: '0.9rem' }}>
                    ⚠ {error}
                </div>
            )}

            {/* KPI Cards */}
            {summary && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Monitored Events</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>{summary.totalEvents}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Across organizational scope</div>
                    </div>

                    <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Events (Last 24 Hours)</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3b82f6', marginTop: '6px' }}>{summary.last24hEvents}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Recent activities</div>
                    </div>

                    <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Events (Last 7 Days)</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', marginTop: '6px' }}>{summary.last7dEvents}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Weekly activity volume</div>
                    </div>

                    <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>High-Impact Actions</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: summary.criticalActions > 0 ? '#ef4444' : 'var(--text-secondary)', marginTop: '6px' }}>
                            {summary.criticalActions}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Deletions, overrides & rejections</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div style={{ background: 'var(--card-bg)', padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div>
                        <select
                            value={entityFilter}
                            onChange={(e) => { setEntityFilter(e.target.value); setPage(1); }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem'
                            }}
                        >
                            <option value="">All Entities</option>
                            <option value="Task">Task</option>
                            <option value="User">User</option>
                            <option value="Attendance">Attendance</option>
                            <option value="LeaveRequest">Leave Request</option>
                            <option value="Payroll">Payroll</option>
                            <option value="Document">Document</option>
                            <option value="Organization">Organization</option>
                            <option value="Department">Department</option>
                        </select>
                    </div>

                    <div>
                        <select
                            value={actionFilter}
                            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
                            style={{
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem'
                            }}
                        >
                            <option value="">All Actions</option>
                            <option value="CREATE">CREATE</option>
                            <option value="UPDATE">UPDATE</option>
                            <option value="DELETE">DELETE</option>
                            <option value="APPROVE">APPROVE</option>
                            <option value="REJECT">REJECT</option>
                            <option value="UPLOAD_DOCUMENT">UPLOAD_DOCUMENT</option>
                            <option value="DELETE_DOCUMENT">DELETE_DOCUMENT</option>
                            <option value="UPDATE_ORG_SETTINGS">UPDATE_ORG_SETTINGS</option>
                        </select>
                    </div>
                </div>

                <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '6px' }}>
                    <input
                        type="text"
                        placeholder="Search action or entity..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '8px 12px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color)',
                            background: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            fontSize: '0.85rem',
                            minWidth: '220px'
                        }}
                    />
                    <button
                        type="submit"
                        style={{
                            padding: '8px 14px',
                            borderRadius: '6px',
                            border: 'none',
                            background: 'var(--accent-color)',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '0.85rem'
                        }}
                    >
                        Search
                    </button>
                </form>
            </div>

            {/* Audit Log Table */}
            <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', boxShadow: 'var(--card-shadow)' }}>
                {isLoading ? (
                    <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Loading audit records...</p>
                    </div>
                ) : logs.length === 0 ? (
                    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <span style={{ fontSize: '2.5rem' }}>📋</span>
                        <h3 style={{ margin: '16px 0 6px 0', color: 'var(--text-primary)' }}>No Audit Logs Found</h3>
                        <p style={{ fontSize: '0.85rem' }}>No system operations matching the selected filter criteria were recorded.</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-secondary)' }}>
                                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Timestamp</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Actor</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Action</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Entity</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600 }}>Target ID</th>
                                    <th style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'right' }}>Details</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.map((log) => (
                                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s ease' }}>
                                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                            <div style={{ color: 'var(--text-primary)', fontWeight: 500 }}>
                                                {new Date(log.createdAt).toLocaleDateString()}
                                            </div>
                                            <div style={{ fontSize: '0.75rem' }}>
                                                {new Date(log.createdAt).toLocaleTimeString()}
                                            </div>
                                        </td>

                                        <td style={{ padding: '14px 16px' }}>
                                            {log.user ? (
                                                <div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{log.user.name}</span>
                                                        {getRoleBadge(log.user.role)}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{log.user.email}</div>
                                                </div>
                                            ) : (
                                                <span style={{ color: 'var(--text-secondary)', fontStyle: 'italic' }}>System Engine</span>
                                            )}
                                        </td>

                                        <td style={{ padding: '14px 16px' }}>
                                            {getActionBadge(log.action)}
                                        </td>

                                        <td style={{ padding: '14px 16px' }}>
                                            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                                {log.entity}
                                            </span>
                                        </td>

                                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                            {log.entityId ? (
                                                <span title={log.entityId}>
                                                    {log.entityId.length > 14 ? `${log.entityId.substring(0, 14)}...` : log.entityId}
                                                </span>
                                            ) : '-'}
                                        </td>

                                        <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                                            {log.metadata ? (
                                                <button
                                                    onClick={() => setSelectedLog(log)}
                                                    style={{
                                                        padding: '5px 10px',
                                                        borderRadius: '6px',
                                                        border: '1px solid var(--border-color)',
                                                        background: 'var(--bg-secondary)',
                                                        color: 'var(--text-primary)',
                                                        cursor: 'pointer',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    Inspect Payload
                                                </button>
                                            ) : (
                                                <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>None</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                <div style={{ padding: '14px 20px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Showing {logs.length} of {totalCount} total audit records
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            disabled={page <= 1}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--card-bg)',
                                color: 'var(--text-primary)',
                                cursor: page <= 1 ? 'not-allowed' : 'pointer',
                                opacity: page <= 1 ? 0.5 : 1,
                                fontSize: '0.8rem'
                            }}
                        >
                            Previous
                        </button>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', padding: '0 4px' }}>
                            Page {page} of {totalPages}
                        </span>
                        <button
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            disabled={page >= totalPages}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '6px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--card-bg)',
                                color: 'var(--text-primary)',
                                cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                                opacity: page >= totalPages ? 0.5 : 1,
                                fontSize: '0.8rem'
                            }}
                        >
                            Next
                        </button>
                    </div>
                </div>
            </div>

            {/* Inspect Payload Modal */}
            {selectedLog && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.65)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px'
                }}>
                    <div style={{
                        background: 'var(--card-bg)',
                        borderRadius: '16px',
                        maxWidth: '640px',
                        width: '100%',
                        padding: '24px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <div>
                                <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                                    Audit Event Payload
                                </h3>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                    {selectedLog.action} on {selectedLog.entity} ({selectedLog.entityId})
                                </div>
                            </div>
                            <button
                                onClick={() => setSelectedLog(null)}
                                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', maxHeight: '360px', overflowY: 'auto' }}>
                            <pre style={{ margin: 0, fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {JSON.stringify(selectedLog.metadata, null, 2)}
                            </pre>
                        </div>

                        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setSelectedLog(null)}
                                style={{
                                    padding: '8px 18px',
                                    borderRadius: '8px',
                                    border: 'none',
                                    background: 'var(--accent-color)',
                                    color: '#fff',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
