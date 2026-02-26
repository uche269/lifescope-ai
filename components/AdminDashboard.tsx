import React, { useState, useEffect } from 'react';
import {
    Users, Activity, Crown, TrendingUp, RefreshCw, Search,
    Shield, Mail, MessageSquare, AlertTriangle, Lightbulb, Clock,
    ChevronDown, ChevronUp, UserCheck, Send
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

interface AdminUser {
    id: string;
    email: string;
    full_name: string;
    avatar_url?: string;
    plan: string;
    ai_calls_today: number;
    is_admin: boolean;
    last_login: string;
    created_at: string;
}

interface AdminStats {
    total_users: string;
    pro_users: string;
    premium_users: string;
    active_trials: string;
    active_week: string;
}

interface SupportTicket {
    id: string;
    type: 'complaint' | 'recommendation';
    message: string;
    user_name: string;
    user_email: string;
    user_phone: string;
    status: string;
    created_at: string;
}

const AdminDashboard: React.FC = () => {
    const { planInfo } = useAuth();
    const [stats, setStats] = useState<AdminStats | null>(null);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [tickets, setTickets] = useState<SupportTicket[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortField, setSortField] = useState<'created_at' | 'last_login' | 'plan'>('created_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [activeTab, setActiveTab] = useState<'users' | 'tickets'>('users');
    const [triggerLoading, setTriggerLoading] = useState(false);
    const [triggerMsg, setTriggerMsg] = useState('');

    const isAdmin = planInfo?.is_admin || planInfo?.effectivePlan === 'admin';

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, usersRes, ticketsRes] = await Promise.all([
                fetch('/api/admin/stats', { credentials: 'include' }).then(r => r.json()),
                fetch('/api/admin/users', { credentials: 'include' }).then(r => r.json()),
                fetch('/api/support/tickets', { credentials: 'include' }).then(r => r.json()),
            ]);
            setStats(statsRes.data || statsRes);
            const usersData = usersRes.data || usersRes;
            setUsers(Array.isArray(usersData) ? usersData : []);
            const ticketsData = ticketsRes.data || ticketsRes;
            setTickets(Array.isArray(ticketsData) ? ticketsData : []);
        } catch (err: any) {
            console.error('Admin data fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isAdmin) fetchData();
    }, [isAdmin]);

    const handleTriggerDailyReport = async () => {
        setTriggerLoading(true);
        setTriggerMsg('');
        try {
            await api.post('/email/trigger-daily-report', {});
            setTriggerMsg('Daily report email triggered successfully!');
            setTimeout(() => setTriggerMsg(''), 5000);
        } catch (e: any) {
            setTriggerMsg('Failed: ' + e.message);
        } finally {
            setTriggerLoading(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-center animate-page-enter">
                <Shield className="w-16 h-16 text-red-400 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">Access Denied</h2>
                <p className="text-slate-400">This page is restricted to administrators.</p>
            </div>
        );
    }

    // Filter and sort users
    const filteredUsers = users
        .filter(u =>
            (u.full_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (u.plan || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            const dir = sortDir === 'asc' ? 1 : -1;
            if (sortField === 'plan') return dir * (a.plan || '').localeCompare(b.plan || '');
            const dateA = new Date(a[sortField] || 0).getTime();
            const dateB = new Date(b[sortField] || 0).getTime();
            return dir * (dateA - dateB);
        });

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('desc');
        }
    };

    const SortIcon = ({ field }: { field: typeof sortField }) => {
        if (sortField !== field) return null;
        return sortDir === 'desc'
            ? <ChevronDown className="w-3 h-3 inline ml-1" />
            : <ChevronUp className="w-3 h-3 inline ml-1" />;
    };

    const formatDate = (d: string) => {
        if (!d) return 'Never';
        return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const formatTime = (d: string) => {
        if (!d) return '';
        return new Date(d).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    };

    const planBadge = (plan: string) => {
        const colors: Record<string, string> = {
            admin: 'bg-red-500/15 text-red-400 border-red-500/30',
            pro: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
            premium: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
            free: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
        };
        return colors[plan] || colors.free;
    };

    return (
        <div className="space-y-6 animate-page-enter">
            <header className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white mb-1 flex items-center gap-3">
                        <Shield className="w-7 h-7 text-indigo-400" /> Admin Dashboard
                    </h2>
                    <p className="text-slate-400 text-sm">Monitor your platform, users, and feedback.</p>
                </div>
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm font-medium transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
                </button>
            </header>

            {/* Stats Cards */}
            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: 'Total Users', value: stats.total_users, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
                        { label: 'Pro Users', value: stats.pro_users, icon: Crown, color: 'text-purple-400', bg: 'bg-purple-500/10' },
                        { label: 'Premium Users', value: stats.premium_users, icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-500/10' },
                        { label: 'Active Trials', value: stats.active_trials, icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
                        { label: 'Active (7d)', value: stats.active_week, icon: Activity, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
                    ].map(stat => (
                        <div key={stat.label} className="glass-panel rounded-xl p-4">
                            <div className="flex items-center gap-2 mb-2">
                                <div className={`p-2 rounded-lg ${stat.bg}`}>
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                </div>
                            </div>
                            <p className="text-2xl font-bold text-white">{stat.value || '0'}</p>
                            <p className="text-xs text-slate-500 mt-1">{stat.label}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Tab Selector */}
            <div className="flex gap-2">
                <button
                    onClick={() => setActiveTab('users')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'users'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800'
                        }`}
                >
                    <Users className="w-4 h-4" /> Users ({users.length})
                </button>
                <button
                    onClick={() => setActiveTab('tickets')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === 'tickets'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-400 hover:text-white bg-slate-800/50 hover:bg-slate-800'
                        }`}
                >
                    <MessageSquare className="w-4 h-4" /> Tickets ({tickets.length})
                </button>
            </div>

            {/* ========== USERS TABLE ========== */}
            {activeTab === 'users' && (
                <div className="glass-panel rounded-2xl overflow-hidden">
                    {/* Search Bar */}
                    <div className="p-4 border-b border-slate-800">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                            <input
                                type="text"
                                placeholder="Search by name, email, or plan..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800 text-left">
                                    <th className="px-4 py-3 text-xs text-slate-500 font-semibold">User</th>
                                    <th className="px-4 py-3 text-xs text-slate-500 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('plan')}>
                                        Plan <SortIcon field="plan" />
                                    </th>
                                    <th className="px-4 py-3 text-xs text-slate-500 font-semibold">AI Today</th>
                                    <th className="px-4 py-3 text-xs text-slate-500 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('last_login')}>
                                        Last Login <SortIcon field="last_login" />
                                    </th>
                                    <th className="px-4 py-3 text-xs text-slate-500 font-semibold cursor-pointer hover:text-white" onClick={() => toggleSort('created_at')}>
                                        Registered <SortIcon field="created_at" />
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 text-slate-500">
                                            <RefreshCw className="w-5 h-5 animate-spin inline mr-2" /> Loading...
                                        </td>
                                    </tr>
                                ) : filteredUsers.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="text-center py-12 text-slate-500">No users found</td>
                                    </tr>
                                ) : filteredUsers.map(user => (
                                    <tr key={user.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-indigo-600/30 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                                                    {(user.full_name || user.email)?.[0]?.toUpperCase() || '?'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-white font-medium truncate text-sm flex items-center gap-1.5">
                                                        {user.full_name || 'Unnamed'}
                                                        {user.is_admin && <Shield className="w-3 h-3 text-red-400 shrink-0" />}
                                                    </p>
                                                    <p className="text-slate-500 text-xs truncate">{user.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${planBadge(user.plan)}`}>
                                                {user.plan || 'free'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 text-xs">
                                            {user.ai_calls_today || 0}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 text-xs">
                                            {formatDate(user.last_login)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-400 text-xs">
                                            {formatDate(user.created_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="px-4 py-3 border-t border-slate-800 text-xs text-slate-500">
                        Showing {filteredUsers.length} of {users.length} users
                    </div>
                </div>
            )}

            {/* ========== SUPPORT TICKETS ========== */}
            {activeTab === 'tickets' && (
                <div className="space-y-4">
                    {/* Action bar */}
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleTriggerDailyReport}
                            disabled={triggerLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-sm font-medium transition-colors"
                        >
                            <Send className={`w-4 h-4 ${triggerLoading ? 'animate-spin' : ''}`} />
                            {triggerLoading ? 'Sending...' : 'Send Daily Report Now'}
                        </button>
                        {triggerMsg && (
                            <p className={`text-sm ${triggerMsg.includes('Failed') ? 'text-red-400' : 'text-emerald-400'}`}>
                                {triggerMsg}
                            </p>
                        )}
                    </div>

                    {tickets.length === 0 ? (
                        <div className="glass-panel rounded-2xl p-12 text-center">
                            <MessageSquare className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                            <p className="text-slate-400">No support tickets yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {tickets.map(ticket => (
                                <div key={ticket.id} className="glass-panel rounded-xl p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className={`p-2 rounded-lg shrink-0 ${ticket.type === 'complaint' ? 'bg-red-500/10' : 'bg-emerald-500/10'
                                                }`}>
                                                {ticket.type === 'complaint'
                                                    ? <AlertTriangle className="w-4 h-4 text-red-400" />
                                                    : <Lightbulb className="w-4 h-4 text-emerald-400" />}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap mb-1">
                                                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border capitalize ${ticket.type === 'complaint'
                                                        ? 'bg-red-500/10 text-red-400 border-red-500/30'
                                                        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                                        }`}>
                                                        {ticket.type}
                                                    </span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full border ${ticket.status === 'emailed'
                                                        ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                                                        : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                                                        }`}>
                                                        {ticket.status}
                                                    </span>
                                                </div>
                                                <p className="text-white text-sm mb-2">{ticket.message}</p>
                                                <div className="flex items-center gap-4 text-xs text-slate-500">
                                                    <span className="flex items-center gap-1">
                                                        <UserCheck className="w-3 h-3" /> {ticket.user_name || 'Unknown'}
                                                    </span>
                                                    {ticket.user_email && (
                                                        <a href={`mailto:${ticket.user_email}`} className="flex items-center gap-1 hover:text-indigo-400 transition-colors">
                                                            <Mail className="w-3 h-3" /> {ticket.user_email}
                                                        </a>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-xs text-slate-500 shrink-0 text-right">
                                            <p>{formatDate(ticket.created_at)}</p>
                                            <p>{formatTime(ticket.created_at)}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
