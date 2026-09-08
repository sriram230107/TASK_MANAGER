import React, { useState, useEffect } from 'react';
import {
    attendanceService,
    type AttendanceRecord,
    type AttendanceState,
    type AttendanceMetrics,
    type UpdateAttendanceDTO
} from '../services/attendance.service';
import { useAuth } from '../context/AuthContext';

export const AttendanceManagement: React.FC = () => {
    const { user } = useAuth();

    // Today's active status
    const [todayState, setTodayState] = useState<AttendanceState>('NOT_CHECKED_IN');
    const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
    const [currentTime, setCurrentTime] = useState<string>(new Date().toLocaleTimeString());

    // Action inputs
    const [isWfh, setIsWfh] = useState(false);
    const [notes, setNotes] = useState('');
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionSuccess, setActionSuccess] = useState<string | null>(null);

    // Summary metrics
    const [metrics, setMetrics] = useState<AttendanceMetrics | null>(null);

    // History log
    const [history, setHistory] = useState<AttendanceRecord[]>([]);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);

    // Edit Modal (Admin/Manager)
    const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
    const [editForm, setEditForm] = useState<UpdateAttendanceDTO>({});
    const [isSavingEdit, setIsSavingEdit] = useState(false);

    const isSupervisor = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'TEAM_LEAD';

    // Live clock
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date().toLocaleTimeString());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const loadTodayData = async () => {
        try {
            const data = await attendanceService.getTodayAttendance();
            setTodayRecord(data.attendance);
            setTodayState(data.state);
            if (data.attendance) {
                setIsWfh(data.attendance.isWorkFromHome);
            }
        } catch (err: any) {
            console.error('Failed to load today attendance:', err);
        }
    };

    const loadSummaryData = async () => {
        try {
            const data = await attendanceService.getSummary(undefined, 30);
            setMetrics(data.metrics);
        } catch (err: any) {
            console.error('Failed to load attendance summary:', err);
        }
    };

    const loadHistoryData = async () => {
        setIsLoadingHistory(true);
        try {
            const params: any = { limit: 30 };
            if (statusFilter !== 'ALL') {
                params.status = statusFilter;
            }
            const data = await attendanceService.listAttendance(params);
            setHistory(data.records);
        } catch (err: any) {
            console.error('Failed to load history:', err);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        loadTodayData();
        loadSummaryData();
        loadHistoryData();
    }, [statusFilter]);

    // Handle Check-In
    const handleCheckIn = async () => {
        setIsActionLoading(true);
        setActionError(null);
        setActionSuccess(null);
        try {
            const record = await attendanceService.checkIn({
                isWorkFromHome: isWfh,
                notes: notes.trim() || undefined
            });
            setTodayRecord(record);
            setTodayState('WORKING');
            setNotes('');
            setActionSuccess('Checked in successfully. Have a productive shift!');
            await loadSummaryData();
            await loadHistoryData();
        } catch (err: any) {
            console.error('Check-in error:', err);
            setActionError(err.response?.data?.error?.message || err.message || 'Failed to check in');
        } finally {
            setIsActionLoading(false);
        }
    };

    // Handle Start Break
    const handleStartBreak = async () => {
        setIsActionLoading(true);
        setActionError(null);
        setActionSuccess(null);
        try {
            await attendanceService.startBreak(notes.trim() || undefined);
            setTodayState('ON_BREAK');
            setNotes('');
            setActionSuccess('Break started. Enjoy your rest!');
            await loadTodayData();
        } catch (err: any) {
            console.error('Start break error:', err);
            setActionError(err.response?.data?.error?.message || err.message || 'Failed to start break');
        } finally {
            setIsActionLoading(false);
        }
    };

    // Handle End Break
    const handleEndBreak = async () => {
        setIsActionLoading(true);
        setActionError(null);
        setActionSuccess(null);
        try {
            await attendanceService.endBreak();
            setTodayState('WORKING');
            setActionSuccess('Break ended. Welcome back!');
            await loadTodayData();
            await loadSummaryData();
        } catch (err: any) {
            console.error('End break error:', err);
            setActionError(err.response?.data?.error?.message || err.message || 'Failed to resume work');
        } finally {
            setIsActionLoading(false);
        }
    };

    // Handle Check-Out
    const handleCheckOut = async () => {
        setIsActionLoading(true);
        setActionError(null);
        setActionSuccess(null);
        try {
            const updated = await attendanceService.checkOut(notes.trim() || undefined);
            setTodayRecord(updated);
            setTodayState('CHECKED_OUT');
            setNotes('');
            setActionSuccess('Checked out successfully. Shift completed for today!');
            await loadSummaryData();
            await loadHistoryData();
        } catch (err: any) {
            console.error('Check-out error:', err);
            setActionError(err.response?.data?.error?.message || err.message || 'Failed to check out');
        } finally {
            setIsActionLoading(false);
        }
    };

    // Handle Edit Record
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingRecord) return;
        setIsSavingEdit(true);
        try {
            await attendanceService.updateRecord(editingRecord.id, editForm);
            setEditingRecord(null);
            await loadHistoryData();
            await loadSummaryData();
            if (todayRecord?.id === editingRecord.id) {
                await loadTodayData();
            }
        } catch (err: any) {
            console.error('Failed to update attendance:', err);
            alert(err.response?.data?.error?.message || err.message || 'Failed to update record');
        } finally {
            setIsSavingEdit(false);
        }
    };

    const formatMinutes = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h === 0) return `${m}m`;
        return `${h}h ${m}m`;
    };

    const getStatusBadgeColor = (status: string) => {
        switch (status) {
            case 'PRESENT': return '#22c55e';
            case 'WORK_FROM_HOME': return '#3b82f6';
            case 'LATE': return '#eab308';
            case 'HALF_DAY': return '#f97316';
            case 'LEAVE': return '#a855f7';
            case 'HOLIDAY': return '#06b6d4';
            case 'ABSENT': return '#ef4444';
            default: return '#64748b';
        }
    };

    return (
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '1.5rem 0' }}>
            {/* Header */}
            <div style={{ marginBottom: '1.5rem' }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>
                    Attendance & Work Hours
                </h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0.25rem 0 0 0' }}>
                    Real-time punch clock, break tracking, working sessions, and attendance metrics.
                </p>
            </div>

            {/* Alert Messages */}
            {actionError && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid var(--danger)',
                    borderRadius: '8px',
                    color: 'var(--danger)',
                    marginBottom: '1rem',
                    fontSize: '0.875rem'
                }}>
                    {actionError}
                </div>
            )}
            {actionSuccess && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: 'rgba(34, 197, 94, 0.15)',
                    border: '1px solid var(--success)',
                    borderRadius: '8px',
                    color: 'var(--success)',
                    marginBottom: '1rem',
                    fontSize: '0.875rem'
                }}>
                    {actionSuccess}
                </div>
            )}

            {/* Top Interactive Punch Clock Widget */}
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '1.75rem',
                marginBottom: '2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1.5rem'
            }}>
                {/* Clock & Status */}
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, margin: 0, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                            {currentTime}
                        </h1>
                        <span style={{
                            padding: '0.3rem 0.8rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            textTransform: 'uppercase',
                            background:
                                todayState === 'WORKING' ? 'rgba(34, 197, 94, 0.2)' :
                                todayState === 'ON_BREAK' ? 'rgba(234, 179, 8, 0.2)' :
                                todayState === 'CHECKED_OUT' ? 'rgba(99, 102, 241, 0.2)' :
                                'rgba(100, 116, 139, 0.2)',
                            color:
                                todayState === 'WORKING' ? 'var(--success)' :
                                todayState === 'ON_BREAK' ? 'var(--warning)' :
                                todayState === 'CHECKED_OUT' ? '#818cf8' :
                                'var(--text-secondary)',
                            border: `1px solid currentColor`
                        }}>
                            {todayState.replace('_', ' ')}
                        </span>
                    </div>

                    <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.875rem' }}>
                        {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>

                    {todayRecord?.checkIn && (
                        <div style={{ marginTop: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            <span>Checked In: <strong style={{ color: 'var(--text-primary)' }}>{new Date(todayRecord.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                            {todayRecord.checkOut && (
                                <span>Checked Out: <strong style={{ color: 'var(--text-primary)' }}>{new Date(todayRecord.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</strong></span>
                            )}
                            {todayRecord.totalWorkingMinutes > 0 && (
                                <span>Worked: <strong style={{ color: '#60a5fa' }}>{formatMinutes(todayRecord.totalWorkingMinutes)}</strong></span>
                            )}
                            {todayRecord.breakDurationMinutes > 0 && (
                                <span>Break: <strong style={{ color: 'var(--warning)' }}>{formatMinutes(todayRecord.breakDurationMinutes)}</strong></span>
                            )}
                            {todayRecord.isWorkFromHome && (
                                <span style={{ color: '#38bdf8' }}>🏠 Remote / WFH</span>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions Form */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minWidth: '320px' }}>
                    {todayState === 'NOT_CHECKED_IN' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={isWfh}
                                    onChange={(e) => setIsWfh(e.target.checked)}
                                />
                                Work from Home (WFH)
                            </label>

                            <input
                                type="text"
                                placeholder="Optional check-in note..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem'
                                }}
                            />

                            <button
                                onClick={handleCheckIn}
                                disabled={isActionLoading}
                                className="btn"
                                style={{
                                    background: 'linear-gradient(135deg, #10b981, #059669)',
                                    padding: '0.75rem 1.5rem',
                                    fontSize: '1rem',
                                    fontWeight: 700
                                }}
                            >
                                {isActionLoading ? 'Checking In...' : '🟢 Check In Now'}
                            </button>
                        </div>
                    )}

                    {todayState === 'WORKING' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <input
                                type="text"
                                placeholder="Optional note for checkout or break..."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                style={{
                                    padding: '0.5rem 0.75rem',
                                    borderRadius: '6px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-primary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.875rem'
                                }}
                            />

                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                    onClick={handleStartBreak}
                                    disabled={isActionLoading}
                                    className="btn btn-secondary"
                                    style={{ flex: 1, fontWeight: 600, color: 'var(--warning)', borderColor: 'var(--warning)' }}
                                >
                                    ☕ Take a Break
                                </button>
                                <button
                                    onClick={handleCheckOut}
                                    disabled={isActionLoading}
                                    className="btn"
                                    style={{ flex: 1, background: 'var(--danger)', fontWeight: 600 }}
                                >
                                    🔴 Check Out
                                </button>
                            </div>
                        </div>
                    )}

                    {todayState === 'ON_BREAK' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div style={{ fontSize: '0.875rem', color: 'var(--warning)', fontWeight: 500 }}>
                                ☕ Currently on break. Click below when ready to resume working.
                            </div>
                            <button
                                onClick={handleEndBreak}
                                disabled={isActionLoading}
                                className="btn"
                                style={{ background: 'var(--accent-color)', fontWeight: 700 }}
                            >
                                ▶ Resume Working
                            </button>
                        </div>
                    )}

                    {todayState === 'CHECKED_OUT' && (
                        <div style={{
                            padding: '0.75rem 1rem',
                            background: 'rgba(99, 102, 241, 0.1)',
                            borderRadius: '8px',
                            border: '1px solid rgba(99, 102, 241, 0.3)',
                            fontSize: '0.875rem'
                        }}>
                            <span style={{ color: '#818cf8', fontWeight: 600 }}>Shift Completed</span>
                            <p style={{ margin: '0.25rem 0 0 0', color: 'var(--text-secondary)' }}>
                                You have checked out for today. See you tomorrow!
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* 30-Day Metrics Summary Cards */}
            {metrics && (
                <div style={{ marginBottom: '2rem' }}>
                    <h3 style={{ fontSize: '1rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', marginBottom: '1rem' }}>
                        30-Day Attendance Overview
                    </h3>
                    <div className="grid grid-cols-4" style={{ gap: '1rem' }}>
                        <div className="stat-card">
                            <h3>{metrics.presentDays} <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/ {metrics.totalDaysRecorded}d</span></h3>
                            <p>Days Present</p>
                        </div>
                        <div className="stat-card">
                            <h3 style={{ color: '#38bdf8' }}>{metrics.totalWorkingHours}h</h3>
                            <p>Total Working Hours</p>
                        </div>
                        <div className="stat-card">
                            <h3 style={{ color: metrics.lateDays > 0 ? 'var(--warning)' : 'var(--text-primary)' }}>{metrics.lateDays}</h3>
                            <p>Late Arrivals</p>
                        </div>
                        <div className="stat-card">
                            <h3 style={{ color: metrics.totalOvertimeHours > 0 ? 'var(--success)' : 'var(--text-primary)' }}>{metrics.totalOvertimeHours}h</h3>
                            <p>Overtime Hours</p>
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance History & Filter Table */}
            <div style={{
                background: 'var(--bg-secondary)',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                padding: '1.5rem'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '1.25rem',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Attendance History Log</h3>

                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {['ALL', 'PRESENT', 'LATE', 'HALF_DAY', 'WORK_FROM_HOME'].map((st) => (
                            <button
                                key={st}
                                onClick={() => setStatusFilter(st)}
                                style={{
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    border: statusFilter === st ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
                                    background: statusFilter === st ? 'rgba(59, 130, 246, 0.15)' : 'var(--bg-primary)',
                                    color: statusFilter === st ? '#60a5fa' : 'var(--text-secondary)'
                                }}
                            >
                                {st.replace('_', ' ')}
                            </button>
                        ))}
                    </div>
                </div>

                {isLoadingHistory ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        Loading attendance history...
                    </div>
                ) : history.length === 0 ? (
                    <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No attendance records found.
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                                    <th style={{ padding: '0.75rem' }}>Date</th>
                                    {isSupervisor && <th style={{ padding: '0.75rem' }}>Employee</th>}
                                    <th style={{ padding: '0.75rem' }}>Check In</th>
                                    <th style={{ padding: '0.75rem' }}>Check Out</th>
                                    <th style={{ padding: '0.75rem' }}>Total Time</th>
                                    <th style={{ padding: '0.75rem' }}>Break</th>
                                    <th style={{ padding: '0.75rem' }}>Status</th>
                                    <th style={{ padding: '0.75rem' }}>Notes</th>
                                    {isSupervisor && <th style={{ padding: '0.75rem' }}>Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((record) => (
                                    <tr key={record.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '0.75rem', fontWeight: 500 }}>
                                            {new Date(record.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </td>
                                        {isSupervisor && (
                                            <td style={{ padding: '0.75rem' }}>
                                                {record.user?.name || 'User'}
                                            </td>
                                        )}
                                        <td style={{ padding: '0.75rem' }}>
                                            {record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            {record.lateArrival && (
                                                <span style={{ marginLeft: '0.4rem', color: 'var(--warning)', fontSize: '0.6875rem', fontWeight: 600 }}>
                                                    (Late)
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            {record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                            {record.earlyDeparture && record.checkOut && (
                                                <span style={{ marginLeft: '0.4rem', color: 'var(--danger)', fontSize: '0.6875rem', fontWeight: 600 }}>
                                                    (Early)
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem', fontWeight: 600, color: '#60a5fa' }}>
                                            {formatMinutes(record.totalWorkingMinutes)}
                                            {record.overtimeMinutes > 0 && (
                                                <span style={{ color: 'var(--success)', fontSize: '0.75rem', display: 'block' }}>
                                                    +{formatMinutes(record.overtimeMinutes)} OT
                                                </span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {formatMinutes(record.breakDurationMinutes)}
                                        </td>
                                        <td style={{ padding: '0.75rem' }}>
                                            <span style={{
                                                padding: '0.2rem 0.55rem',
                                                borderRadius: '9999px',
                                                fontSize: '0.6875rem',
                                                fontWeight: 700,
                                                background: getStatusBadgeColor(record.status),
                                                color: '#fff',
                                                textTransform: 'uppercase'
                                            }}>
                                                {record.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {record.notes || '-'}
                                        </td>
                                        {isSupervisor && (
                                            <td style={{ padding: '0.75rem' }}>
                                                <button
                                                    onClick={() => {
                                                        setEditingRecord(record);
                                                        setEditForm({
                                                            status: record.status,
                                                            isWorkFromHome: record.isWorkFromHome,
                                                            notes: record.notes || ''
                                                        });
                                                    }}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                                                >
                                                    Adjust
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Supervisor Edit Record Modal */}
            {editingRecord && (
                <div className="modal-overlay" onClick={() => setEditingRecord(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0 }}>Adjust Attendance Record</h3>
                            <button
                                onClick={() => setEditingRecord(null)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '1.5rem', cursor: 'pointer' }}
                            >
                                &times;
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit}>
                            <div className="form-group">
                                <label>Date</label>
                                <input
                                    type="text"
                                    disabled
                                    value={new Date(editingRecord.date).toLocaleDateString()}
                                />
                            </div>

                            <div className="form-group">
                                <label>Status</label>
                                <select
                                    value={editForm.status || editingRecord.status}
                                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                                >
                                    <option value="PRESENT">PRESENT</option>
                                    <option value="LATE">LATE</option>
                                    <option value="HALF_DAY">HALF_DAY</option>
                                    <option value="WORK_FROM_HOME">WORK_FROM_HOME</option>
                                    <option value="LEAVE">LEAVE</option>
                                    <option value="HOLIDAY">HOLIDAY</option>
                                    <option value="ABSENT">ABSENT</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Notes / Adjustment Reason</label>
                                <textarea
                                    rows={3}
                                    value={editForm.notes || ''}
                                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    onClick={() => setEditingRecord(null)}
                                    disabled={isSavingEdit}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="btn"
                                    disabled={isSavingEdit}
                                >
                                    {isSavingEdit ? 'Saving...' : 'Save Adjustments'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
