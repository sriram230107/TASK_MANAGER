import React, { useState, useEffect } from 'react';
import { taskService, type Task } from '../services/task.service';
import { StatusBadge } from './StatusBadge';

export const Calendar: React.FC = () => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchTasks = async () => {
            try {
                setLoading(true);
                const res = await taskService.listTasks({ limit: 100 });
                setTasks(res.data || []);
            } catch (e) {
                console.error('Failed to load calendar tasks:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchTasks();
    }, []);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);

    return (
        <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: 0 }}>Calendar View</h3>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <button className="btn-secondary" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}>Prev</button>
                        <h4 style={{ minWidth: '150px', textAlign: 'center', margin: 0 }}>
                            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </h4>
                        <button className="btn-secondary" onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}>Next</button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading calendar events...</div>
            ) : (
                <div className="grid" style={{ gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.5rem' }}>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} style={{ textAlign: 'center', fontWeight: 'bold', padding: '0.5rem', background: 'var(--bg-secondary)', borderRadius: '4px', fontSize: '0.85rem' }}>
                            {d}
                        </div>
                    ))}
                    {blanks.map(b => <div key={`blank-${b}`} />)}
                    {days.map(d => {
                        const matchingTasks = tasks.filter(t => {
                            if (!t.dueDate) return false;
                            const tDate = new Date(t.dueDate);
                            return tDate.getDate() === d && tDate.getMonth() === currentDate.getMonth() && tDate.getFullYear() === currentDate.getFullYear();
                        });

                        return (
                            <div key={d} style={{ border: '1px solid var(--border-color)', borderRadius: '4px', minHeight: '110px', padding: '0.5rem', background: 'rgba(255,255,255,0.02)' }}>
                                <strong style={{ display: 'block', marginBottom: '0.5rem', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{d}</strong>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                                    {matchingTasks.map(t => (
                                        <div key={t.id} style={{ fontSize: '0.75rem', padding: '0.35rem', background: 'var(--bg-secondary)', borderRadius: '4px', borderLeft: '3px solid var(--accent-color)' }}>
                                            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '0.2rem' }}>{t.title}</div>
                                            <StatusBadge status={t.isOverdue ? 'OVERDUE' : t.status} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
