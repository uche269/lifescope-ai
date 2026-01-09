import { Activity } from '../types';

export const checkIsCompleted = (activity: Activity): boolean => {
    // If we have no timestamp, rely on isCompleted (legacy) or false
    if (!activity.last_completed_at) return activity.isCompleted;

    const last = new Date(activity.last_completed_at);
    const now = new Date();

    // Normalize to local date strings to compare
    const isSameDay = (d1: Date, d2: Date) =>
        d1.getDate() === d2.getDate() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getFullYear() === d2.getFullYear();

    if (activity.frequency === 'Daily') {
        return isSameDay(last, now);
    }

    if (activity.frequency === 'Weekly') {
        // Check if within same ISO week
        const getWeek = (d: Date) => {
            const d2 = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d2.setUTCDate(d2.getUTCDate() + 4 - (d2.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d2.getUTCFullYear(), 0, 1));
            return Math.ceil((((d2.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
        }
        return getWeek(last) === getWeek(now) && last.getFullYear() === now.getFullYear();
    }

    if (activity.frequency === 'Monthly') {
        return last.getMonth() === now.getMonth() && last.getFullYear() === now.getFullYear();
    }

    // Default 'Once' or others
    return activity.isCompleted;
};
