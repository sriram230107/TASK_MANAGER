import React, { useState, useEffect } from 'react';
import {
    reportService,
    type ReportType,
    type ReportResponseData,
    type OverviewReportData,
    type TaskReportData,
    type AttendanceReportData,
    type PerformanceReportData,
    type WorkloadReportData
} from '../services/report.service';

export const ReportManagement: React.FC = () => {
    const [activeType, setActiveType] = useState<ReportType>('overview');
    const [dateRangePreset, setDateRangePreset] = useState<'7d' | '30d' | '90d' | 'ytd'>('30d');
    const [reportData, setReportData] = useState<ReportResponseData | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Compute date ranges based on preset
    const getDateRange = (preset: '7d' | '30d' | '90d' | 'ytd') => {
        const now = new Date();
        const end = now.toISOString().split('T')[0];
        let start: string;

        if (preset === '7d') {
            start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (preset === '90d') {
            start = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        } else if (preset === 'ytd') {
            start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        } else {
            // 30d default
            start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        }

        return { start, end };
    };

    const loadReport = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { start, end } = getDateRange(dateRangePreset);
            const data = await reportService.getReport({
                type: activeType,
                startDate: start,
                endDate: end
            });
            setReportData(data);
        } catch (err: any) {
            console.error('Failed to load report:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load report analytics');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadReport();
    }, [activeType, dateRangePreset]);

    const handleExportCsv = async () => {
        setIsExporting(true);
        try {
            const { start, end } = getDateRange(dateRangePreset);
            await reportService.downloadCsvReport({
                type: activeType,
                startDate: start,
                endDate: end
            });
        } catch (err: any) {
            console.error('Failed to export CSV:', err);
            alert('Failed to export CSV: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportPdf = async () => {
        setIsExporting(true);
        try {
            const { start, end } = getDateRange(dateRangePreset);
            await reportService.downloadPdfReport({
                type: activeType,
                startDate: start,
                endDate: end
            });
        } catch (err: any) {
            console.error('Failed to export PDF:', err);
            alert('Failed to export PDF: ' + (err.response?.data?.message || err.message));
        } finally {
            setIsExporting(false);
        }
    };

    const renderStars = (rating: number) => {
        return '★'.repeat(Math.min(5, Math.max(0, Math.round(rating)))) + '☆'.repeat(Math.max(0, 5 - Math.round(rating)));
    };

    return (
        <div style={{ padding: '1rem 0', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header with Title and Global Actions */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1.5rem',
                background: 'var(--bg-secondary)',
                padding: '1.25rem 1.5rem',
                borderRadius: '12px',
                border: '1px solid var(--border-color)'
            }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                            Reports & Workforce Analytics
                        </h1>
                        {reportData && (
                            <span style={{
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: 'var(--accent-color)',
                                fontWeight: 600
                            }}>
                                📍 {reportData.scopeLabel}
                            </span>
                        )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Live organizational intelligence derived from actual task, attendance, performance, and capacity data.
                    </p>
                </div>

                {/* Filters & Export */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    {/* Date Presets */}
                    <div style={{ display: 'flex', background: 'var(--bg-primary)', padding: '0.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                        {(['7d', '30d', '90d', 'ytd'] as const).map((preset) => (
                            <button
                                key={preset}
                                onClick={() => setDateRangePreset(preset)}
                                style={{
                                    border: 'none',
                                    background: dateRangePreset === preset ? 'var(--accent-color)' : 'transparent',
                                    color: dateRangePreset === preset ? '#fff' : 'var(--text-secondary)',
                                    fontSize: '0.75rem',
                                    padding: '0.35rem 0.65rem',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    transition: 'all 0.15s ease'
                                }}
                            >
                                {preset === '7d' ? '7 Days' : preset === '30d' ? '30 Days' : preset === '90d' ? '90 Days' : 'YTD'}
                            </button>
                        ))}
                    </div>

                    {/* Export Buttons */}
                    <button
                        onClick={handleExportCsv}
                        disabled={isExporting || isLoading}
                        className="btn btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.85rem',
                            fontSize: '0.8125rem'
                        }}
                    >
                        <span>📥</span>
                        <span>{isExporting ? 'Exporting...' : 'Export CSV'}</span>
                    </button>

                    <button
                        onClick={handleExportPdf}
                        disabled={isExporting || isLoading}
                        className="btn btn-secondary"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem 0.85rem',
                            fontSize: '0.8125rem'
                        }}
                    >
                        <span>📄</span>
                        <span>{isExporting ? 'Exporting...' : 'Export PDF'}</span>
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div style={{
                display: 'flex',
                gap: '0.5rem',
                borderBottom: '1px solid var(--border-color)',
                marginBottom: '1.5rem',
                overflowX: 'auto',
                paddingBottom: '0.25rem'
            }}>
                {[
                    { id: 'overview', label: 'Executive Overview', icon: '📊' },
                    { id: 'tasks', label: 'Task Analytics', icon: '✓' },
                    { id: 'attendance', label: 'Attendance & Hours', icon: '⏱' },
                    { id: 'performance', label: 'Performance & Reviews', icon: '🎯' },
                    { id: 'workload', label: 'Workload & Capacity', icon: '⚖️' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveType(tab.id as ReportType)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.65rem 1.15rem',
                            background: activeType === tab.id ? 'var(--bg-secondary)' : 'transparent',
                            color: activeType === tab.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                            border: 'none',
                            borderBottom: activeType === tab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
                            borderRadius: '8px 8px 0 0',
                            fontWeight: 600,
                            fontSize: '0.875rem',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease'
                        }}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* Error Message */}
            {error && (
                <div style={{
                    padding: '1rem',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: '#ef4444',
                    marginBottom: '1.5rem',
                    fontSize: '0.875rem'
                }}>
                    ⚠️ {error}
                </div>
            )}

            {/* Loading Spinner */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'spin 1.5s linear infinite' }}>⏳</div>
                    <div>Calculating real analytics from database records...</div>
                </div>
            ) : !reportData ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    No report data available for this range.
                </div>
            ) : (
                <>
                    {/* TAB 1: EXECUTIVE OVERVIEW */}
                    {activeType === 'overview' && (() => {
                        const data = reportData as OverviewReportData;
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                                    gap: '1.25rem'
                                }}>
                                    {/* Task KPI Card */}
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '1.25rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>✓ Task Velocity</span>
                                            <span style={{ fontSize: '1.25rem' }}>🚀</span>
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                            {data.tasks.completionRate}%
                                            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                                                completion rate
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem' }}>
                                            <div style={{ color: 'var(--text-secondary)' }}>Total Tasks: <strong style={{ color: 'var(--text-primary)' }}>{data.tasks.totalTasks}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Completed: <strong style={{ color: '#10b981' }}>{data.tasks.completedCount}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>In Progress: <strong style={{ color: '#3b82f6' }}>{data.tasks.inProgressCount}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Overdue: <strong style={{ color: '#ef4444' }}>{data.tasks.overdueCount}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>On-Time Rate: <strong style={{ color: 'var(--accent-color)' }}>{data.tasks.onTimeRate}%</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Logged Hours: <strong style={{ color: 'var(--text-primary)' }}>{data.tasks.totalActualHours}h</strong></div>
                                        </div>
                                    </div>

                                    {/* Attendance KPI Card */}
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '1.25rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>⏱ Attendance Health</span>
                                            <span style={{ fontSize: '1.25rem' }}>📅</span>
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginBottom: '0.5rem' }}>
                                            {data.attendance.attendanceConsistencyRate}%
                                            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                                                consistency
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem' }}>
                                            <div style={{ color: 'var(--text-secondary)' }}>Total Records: <strong style={{ color: 'var(--text-primary)' }}>{data.attendance.totalRecords}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Present / WFH: <strong style={{ color: '#10b981' }}>{data.attendance.presentDays + data.attendance.wfhDays}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Late Arrivals: <strong style={{ color: '#f59e0b' }}>{data.attendance.lateArrivals}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Absences: <strong style={{ color: '#ef4444' }}>{data.attendance.absentDays}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Regular Hours: <strong style={{ color: 'var(--text-primary)' }}>{data.attendance.totalWorkingHours}h</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Overtime: <strong style={{ color: '#8b5cf6' }}>{data.attendance.totalOvertimeHours}h</strong></div>
                                        </div>
                                    </div>

                                    {/* Performance KPI Card */}
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '1.25rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>🎯 Performance & Reviews</span>
                                            <span style={{ fontSize: '1.25rem' }}>⭐</span>
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b', marginBottom: '0.5rem' }}>
                                            {data.performance.averageRating}
                                            <span style={{ fontSize: '1.25rem', color: '#f59e0b', marginLeft: '0.25rem' }}>★</span>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                                                avg rating
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem' }}>
                                            <div style={{ color: 'var(--text-secondary)' }}>Total Reviews: <strong style={{ color: 'var(--text-primary)' }}>{data.performance.totalReviews}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Goals Achieved: <strong style={{ color: '#10b981' }}>{data.performance.achievedGoals}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>In Progress Goals: <strong style={{ color: '#3b82f6' }}>{data.performance.inProgressGoals}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Goal Success: <strong style={{ color: 'var(--accent-color)' }}>{data.performance.goalsAchievedRate}%</strong></div>
                                        </div>
                                    </div>

                                    {/* Workload Capacity KPI Card */}
                                    <div style={{
                                        background: 'var(--bg-secondary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px',
                                        padding: '1.25rem'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>⚖️ Workforce Utilization</span>
                                            <span style={{ fontSize: '1.25rem' }}>👥</span>
                                        </div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
                                            {data.workload.totalActiveTasks}
                                            <span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: '0.5rem' }}>
                                                active tasks across {data.workload.totalEmployees} employees
                                            </span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.8125rem' }}>
                                            <div style={{ color: 'var(--text-secondary)' }}>Optimal Capacity: <strong style={{ color: '#10b981' }}>{data.workload.balancedCount}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Overloaded: <strong style={{ color: '#ef4444' }}>{data.workload.overloadedCount}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Underutilized: <strong style={{ color: '#3b82f6' }}>{data.workload.underutilizedCount}</strong></div>
                                            <div style={{ color: 'var(--text-secondary)' }}>Avg Tasks/Emp: <strong style={{ color: 'var(--text-primary)' }}>{data.workload.avgTasksPerEmployee}</strong></div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* TAB 2: TASK ANALYTICS */}
                    {activeType === 'tasks' && (() => {
                        const data = reportData as TaskReportData;
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Task Summary Bar */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '1rem',
                                    background: 'var(--bg-secondary)',
                                    padding: '1.25rem',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Tasks</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.summary.totalTasks}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Completed</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{data.summary.completedCount}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Completion Rate</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-color)' }}>{data.summary.completionRate}%</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>On-Time Rate</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{data.summary.onTimeRate}%</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overdue</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{data.summary.overdueCount}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Est / Actual Hours</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 700 }}>{data.summary.totalEstimatedHours}h / {data.summary.totalActualHours}h</div>
                                    </div>
                                </div>

                                {/* Status Breakdown */}
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    padding: '1.25rem',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Task Distribution by Lifecycle Status</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                                        {Object.entries(data.statusBreakdown).map(([status, count]) => (
                                            <div key={status} style={{
                                                background: 'var(--bg-primary)',
                                                padding: '0.75rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                                                    {status.replace(/_/g, ' ').toLowerCase()}
                                                </div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{count}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Raw Tasks Table */}
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
                                        Recent Tasks in Selected Scope ({data.rawData.length} records)
                                    </div>
                                    <div style={{ overflowX: 'auto', maxHeight: '420px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Task Title</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Assignee</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Priority</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Status</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Est / Act Hours</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Due Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.rawData.map((t) => (
                                                    <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{t.title}</td>
                                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{t.assignee}</td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            <span style={{
                                                                fontSize: '0.6875rem',
                                                                padding: '0.15rem 0.5rem',
                                                                borderRadius: '4px',
                                                                fontWeight: 700,
                                                                background: t.priority === 'URGENT' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                                                                color: t.priority === 'URGENT' ? '#ef4444' : '#3b82f6'
                                                            }}>
                                                                {t.priority}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            <span style={{
                                                                fontSize: '0.6875rem',
                                                                padding: '0.15rem 0.5rem',
                                                                borderRadius: '4px',
                                                                fontWeight: 600,
                                                                background: t.status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(100, 116, 139, 0.15)',
                                                                color: t.status === 'COMPLETED' ? '#10b981' : 'var(--text-secondary)'
                                                            }}>
                                                                {t.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>{t.estimatedHours}h / {t.actualHours}h</td>
                                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{t.dueDate}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* TAB 3: ATTENDANCE ANALYTICS */}
                    {activeType === 'attendance' && (() => {
                        const data = reportData as AttendanceReportData;
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Attendance Metric Cards */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                    gap: '1rem',
                                    background: 'var(--bg-secondary)',
                                    padding: '1.25rem',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Logged Days</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{data.summary.totalRecords}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Attendance Consistency</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{data.summary.attendanceConsistencyRate}%</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Regular Hours</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-color)' }}>{data.summary.totalWorkingHours}h</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overtime Hours</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#8b5cf6' }}>{data.summary.totalOvertimeHours}h</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Late Arrivals</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{data.summary.lateArrivals}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Absences</div>
                                        <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#ef4444' }}>{data.summary.absentDays}</div>
                                    </div>
                                </div>

                                {/* Employee Breakdown Table */}
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
                                        Employee Attendance Summary ({data.employeeBreakdown.length} employees)
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Employee Name</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Attendance Rate</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Regular Working Hours</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Overtime Hours</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.employeeBreakdown.map((emp, idx) => (
                                                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{emp.name}</td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            <span style={{
                                                                fontWeight: 700,
                                                                color: emp.attendanceRate >= 90 ? '#10b981' : emp.attendanceRate >= 75 ? '#f59e0b' : '#ef4444'
                                                            }}>
                                                                {emp.attendanceRate}%
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>{emp.workingHours} hrs</td>
                                                        <td style={{ padding: '0.75rem 1rem', color: '#8b5cf6' }}>{emp.overtimeHours} hrs</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* TAB 4: PERFORMANCE ANALYTICS */}
                    {activeType === 'performance' && (() => {
                        const data = reportData as PerformanceReportData;
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: '1.25rem'
                                }}>
                                    <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Average Review Rating</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#f59e0b', marginTop: '0.25rem' }}>
                                            {data.summary.averageRating} <span style={{ fontSize: '1.25rem' }}>★</span>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                            Across {data.summary.totalReviews} evaluations
                                        </div>
                                    </div>
                                    <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Goals Achieved Rate</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                                            {data.summary.goalsAchievedRate}%
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                            {data.summary.achievedGoals} of {data.summary.totalGoals} goals complete
                                        </div>
                                    </div>
                                </div>

                                {/* Rating Distribution */}
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    padding: '1.25rem',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>Review Rating Distribution</h3>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '0.75rem' }}>
                                        {Object.entries(data.ratingDistribution).map(([star, count]) => (
                                            <div key={star} style={{
                                                background: 'var(--bg-primary)',
                                                padding: '0.75rem',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                textAlign: 'center'
                                            }}>
                                                <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>
                                                    {star.replace(/_/g, ' ')}
                                                </div>
                                                <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '0.25rem' }}>{count}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Raw Reviews Table */}
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
                                        Evaluations in Scope ({data.rawData.length} records)
                                    </div>
                                    <div style={{ overflowX: 'auto', maxHeight: '400px' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Date</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Employee</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Reviewer</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Rating</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Completion %</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>On-Time %</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Attendance %</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.rawData.map((r) => (
                                                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{r.date}</td>
                                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{r.employee}</td>
                                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{r.reviewer}</td>
                                                        <td style={{ padding: '0.75rem 1rem', color: '#f59e0b', fontWeight: 700 }}>
                                                            {r.rating} {renderStars(r.rating)}
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>{r.taskCompletionRate}%</td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>{r.onTimeRate}%</td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>{r.attendanceConsistency}%</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* TAB 5: WORKLOAD CAPACITY */}
                    {activeType === 'workload' && (() => {
                        const data = reportData as WorkloadReportData;
                        return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                                {/* Workload Capacity Stat Banners */}
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: '1.25rem'
                                }}>
                                    <div style={{
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        border: '1px solid rgba(16, 185, 129, 0.3)',
                                        padding: '1.25rem',
                                        borderRadius: '12px'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>Optimal Capacity</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#10b981', marginTop: '0.25rem' }}>
                                            {data.summary.balancedCount}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                            Healthy task allocation (1 - 5 active tasks)
                                        </div>
                                    </div>

                                    <div style={{
                                        background: 'rgba(239, 68, 68, 0.1)',
                                        border: '1px solid rgba(239, 68, 68, 0.3)',
                                        padding: '1.25rem',
                                        borderRadius: '12px'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>Overloaded Members</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#ef4444', marginTop: '0.25rem' }}>
                                            {data.summary.overloadedCount}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                            Risk of burnout (≥6 tasks or ≥40h pending)
                                        </div>
                                    </div>

                                    <div style={{
                                        background: 'rgba(59, 130, 246, 0.1)',
                                        border: '1px solid rgba(59, 130, 246, 0.3)',
                                        padding: '1.25rem',
                                        borderRadius: '12px'
                                    }}>
                                        <div style={{ fontSize: '0.75rem', color: '#3b82f6', fontWeight: 600 }}>Underutilized Capacity</div>
                                        <div style={{ fontSize: '2rem', fontWeight: 800, color: '#3b82f6', marginTop: '0.25rem' }}>
                                            {data.summary.underutilizedCount}
                                        </div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                            Available bandwidth for assignment (≤1 task)
                                        </div>
                                    </div>
                                </div>

                                {/* Workload Capacity Table */}
                                <div style={{
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    overflow: 'hidden'
                                }}>
                                    <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', fontWeight: 700 }}>
                                        Workforce Allocation Matrix ({data.workloadList.length} members)
                                    </div>
                                    <div style={{ overflowX: 'auto' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                                            <thead>
                                                <tr style={{ background: 'var(--bg-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Employee Name</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Department</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Role</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Active Tasks</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Urgent / High</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Est / Actual Hours</th>
                                                    <th style={{ padding: '0.75rem 1rem' }}>Capacity Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.workloadList.map((w) => (
                                                    <tr key={w.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{w.name}</td>
                                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{w.department}</td>
                                                        <td style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)' }}>{w.role}</td>
                                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 700 }}>{w.activeTasks}</td>
                                                        <td style={{ padding: '0.75rem 1rem', color: w.urgentTasks > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                                                            {w.urgentTasks}
                                                        </td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>{w.estimatedHours}h / {w.actualHours}h</td>
                                                        <td style={{ padding: '0.75rem 1rem' }}>
                                                            <span style={{
                                                                fontSize: '0.6875rem',
                                                                padding: '0.2rem 0.6rem',
                                                                borderRadius: '9999px',
                                                                fontWeight: 700,
                                                                background:
                                                                    w.status === 'OVERLOADED'
                                                                        ? 'rgba(239, 68, 68, 0.15)'
                                                                        : w.status === 'UNDERUTILIZED'
                                                                        ? 'rgba(59, 130, 246, 0.15)'
                                                                        : 'rgba(16, 185, 129, 0.15)',
                                                                color:
                                                                    w.status === 'OVERLOADED'
                                                                        ? '#ef4444'
                                                                        : w.status === 'UNDERUTILIZED'
                                                                        ? '#3b82f6'
                                                                        : '#10b981'
                                                            }}>
                                                                {w.status}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </>
            )}
        </div>
    );
};
