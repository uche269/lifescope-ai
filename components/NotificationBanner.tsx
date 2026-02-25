import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Bell, CreditCard, Target, FileBarChart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Goal } from '../types';

interface NotificationBannerProps {
    goals: Goal[];
}

interface Notification {
    id: string;
    type: 'trial' | 'statement' | 'deadline' | 'subscription';
    message: string;
    icon: React.ReactNode;
    color: string;
    action?: { label: string; href: string };
}

const NotificationBanner: React.FC<NotificationBannerProps> = ({ goals }) => {
    const { planInfo, user } = useAuth();
    const [dismissed, setDismissed] = useState<string[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);

    useEffect(() => {
        const notifs: Notification[] = [];
        const sessionDismissed = JSON.parse(sessionStorage.getItem('dismissed_notifications') || '[]');
        setDismissed(sessionDismissed);

        // Goal deadline approaching (3 days)
        const now = new Date();
        goals.forEach(goal => {
            if (goal.deadline && goal.status !== 'Completed') {
                const deadline = new Date(goal.deadline);
                const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                if (daysLeft <= 3 && daysLeft >= 0) {
                    notifs.push({
                        id: `deadline_${goal.id}`,
                        type: 'deadline',
                        message: `Goal "${goal.title}" is due ${daysLeft === 0 ? 'today' : `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}`}!`,
                        icon: <Target className="w-4 h-4" />,
                        color: 'border-orange-500/50 bg-orange-500/10'
                    });
                }
            }
        });

        // Statement upload reminder (last 5 days of month)
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        if (dayOfMonth > daysInMonth - 5 && planInfo?.effectivePlan !== 'free') {
            notifs.push({
                id: 'statement_reminder',
                type: 'statement',
                message: "It's almost the end of the month! Upload your latest bank statement to keep your financial tracking up to date.",
                icon: <FileBarChart className="w-4 h-4" />,
                color: 'border-blue-500/50 bg-blue-500/10',
                action: { label: 'Upload Now', href: '/finance' }
            });
        }

        setNotifications(notifs);
    }, [planInfo, goals, user]);

    const dismiss = (id: string) => {
        const updated = [...dismissed, id];
        setDismissed(updated);
        sessionStorage.setItem('dismissed_notifications', JSON.stringify(updated));
    };

    const visible = notifications.filter(n => !dismissed.includes(n.id));

    if (visible.length === 0) return null;

    return (
        <div className="space-y-2 mb-6 animate-page-enter">
            {visible.map(n => (
                <div
                    key={n.id}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border ${n.color} backdrop-blur-sm`}
                >
                    <div className="flex items-center gap-3">
                        <div className="text-white/80">{n.icon}</div>
                        <span className="text-sm text-slate-200">{n.message}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        {n.action && (
                            <a
                                href={n.action.href}
                                className="text-xs font-medium bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg text-white transition-colors"
                            >
                                {n.action.label}
                            </a>
                        )}
                        <button
                            onClick={() => dismiss(n.id)}
                            className="text-slate-400 hover:text-white transition-colors p-1"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default NotificationBanner;
