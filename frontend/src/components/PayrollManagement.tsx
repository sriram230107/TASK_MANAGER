import React, { useState, useEffect } from 'react';
import {
    payrollService,
    type PayrollRecord,
    type PayrollSummary,
    type PayrollStatus,
    type CreatePayrollDTO
} from '../services/payroll.service';
import { userService, type UserListItem } from '../services/user.service';
import { useAuth } from '../context/AuthContext';

export const PayrollManagement: React.FC = () => {
    const { user } = useAuth();
    const isAdmin = user?.role === 'ADMIN';
    const isEmployee = user?.role === 'EMPLOYEE';

    const [records, setRecords] = useState<PayrollRecord[]>([]);
    const [summary, setSummary] = useState<PayrollSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal states
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [employeeList, setEmployeeList] = useState<UserListItem[]>([]);

    // Payslip viewer modal state
    const [selectedPayslipHtml, setSelectedPayslipHtml] = useState<string | null>(null);
    const [loadingPayslip, setLoadingPayslip] = useState(false);

    // Form state for creation
    const [form, setForm] = useState<CreatePayrollDTO>({
        employeeId: '',
        periodStart: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        periodEnd: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0],
        baseSalary: 4500,
        allowances: 300,
        deductions: 450,
        overtimePay: 0,
        bonuses: 0,
        status: 'DRAFT',
        autoComputeOvertime: true
    });

    const loadRecords = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const data = await payrollService.list({
                status: statusFilter === 'ALL' ? undefined : (statusFilter as PayrollStatus)
            });
            setRecords(data.records);
            setSummary(data.summary);
        } catch (err: any) {
            console.error('Failed to load payroll records:', err);
            setError(err.response?.data?.message || err.message || 'Failed to load payroll records');
        } finally {
            setIsLoading(false);
        }
    };

    const loadEmployees = async () => {
        if (!isAdmin) return;
        try {
            const data = await userService.listUsers({ limit: 100 });
            setEmployeeList(data.users);
            if (data.users.length > 0 && !form.employeeId) {
                setForm((prev) => ({ ...prev, employeeId: data.users[0].id }));
            }
        } catch (err) {
            console.error('Failed to load employees for payroll creation:', err);
        }
    };

    useEffect(() => {
        loadRecords();
    }, [statusFilter]);

    useEffect(() => {
        if (isAdmin) {
            loadEmployees();
        }
    }, [isAdmin]);

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.employeeId) {
            setFormError('Please select an employee');
            return;
        }

        setIsSaving(true);
        setFormError(null);
        try {
            await payrollService.create({
                ...form,
                baseSalary: Number(form.baseSalary),
                allowances: Number(form.allowances || 0),
                deductions: Number(form.deductions || 0),
                overtimePay: Number(form.overtimePay || 0),
                bonuses: Number(form.bonuses || 0)
            });
            setShowCreateModal(false);
            loadRecords();
        } catch (err: any) {
            console.error('Create payroll failed:', err);
            setFormError(err.response?.data?.message || err.message || 'Failed to create payroll record');
        } finally {
            setIsSaving(false);
        }
    };

    const handleViewPayslip = async (id: string) => {
        setLoadingPayslip(true);
        try {
            const html = await payrollService.getPayslipHtml(id);
            setSelectedPayslipHtml(html);
        } catch (err: any) {
            console.error('Failed to load payslip:', err);
            alert('Failed to load payslip: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoadingPayslip(false);
        }
    };

    const handleStatusTransition = async (recordId: string, newStatus: 'PROCESSED' | 'PAID') => {
        try {
            await payrollService.update(recordId, { status: newStatus });
            loadRecords();
        } catch (err: any) {
            console.error('Failed to update status:', err);
            alert('Status update failed: ' + (err.response?.data?.message || err.message));
        }
    };

    const handleDelete = async (recordId: string) => {
        if (!confirm('Are you sure you want to delete this draft payroll record?')) return;
        try {
            await payrollService.delete(recordId);
            loadRecords();
        } catch (err: any) {
            console.error('Failed to delete payroll record:', err);
            alert('Delete failed: ' + (err.response?.data?.message || err.message));
        }
    };

    // Calculate preview net pay
    const previewNet = Number(form.baseSalary || 0) +
        Number(form.allowances || 0) +
        Number(form.overtimePay || 0) +
        Number(form.bonuses || 0) -
        Number(form.deductions || 0);

    const filteredRecords = records.filter((r) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            r.employee.name.toLowerCase().includes(q) ||
            r.employee.email.toLowerCase().includes(q) ||
            r.employee.department?.name?.toLowerCase().includes(q)
        );
    });

    return (
        <div style={{ padding: '1rem 0', maxWidth: '1400px', margin: '0 auto' }}>
            {/* Header */}
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
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 0.25rem 0', color: 'var(--text-primary)' }}>
                        {isEmployee ? 'My Payslips & Compensation' : 'Payroll & Compensation Management'}
                    </h1>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {isEmployee
                            ? 'Review salary disbursements, allowances, deductions, and download official company payslips.'
                            : 'Organization-level compensation records, automated attendance overtime integration, and official payslip generation.'}
                    </p>
                </div>

                {isAdmin && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="btn"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.55rem 1.15rem',
                            fontWeight: 600
                        }}
                    >
                        <span>➕</span>
                        <span>New Payroll Record</span>
                    </button>
                )}
            </div>

            {/* Financial Summary KPI Cards (Visible to Admin & Manager) */}
            {!isEmployee && summary && (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '1rem',
                    marginBottom: '1.5rem'
                }}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '1.15rem'
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Net Payout</div>
                        <div style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--accent-color)', marginTop: '0.25rem' }}>
                            ${summary.totalNetPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Across {summary.totalRecords} disbursement records
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '1.15rem'
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Base Salaries</div>
                        <div style={{ fontSize: '1.65rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                            ${summary.totalBaseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Contracted baseline pay
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '1.15rem'
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Allowances & Bonuses</div>
                        <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#10b981', marginTop: '0.25rem' }}>
                            +${(summary.totalAllowances + summary.totalBonuses).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Housing, transport & bonuses
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '1.15rem'
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Overtime Compensations</div>
                        <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#8b5cf6', marginTop: '0.25rem' }}>
                            +${summary.totalOvertimePay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Calculated from attendance logs
                        </div>
                    </div>

                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '10px',
                        padding: '1.15rem'
                    }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Deductions</div>
                        <div style={{ fontSize: '1.65rem', fontWeight: 700, color: '#ef4444', marginTop: '0.25rem' }}>
                            -${summary.totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            Tax, insurance & statutory
                        </div>
                    </div>
                </div>
            )}

            {/* Filter and Search Bar */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '1rem',
                marginBottom: '1rem'
            }}>
                {/* Status Tabs */}
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[
                        { id: 'ALL', label: 'All Statuses' },
                        { id: 'DRAFT', label: 'Drafts' },
                        { id: 'PROCESSED', label: 'Processed' },
                        { id: 'PAID', label: 'Paid' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setStatusFilter(tab.id)}
                            style={{
                                border: 'none',
                                background: statusFilter === tab.id ? 'var(--accent-color)' : 'var(--bg-secondary)',
                                color: statusFilter === tab.id ? '#fff' : 'var(--text-secondary)',
                                padding: '0.45rem 0.9rem',
                                borderRadius: '6px',
                                fontSize: '0.8125rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {!isEmployee && (
                    <input
                        type="text"
                        placeholder="Search employee or department..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                            padding: '0.45rem 0.85rem',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '6px',
                            color: 'var(--text-primary)',
                            fontSize: '0.8125rem',
                            width: '240px'
                        }}
                    />
                )}
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

            {/* Records Table */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem 0', color: 'var(--text-secondary)' }}>
                    Loading payroll records...
                </div>
            ) : filteredRecords.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💰</div>
                    <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                        No Payroll Records Found
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                        {isEmployee
                            ? 'No compensation records have been generated for your account yet.'
                            : 'No payroll records matching your active filter.'}
                    </p>
                </div>
            ) : (
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden'
                }}>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                            <thead>
                                <tr style={{ background: 'var(--bg-primary)', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                                    <th style={{ padding: '0.85rem 1rem' }}>Employee</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Pay Period</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Base Salary</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Allowances/Bonuses</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Overtime Pay</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Deductions</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Net Salary</th>
                                    <th style={{ padding: '0.85rem 1rem' }}>Status</th>
                                    <th style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecords.map((r) => (
                                    <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{r.employee.name}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                {r.employee.department?.name || 'General'}
                                            </div>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', color: 'var(--text-secondary)' }}>
                                            {r.periodStart.split('T')[0]} to {r.periodEnd.split('T')[0]}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            ${r.baseSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', color: '#10b981' }}>
                                            +${(r.allowances + r.bonuses).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', color: '#8b5cf6' }}>
                                            +${r.overtimePay.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', color: '#ef4444' }}>
                                            -${r.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--accent-color)' }}>
                                                ${r.netSalary.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem' }}>
                                            <span style={{
                                                fontSize: '0.6875rem',
                                                padding: '0.2rem 0.55rem',
                                                borderRadius: '9999px',
                                                fontWeight: 700,
                                                background:
                                                    r.status === 'PAID'
                                                        ? 'rgba(16, 185, 129, 0.15)'
                                                        : r.status === 'PROCESSED'
                                                        ? 'rgba(59, 130, 246, 0.15)'
                                                        : 'rgba(100, 116, 139, 0.15)',
                                                color:
                                                    r.status === 'PAID'
                                                        ? '#10b981'
                                                        : r.status === 'PROCESSED'
                                                        ? '#3b82f6'
                                                        : 'var(--text-secondary)'
                                            }}>
                                                {r.status}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.85rem 1rem', textAlign: 'right' }}>
                                            <div style={{ display: 'inline-flex', gap: '0.35rem', alignItems: 'center' }}>
                                                <button
                                                    onClick={() => handleViewPayslip(r.id)}
                                                    disabled={loadingPayslip}
                                                    className="btn btn-secondary"
                                                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                                >
                                                    📄 Payslip
                                                </button>

                                                {isAdmin && r.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleStatusTransition(r.id, 'PROCESSED')}
                                                        className="btn"
                                                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}
                                                    >
                                                        Process
                                                    </button>
                                                )}

                                                {isAdmin && r.status === 'PROCESSED' && (
                                                    <button
                                                        onClick={() => handleStatusTransition(r.id, 'PAID')}
                                                        style={{
                                                            padding: '0.3rem 0.6rem',
                                                            fontSize: '0.75rem',
                                                            background: '#10b981',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '4px',
                                                            cursor: 'pointer',
                                                            fontWeight: 600
                                                        }}
                                                    >
                                                        Mark Paid
                                                    </button>
                                                )}

                                                {isAdmin && r.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => handleDelete(r.id)}
                                                        style={{
                                                            padding: '0.3rem 0.5rem',
                                                            fontSize: '0.75rem',
                                                            background: 'transparent',
                                                            border: 'none',
                                                            color: '#ef4444',
                                                            cursor: 'pointer'
                                                        }}
                                                    >
                                                        🗑
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Create Payroll Record Modal (Admin Only) */}
            {showCreateModal && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1rem'
                }}>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '12px',
                        maxWidth: '560px',
                        width: '100%',
                        padding: '1.5rem',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)',
                        maxHeight: '90vh',
                        overflowY: 'auto'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>➕ New Compensation Record</h2>
                            <button
                                onClick={() => setShowCreateModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        {formError && (
                            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                                {formError}
                            </div>
                        )}

                        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Employee
                                </label>
                                <select
                                    value={form.employeeId}
                                    onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem'
                                    }}
                                >
                                    {employeeList.map((emp) => (
                                        <option key={emp.id} value={emp.id}>
                                            {emp.name} ({emp.role} - {emp.department?.name || 'General'})
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                        Period Start
                                    </label>
                                    <input
                                        type="date"
                                        value={form.periodStart}
                                        onChange={(e) => setForm({ ...form, periodStart: e.target.value })}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                        Period End
                                    </label>
                                    <input
                                        type="date"
                                        value={form.periodEnd}
                                        onChange={(e) => setForm({ ...form, periodEnd: e.target.value })}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                        Base Salary ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.baseSalary}
                                        onChange={(e) => setForm({ ...form, baseSalary: parseFloat(e.target.value) || 0 })}
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                        Allowances ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.allowances}
                                        onChange={(e) => setForm({ ...form, allowances: parseFloat(e.target.value) || 0 })}
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                        Bonuses ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.bonuses}
                                        onChange={(e) => setForm({ ...form, bonuses: parseFloat(e.target.value) || 0 })}
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                        Deductions ($)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={form.deductions}
                                        onChange={(e) => setForm({ ...form, deductions: parseFloat(e.target.value) || 0 })}
                                        style={{
                                            width: '100%',
                                            padding: '0.6rem',
                                            background: 'var(--bg-primary)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '6px',
                                            color: 'var(--text-primary)',
                                            fontSize: '0.875rem'
                                        }}
                                    />
                                </div>
                            </div>

                            <div>
                                <label style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    fontSize: '0.8125rem',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                }}>
                                    <input
                                        type="checkbox"
                                        checked={form.autoComputeOvertime}
                                        onChange={(e) => setForm({ ...form, autoComputeOvertime: e.target.checked })}
                                    />
                                    <span>Auto-calculate overtime pay from employee attendance logs</span>
                                </label>
                            </div>

                            {/* Net Preview Banner */}
                            <div style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                padding: '0.85rem',
                                borderRadius: '8px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Estimated Net Payout:</span>
                                <span style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent-color)' }}>
                                    ${previewNet.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </span>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.55rem 1rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="btn"
                                    style={{ padding: '0.55rem 1.25rem' }}
                                >
                                    {isSaving ? 'Creating...' : 'Save Record'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Payslip Viewer Modal */}
            {selectedPayslipHtml && (
                <div style={{
                    position: 'fixed',
                    inset: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.75)',
                    backdropFilter: 'blur(4px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '1.5rem'
                }}>
                    <div style={{
                        background: '#fff',
                        borderRadius: '12px',
                        maxWidth: '820px',
                        width: '100%',
                        maxHeight: '92vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '1rem 1.5rem',
                            borderBottom: '1px solid #e2e8f0',
                            background: '#f8fafc'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1e293b', fontWeight: 700 }}>
                                Official Salary Payslip
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={() => {
                                        const iframe = document.getElementById('payslip-frame') as HTMLIFrameElement;
                                        if (iframe && iframe.contentWindow) {
                                            iframe.contentWindow.print();
                                        }
                                    }}
                                    style={{
                                        padding: '0.45rem 0.85rem',
                                        background: '#3b82f6',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        fontWeight: 600,
                                        fontSize: '0.8125rem'
                                    }}
                                >
                                    🖨 Print / Save PDF
                                </button>
                                <button
                                    onClick={() => setSelectedPayslipHtml(null)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: '#64748b',
                                        fontSize: '1.25rem',
                                        cursor: 'pointer',
                                        padding: '0.25rem 0.5rem'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div style={{ flex: 1, overflow: 'hidden' }}>
                            <iframe
                                id="payslip-frame"
                                title="Payslip"
                                srcDoc={selectedPayslipHtml}
                                style={{
                                    width: '100%',
                                    height: '75vh',
                                    border: 'none'
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
