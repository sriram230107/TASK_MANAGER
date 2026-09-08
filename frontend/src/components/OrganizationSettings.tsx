import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
    settingsService,
    type OrganizationSettings as OrgSettingsType,
    type HolidayItem
} from '../services/settings.service';

export const OrganizationSettings: React.FC = () => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<OrgSettingsType | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Active tab
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'HOLIDAYS' | 'LEAVE' | 'TASKS' | 'DEPARTMENTS'>('GENERAL');

    // Form states (for Admin editing)
    const [name, setName] = useState('');
    const [workingHoursPerDay, setWorkingHoursPerDay] = useState<number>(8);
    const [workDaysPerWeek, setWorkDaysPerWeek] = useState<number>(5);
    const [holidays, setHolidays] = useState<HolidayItem[]>([]);
    const [leavePolicies, setLeavePolicies] = useState({
        annualLeaveDays: 20,
        sickLeaveDays: 10,
        casualLeaveDays: 5,
        carryOverMaxDays: 5
    });
    const [taskPolicies, setTaskPolicies] = useState({
        requireReviewForCompletion: true,
        allowEmployeeSelfAssign: false,
        autoOverdueGracePeriodHours: 24
    });
    const [reviewPeriods, setReviewPeriods] = useState<{
        frequency: 'QUARTERLY' | 'BI_ANNUAL' | 'ANNUAL';
        nextReviewDate: string;
    }>({
        frequency: 'QUARTERLY',
        nextReviewDate: '2026-10-01'
    });

    // New holiday input modal/row
    const [newHoliday, setNewHoliday] = useState({ name: '', date: '', isRecurring: true });

    // Add Department modal
    const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
    const [deptForm, setDeptForm] = useState({ name: '', code: '' });
    const [isCreatingDept, setIsCreatingDept] = useState(false);

    const isAdmin = user?.role === 'ADMIN';

    const loadSettings = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await settingsService.getSettings();
            setSettings(data);
            setName(data.name);
            setWorkingHoursPerDay(data.workingHoursPerDay);
            setWorkDaysPerWeek(data.workDaysPerWeek);
            setHolidays(data.settings.holidays || []);
            setLeavePolicies(data.settings.leavePolicies);
            setTaskPolicies(data.settings.taskPolicies);
            setReviewPeriods(data.settings.reviewPeriods);
        } catch (err: any) {
            console.error('Failed to load organization settings:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load organization settings');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) return;

        setIsSaving(true);
        setError(null);
        setSuccessMessage(null);

        try {
            const updated = await settingsService.updateSettings({
                name,
                workingHoursPerDay,
                workDaysPerWeek,
                settings: {
                    holidays,
                    leavePolicies,
                    taskPolicies,
                    reviewPeriods
                }
            });

            setSettings(updated);
            setSuccessMessage('Organization settings & policies successfully saved!');
            setTimeout(() => setSuccessMessage(null), 4000);
        } catch (err: any) {
            console.error('Failed to update settings:', err);
            setError(err.response?.data?.message || err.message || 'Failed to update organization settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleAddHoliday = () => {
        if (!newHoliday.name || !newHoliday.date) {
            alert('Holiday name and date are required.');
            return;
        }
        setHolidays([...holidays, { ...newHoliday }]);
        setNewHoliday({ name: '', date: '', isRecurring: true });
    };

    const handleRemoveHoliday = (index: number) => {
        setHolidays(holidays.filter((_, i) => i !== index));
    };

    const handleCreateDept = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!deptForm.name) return;
        setIsCreatingDept(true);
        try {
            await settingsService.createDepartment({
                name: deptForm.name,
                code: deptForm.code || undefined
            });
            setIsDeptModalOpen(false);
            setDeptForm({ name: '', code: '' });
            setSuccessMessage('Department created successfully!');
            setTimeout(() => setSuccessMessage(null), 3000);
            await loadSettings();
        } catch (err: any) {
            console.error('Create department error:', err);
            alert(err.response?.data?.message || err.message || 'Failed to create department');
        } finally {
            setIsCreatingDept(false);
        }
    };

    if (isLoading) {
        return (
            <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                <div style={{ display: 'inline-block', width: '32px', height: '32px', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--accent-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <p style={{ marginTop: '12px', fontSize: '0.9rem' }}>Loading organization settings...</p>
            </div>
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
                        Organization Settings & Policies
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Configure enterprise parameters, working schedules, statutory holidays, and governance rules.
                    </p>
                </div>

                {isAdmin && (
                    <button
                        onClick={handleSaveSettings}
                        disabled={isSaving}
                        style={{
                            padding: '10px 24px',
                            background: 'var(--accent-color)',
                            color: '#fff',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 600,
                            cursor: isSaving ? 'not-allowed' : 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        <span>💾</span> {isSaving ? 'Saving Changes...' : 'Save All Settings'}
                    </button>
                )}
            </div>

            {/* Read-Only Notice for Non-Admins */}
            {!isAdmin && (
                <div style={{ padding: '14px 18px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.25)', borderRadius: '10px', color: '#3b82f6', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '1.2rem' }}>ℹ</span>
                    <span style={{ fontSize: '0.85rem' }}>
                        You are viewing organization policies and schedule configurations in <strong>read-only mode</strong>. System modifications are managed exclusively by Organization Administrators.
                    </span>
                </div>
            )}

            {/* Success & Error alerts */}
            {successMessage && (
                <div style={{ padding: '12px 16px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '8px', color: '#10b981', marginBottom: '20px', fontSize: '0.9rem' }}>
                    ✔ {successMessage}
                </div>
            )}
            {error && (
                <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '8px', color: '#ef4444', marginBottom: '20px', fontSize: '0.9rem' }}>
                    ⚠ {error}
                </div>
            )}

            {/* KPI Summary Cards */}
            {settings && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Departments</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '6px' }}>{settings.counts.departments}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Active divisions</div>
                    </div>

                    <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Operational Teams</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3b82f6', marginTop: '6px' }}>{settings.counts.teams}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Led working groups</div>
                    </div>

                    <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Total Workforce</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#10b981', marginTop: '6px' }}>{settings.counts.users}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Registered employees</div>
                    </div>

                    <div style={{ background: 'var(--card-bg)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--card-shadow)' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Working Schedule</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#8b5cf6', marginTop: '6px' }}>{workingHoursPerDay}h / {workDaysPerWeek}d</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Standard work week</div>
                    </div>
                </div>
            )}

            {/* Navigation Tabs */}
            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', overflowX: 'auto' }}>
                {[
                    { id: 'GENERAL', label: 'General & Schedule', icon: '🏢' },
                    { id: 'HOLIDAYS', label: 'Company Holidays', icon: '🗓' },
                    { id: 'LEAVE', label: 'Leave Quotas', icon: '🏖' },
                    { id: 'TASKS', label: 'Task & Review Rules', icon: '✓' },
                    { id: 'DEPARTMENTS', label: 'Departments & Teams', icon: '👥' }
                ].map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        style={{
                            padding: '12px 18px',
                            background: 'transparent',
                            border: 'none',
                            borderBottom: activeTab === tab.id ? '2px solid var(--accent-color)' : '2px solid transparent',
                            color: activeTab === tab.id ? 'var(--accent-color)' : 'var(--text-secondary)',
                            fontWeight: activeTab === tab.id ? 600 : 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '0.9rem',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <span>{tab.icon}</span> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab 1: General & Schedule */}
            {activeTab === 'GENERAL' && (
                <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', maxWidth: '800px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>General Enterprise Information</h3>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                            Organization Name
                        </label>
                        <input
                            type="text"
                            disabled={!isAdmin}
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-secondary)',
                                color: 'var(--text-primary)',
                                fontSize: '0.9rem'
                            }}
                        />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                Standard Working Hours / Day
                            </label>
                            <input
                                type="number"
                                step="0.5"
                                min="1"
                                max="24"
                                disabled={!isAdmin}
                                value={workingHoursPerDay}
                                onChange={(e) => setWorkingHoursPerDay(parseFloat(e.target.value) || 8)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Used for overtime & full-day attendance benchmarks</span>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                Working Days / Week
                            </label>
                            <input
                                type="number"
                                min="1"
                                max="7"
                                disabled={!isAdmin}
                                value={workDaysPerWeek}
                                onChange={(e) => setWorkDaysPerWeek(parseInt(e.target.value) || 5)}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Typical 5-day work week (Monday - Friday)</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 2: Holidays */}
            {activeTab === 'HOLIDAYS' && (
                <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', maxWidth: '800px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Official Company Holidays</h3>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{holidays.length} registered holidays</span>
                    </div>

                    {isAdmin && (
                        <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                            <div style={{ flex: '1 1 200px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Holiday Name</label>
                                <input
                                    type="text"
                                    placeholder="e.g. Labor Day"
                                    value={newHoliday.name}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <div style={{ flex: '0 0 160px' }}>
                                <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Date (YYYY-MM-DD)</label>
                                <input
                                    type="date"
                                    value={newHoliday.date}
                                    onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--card-bg)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.85rem'
                                    }}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleAddHoliday}
                                style={{
                                    padding: '8px 16px',
                                    borderRadius: '6px',
                                    border: 'none',
                                    background: 'var(--accent-color)',
                                    color: '#fff',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    fontSize: '0.85rem'
                                }}
                            >
                                + Add Holiday
                            </button>
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {holidays.map((h, index) => (
                            <div
                                key={index}
                                style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 16px',
                                    background: 'var(--bg-secondary)',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)'
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🎉</span>
                                    <div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{h.name}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {h.date} {h.isRecurring && '• Recurring Annual'}
                                        </div>
                                    </div>
                                </div>

                                {isAdmin && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveHoliday(index)}
                                        style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: '#ef4444',
                                            cursor: 'pointer',
                                            fontSize: '0.9rem',
                                            padding: '4px 8px'
                                        }}
                                        title="Remove holiday"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Tab 3: Leave Quotas */}
            {activeTab === 'LEAVE' && (
                <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', maxWidth: '800px' }}>
                    <h3 style={{ margin: '0 0 8px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Standard Leave Allowances</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
                        Annual baseline leave allocations seeded for employees during each fiscal calendar year.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                Annual Paid Leave (Days)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={!isAdmin}
                                value={leavePolicies.annualLeaveDays}
                                onChange={(e) => setLeavePolicies({ ...leavePolicies, annualLeaveDays: parseInt(e.target.value) || 0 })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                Sick Leave (Days)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={!isAdmin}
                                value={leavePolicies.sickLeaveDays}
                                onChange={(e) => setLeavePolicies({ ...leavePolicies, sickLeaveDays: parseInt(e.target.value) || 0 })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                Casual / Discretionary Leave (Days)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                disabled={!isAdmin}
                                value={leavePolicies.casualLeaveDays}
                                onChange={(e) => setLeavePolicies({ ...leavePolicies, casualLeaveDays: parseInt(e.target.value) || 0 })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                Max Carry-Over to Next Year (Days)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="50"
                                disabled={!isAdmin}
                                value={leavePolicies.carryOverMaxDays}
                                onChange={(e) => setLeavePolicies({ ...leavePolicies, carryOverMaxDays: parseInt(e.target.value) || 0 })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 4: Tasks & Reviews */}
            {activeTab === 'TASKS' && (
                <div style={{ background: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', padding: '24px', maxWidth: '800px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--text-primary)' }}>Task Governance & Review Cycles</h3>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isAdmin ? 'pointer' : 'default' }}>
                            <input
                                type="checkbox"
                                disabled={!isAdmin}
                                checked={taskPolicies.requireReviewForCompletion}
                                onChange={(e) => setTaskPolicies({ ...taskPolicies, requireReviewForCompletion: e.target.checked })}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-color)' }}
                            />
                            <div>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Require Supervisor Review for Task Completion</span>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    When enabled, completed tasks must be verified by a Team Lead or Manager before transitioning to Completed status.
                                </div>
                            </div>
                        </label>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: isAdmin ? 'pointer' : 'default' }}>
                            <input
                                type="checkbox"
                                disabled={!isAdmin}
                                checked={taskPolicies.allowEmployeeSelfAssign}
                                onChange={(e) => setTaskPolicies({ ...taskPolicies, allowEmployeeSelfAssign: e.target.checked })}
                                style={{ width: '18px', height: '18px', accentColor: 'var(--accent-color)' }}
                            />
                            <div>
                                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Allow Employee Task Self-Assignment</span>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    Permits employees to claim unassigned pool tasks without prior lead dispatching.
                                </div>
                            </div>
                        </label>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                Performance Review Cadence
                            </label>
                            <select
                                disabled={!isAdmin}
                                value={reviewPeriods.frequency}
                                onChange={(e) => setReviewPeriods({ ...reviewPeriods, frequency: e.target.value as any })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                            >
                                <option value="QUARTERLY">Quarterly (Every 3 Months)</option>
                                <option value="BI_ANNUAL">Bi-Annual (Every 6 Months)</option>
                                <option value="ANNUAL">Annual (Once per Year)</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                Next Formal Review Date
                            </label>
                            <input
                                type="date"
                                disabled={!isAdmin}
                                value={reviewPeriods.nextReviewDate}
                                onChange={(e) => setReviewPeriods({ ...reviewPeriods, nextReviewDate: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '10px 12px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-secondary)',
                                    color: 'var(--text-primary)',
                                    fontSize: '0.9rem'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Tab 5: Departments & Teams Directory */}
            {activeTab === 'DEPARTMENTS' && settings && (
                <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>
                            Organizational Units ({settings.departments.length} Departments)
                        </h3>

                        {isAdmin && (
                            <button
                                onClick={() => setIsDeptModalOpen(true)}
                                style={{
                                    padding: '8px 16px',
                                    background: 'var(--accent-color)',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                + Add Department
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                        {settings.departments.map((dept) => {
                            const deptTeams = settings.teams.filter((t) => t.department?.id === dept.id);

                            return (
                                <div
                                    key={dept.id}
                                    style={{
                                        background: 'var(--card-bg)',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        padding: '20px',
                                        boxShadow: 'var(--card-shadow)'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                                                {dept.name}
                                            </h4>
                                            {dept.code && (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Code: {dept.code}</span>
                                            )}
                                        </div>
                                        <span style={{ padding: '3px 8px', borderRadius: '4px', background: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', fontSize: '0.75rem', fontWeight: 600 }}>
                                            {dept._count?.users || 0} Members
                                        </span>
                                    </div>

                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                                        <span>Manager: </span>
                                        <strong style={{ color: 'var(--text-primary)' }}>{dept.manager ? dept.manager.name : 'Unassigned'}</strong>
                                    </div>

                                    <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
                                            Teams ({deptTeams.length})
                                        </div>
                                        {deptTeams.length === 0 ? (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>No teams created under this department yet.</div>
                                        ) : (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                {deptTeams.map((t) => (
                                                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)', padding: '6px 10px', borderRadius: '6px', fontSize: '0.8rem' }}>
                                                        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{t.name}</span>
                                                        <span style={{ color: 'var(--text-secondary)' }}>Lead: {t.teamLead?.name || 'None'}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Add Department Modal */}
            {isDeptModalOpen && (
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
                        maxWidth: '480px',
                        width: '100%',
                        padding: '24px',
                        border: '1px solid var(--border-color)',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Add New Department</h3>
                            <button
                                onClick={() => setIsDeptModalOpen(false)}
                                style={{ background: 'transparent', border: 'none', fontSize: '1.2rem', color: 'var(--text-secondary)', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateDept}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                    Department Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Quality Assurance"
                                    value={deptForm.name}
                                    onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                                    Department Code
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. QA"
                                    value={deptForm.code}
                                    onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '10px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-secondary)',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.9rem'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                                <button
                                    type="button"
                                    onClick={() => setIsDeptModalOpen(false)}
                                    style={{
                                        padding: '8px 16px',
                                        borderRadius: '6px',
                                        border: '1px solid var(--border-color)',
                                        background: 'transparent',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer'
                                    }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isCreatingDept}
                                    style={{
                                        padding: '8px 20px',
                                        borderRadius: '6px',
                                        border: 'none',
                                        background: 'var(--accent-color)',
                                        color: '#fff',
                                        fontWeight: 600,
                                        cursor: isCreatingDept ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {isCreatingDept ? 'Creating...' : 'Create Department'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
