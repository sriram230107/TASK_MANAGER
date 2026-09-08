import React, { useState, useEffect } from 'react';
import {
    notificationService,
    type NotificationItem,
    type BroadcastDTO
} from '../services/notification.service';
import { useAuth } from '../context/AuthContext';

// Helper to format relative or short time
const formatTime = (isoString: string) => {
    try {
        const date = new Date(isoString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    } catch {
        return isoString;
    }
};

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'ANNOUNCEMENT': return '📢';
        case 'TASK_ASSIGNED': return '📋';
        case 'TASK_COMMENT': return '💬';
        case 'TASK_STATUS_CHANGED': return '🔄';
        case 'LEAVE_STATUS': return '🏖';
        case 'ATTENDANCE_REMINDER': return '⏱';
        default: return '🔔';
    }
};

interface NotificationCenterProps {
    onNavigateToTasks?: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = () => {
    const { user } = useAuth();

    const [notifications, setNotifications] = useState<NotificationItem[]>([]);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [isLoading, setIsLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('ALL');
    const [onlyUnread, setOnlyUnread] = useState(false);

    // Broadcast announcement state
    const [showBroadcastModal, setShowBroadcastModal] = useState(false);
    const [isBroadcasting, setIsBroadcasting] = useState(false);
    const [broadcastError, setBroadcastError] = useState<string | null>(null);
    const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);
    const [broadcastForm, setBroadcastForm] = useState<BroadcastDTO>({
        targetScope: user?.role === 'ADMIN' ? 'ORGANIZATION' : user?.role === 'MANAGER' ? 'DEPARTMENT' : 'TEAM',
        message: ''
    });

    const isSupervisor = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'TEAM_LEAD';

    const loadNotifications = async () => {
        setIsLoading(true);
        try {
            const data = await notificationService.list({
                isRead: onlyUnread ? false : undefined,
                limit: 50
            });
            setNotifications(data.notifications);
            setUnreadCount(data.unreadCount);
        } catch (err) {
            console.error('Failed to load notifications:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadNotifications();
    }, [onlyUnread]);

    const handleMarkAsRead = async (id: string) => {
        try {
            await notificationService.markAsRead(id);
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
            );
            setUnreadCount((c) => Math.max(0, c - 1));
        } catch (err) {
            console.error('Failed to mark read:', err);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all read:', err);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await notificationService.delete(id);
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    const handleClearRead = async () => {
        try {
            await notificationService.clearRead();
            setNotifications((prev) => prev.filter((n) => !n.isRead));
        } catch (err) {
            console.error('Failed to clear read:', err);
        }
    };

    const handleBroadcastSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!broadcastForm.message.trim()) return;

        setIsBroadcasting(true);
        setBroadcastError(null);
        setBroadcastSuccess(null);

        try {
            const result = await notificationService.broadcast(broadcastForm);
            setBroadcastSuccess(result.message || 'Announcement broadcasted successfully!');
            setBroadcastForm({ ...broadcastForm, message: '' });
            setTimeout(() => {
                setShowBroadcastModal(false);
                setBroadcastSuccess(null);
                loadNotifications();
            }, 1500);
        } catch (err: any) {
            console.error('Broadcast failed:', err);
            setBroadcastError(err.response?.data?.message || err.message || 'Failed to broadcast announcement');
        } finally {
            setIsBroadcasting(false);
        }
    };

    const filteredList = notifications.filter((n) => {
        if (filterType === 'ALL') return true;
        if (filterType === 'ANNOUNCEMENT') return n.type === 'ANNOUNCEMENT';
        if (filterType === 'TASKS') return n.type.startsWith('TASK_');
        if (filterType === 'LEAVE') return n.type.startsWith('LEAVE_');
        return true;
    });

    return (
        <div style={{ padding: '1rem 0', maxWidth: '1200px', margin: '0 auto' }}>
            {/* Header Banner */}
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
                            Notification Center
                        </h1>
                        {unreadCount > 0 && (
                            <span style={{
                                background: '#ef4444',
                                color: '#fff',
                                padding: '0.2rem 0.6rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 700
                            }}>
                                {unreadCount} Unread
                            </span>
                        )}
                    </div>
                    <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        Live notifications, task alerts, leave review status updates, and company announcements.
                    </p>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {isSupervisor && (
                        <button
                            onClick={() => setShowBroadcastModal(true)}
                            className="btn"
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.4rem',
                                padding: '0.5rem 0.9rem',
                                fontSize: '0.8125rem'
                            }}
                        >
                            <span>📢</span>
                            <span>Broadcast Announcement</span>
                        </button>
                    )}

                    <button
                        onClick={handleMarkAllAsRead}
                        disabled={unreadCount === 0 || isLoading}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 0.85rem', fontSize: '0.8125rem' }}
                    >
                        ✓ Mark All as Read
                    </button>

                    <button
                        onClick={handleClearRead}
                        disabled={notifications.filter((n) => n.isRead).length === 0 || isLoading}
                        className="btn btn-secondary"
                        style={{ padding: '0.5rem 0.85rem', fontSize: '0.8125rem' }}
                    >
                        🗑 Clear Read
                    </button>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.75rem',
                marginBottom: '1rem'
            }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                    {[
                        { id: 'ALL', label: 'All Alerts' },
                        { id: 'ANNOUNCEMENT', label: '📢 Announcements' },
                        { id: 'TASKS', label: '✓ Tasks' },
                        { id: 'LEAVE', label: '🏖 Leave' }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setFilterType(tab.id)}
                            style={{
                                border: 'none',
                                background: filterType === tab.id ? 'var(--accent-color)' : 'var(--bg-secondary)',
                                color: filterType === tab.id ? '#fff' : 'var(--text-secondary)',
                                padding: '0.4rem 0.85rem',
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

                <label style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer'
                }}>
                    <input
                        type="checkbox"
                        checked={onlyUnread}
                        onChange={(e) => setOnlyUnread(e.target.checked)}
                    />
                    Show unread only
                </label>
            </div>

            {/* Notifications List */}
            {isLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--text-secondary)' }}>
                    Loading alerts...
                </div>
            ) : filteredList.length === 0 ? (
                <div style={{
                    textAlign: 'center',
                    padding: '4rem 1rem',
                    background: 'var(--bg-secondary)',
                    borderRadius: '12px',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
                    <h3 style={{ fontSize: '1.1rem', margin: '0 0 0.5rem 0', color: 'var(--text-primary)' }}>
                        All caught up!
                    </h3>
                    <p style={{ margin: 0, fontSize: '0.85rem' }}>
                        You don't have any notifications matching this filter.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {filteredList.map((item) => (
                        <div
                            key={item.id}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '1rem',
                                padding: '1rem 1.25rem',
                                background: item.isRead ? 'var(--bg-secondary)' : 'rgba(59, 130, 246, 0.08)',
                                border: '1px solid',
                                borderColor: item.isRead ? 'var(--border-color)' : 'rgba(59, 130, 246, 0.3)',
                                borderRadius: '10px',
                                transition: 'all 0.15s ease'
                            }}
                        >
                            {/* Icon */}
                            <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '8px',
                                background: 'var(--bg-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                flexShrink: 0
                            }}>
                                {getTypeIcon(item.type)}
                            </div>

                            {/* Body */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                                    <span style={{
                                        fontSize: '0.75rem',
                                        fontWeight: 700,
                                        color: item.type === 'ANNOUNCEMENT' ? '#f59e0b' : 'var(--accent-color)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em'
                                    }}>
                                        {item.type.replace(/_/g, ' ')}
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {formatTime(item.sentAt)}
                                    </span>
                                </div>

                                <div style={{
                                    fontSize: '0.875rem',
                                    fontWeight: item.isRead ? 400 : 600,
                                    color: 'var(--text-primary)',
                                    marginBottom: item.task ? '0.5rem' : 0,
                                    lineHeight: 1.4
                                }}>
                                    {item.message}
                                </div>

                                {item.task && (
                                    <div style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.2rem 0.5rem',
                                        background: 'var(--bg-primary)',
                                        borderRadius: '6px',
                                        fontSize: '0.75rem',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <span>📌 Task:</span>
                                        <strong>{item.task.title}</strong>
                                        <span style={{
                                            fontSize: '0.6875rem',
                                            padding: '0.1rem 0.35rem',
                                            borderRadius: '4px',
                                            background: 'rgba(59, 130, 246, 0.15)',
                                            color: 'var(--accent-color)'
                                        }}>
                                            {item.task.status}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
                                {!item.isRead && (
                                    <button
                                        onClick={() => handleMarkAsRead(item.id)}
                                        title="Mark as read"
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            color: 'var(--accent-color)',
                                            cursor: 'pointer',
                                            fontSize: '0.8125rem',
                                            padding: '0.35rem',
                                            fontWeight: 600
                                        }}
                                    >
                                        ✓ Mark Read
                                    </button>
                                )}

                                <button
                                    onClick={() => handleDelete(item.id)}
                                    title="Delete notification"
                                    style={{
                                        border: 'none',
                                        background: 'transparent',
                                        color: 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '0.875rem',
                                        padding: '0.35rem'
                                    }}
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Broadcast Announcement Modal */}
            {showBroadcastModal && (
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
                        maxWidth: '540px',
                        width: '100%',
                        padding: '1.5rem',
                        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                            <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>📢 Broadcast Announcement</h2>
                            <button
                                onClick={() => setShowBroadcastModal(false)}
                                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem' }}
                            >
                                ✕
                            </button>
                        </div>

                        {broadcastError && (
                            <div style={{ padding: '0.75rem', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                                {broadcastError}
                            </div>
                        )}

                        {broadcastSuccess && (
                            <div style={{ padding: '0.75rem', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderRadius: '6px', marginBottom: '1rem', fontSize: '0.8125rem' }}>
                                {broadcastSuccess}
                            </div>
                        )}

                        <form onSubmit={handleBroadcastSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Recipient Scope
                                </label>
                                <select
                                    value={broadcastForm.targetScope}
                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, targetScope: e.target.value as any })}
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
                                    {user?.role === 'ADMIN' && (
                                        <option value="ORGANIZATION">Organization-Wide (All Employees)</option>
                                    )}
                                    {(user?.role === 'ADMIN' || user?.role === 'MANAGER') && (
                                        <option value="DEPARTMENT">My Department Members</option>
                                    )}
                                    <option value="TEAM">My Team Members</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                                    Announcement Content
                                </label>
                                <textarea
                                    value={broadcastForm.message}
                                    onChange={(e) => setBroadcastForm({ ...broadcastForm, message: e.target.value })}
                                    placeholder="Type important announcement, milestone, or policy alert..."
                                    rows={4}
                                    required
                                    style={{
                                        width: '100%',
                                        padding: '0.65rem',
                                        background: 'var(--bg-primary)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '6px',
                                        color: 'var(--text-primary)',
                                        fontSize: '0.875rem',
                                        resize: 'vertical'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button
                                    type="button"
                                    onClick={() => setShowBroadcastModal(false)}
                                    className="btn btn-secondary"
                                    style={{ padding: '0.5rem 1rem' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isBroadcasting || !broadcastForm.message.trim()}
                                    className="btn"
                                    style={{ padding: '0.5rem 1.25rem' }}
                                >
                                    {isBroadcasting ? 'Broadcasting...' : 'Send Announcement'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

interface NotificationBellProps {
    onOpenCenter: () => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onOpenCenter }) => {
    const [unreadCount, setUnreadCount] = useState<number>(0);

    const checkUnread = async () => {
        try {
            const count = await notificationService.getUnreadCount();
            setUnreadCount(count);
        } catch {
            // silent fail on poll
        }
    };

    useEffect(() => {
        checkUnread();
        const interval = setInterval(checkUnread, 30000);
        return () => clearInterval(interval);
    }, []);

    return (
        <button
            onClick={onOpenCenter}
            title="Notification Center"
            style={{
                position: 'relative',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                padding: '0.45rem 0.65rem',
                borderRadius: '6px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem'
            }}
        >
            <span>🔔</span>
            {unreadCount > 0 && (
                <span style={{
                    position: 'absolute',
                    top: '-5px',
                    right: '-5px',
                    background: '#ef4444',
                    color: '#fff',
                    borderRadius: '9999px',
                    fontSize: '0.625rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.35rem',
                    minWidth: '16px',
                    textAlign: 'center',
                    border: '2px solid var(--bg-secondary)'
                }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
};
