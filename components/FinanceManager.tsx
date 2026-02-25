import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Upload, TrendingDown, TrendingUp, Wallet, PieChart as PieChartIcon,
    BarChart3, Target, Sparkles, FileSpreadsheet, Loader2, ArrowUpRight,
    ArrowDownRight, Calendar, Filter
} from 'lucide-react';
import {
    PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, LineChart, Line, Area, AreaChart
} from 'recharts';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || '';

interface Transaction {
    id: string;
    date: string;
    description: string;
    amount: number;
    type: 'credit' | 'debit';
    category: string;
    merchant: string;
    balance: number;
}

interface BudgetItem {
    category: string;
    budget_amount: number;
    actual: number;
}

const CATEGORY_COLORS: Record<string, string> = {
    'Food & Dining': '#f59e0b',
    'Transport': '#3b82f6',
    'Bills & Utilities': '#ef4444',
    'Entertainment': '#a855f7',
    'Shopping': '#ec4899',
    'Health': '#10b981',
    'Savings': '#06b6d4',
    'Transfer': '#6366f1',
    'Income': '#22c55e',
    'Other': '#64748b'
};

const FinanceManager: React.FC = () => {
    const { planInfo } = useAuth();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [savingsGoal, setSavingsGoal] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(
        new Date().toISOString().slice(0, 7)
    );
    const [activeTab, setActiveTab] = useState<'overview' | 'transactions' | 'budget'>('overview');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const isAILocked = false;

    // Fetch transactions
    const fetchTransactions = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `${API_URL}/api/finance/transactions?month=${selectedMonth}`,
                { credentials: 'include' }
            );
            const data = await res.json();
            if (data.data) setTransactions(data.data);
        } catch (err) {
            console.error('Error fetching transactions:', err);
        } finally {
            setLoading(false);
        }
    }, [selectedMonth]);

    useEffect(() => {
        fetchTransactions();
    }, [fetchTransactions]);

    // Statement Upload (CSV or PDF)
    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setUploadLoading(true);
        const formData = new FormData();
        formData.append('statement', file);
        formData.append('month', selectedMonth);

        try {
            const res = await fetch(`${API_URL}/api/finance/upload`, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });
            const data = await res.json();
            if (data.data) {
                setTransactions(data.data);
            }
        } catch (err) {
            console.error('Upload error:', err);
        } finally {
            setUploadLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // AI Analysis
    const handleAnalyze = async () => {
        if (isAILocked || transactions.length === 0) return;
        setAiLoading(true);
        try {
            const res = await fetch(`${API_URL}/api/finance/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    month: selectedMonth,
                    savingsGoal: savingsGoal ? parseFloat(savingsGoal) : 0
                })
            });
            const data = await res.json();
            setAiAnalysis(data.analysis || data.error);
        } catch (err) {
            setAiAnalysis('Failed to generate analysis. Please try again.');
        } finally {
            setAiLoading(false);
        }
    };

    // Computed data for charts
    const categoryBreakdown = transactions
        .filter(t => t.type === 'debit')
        .reduce((acc, t) => {
            const cat = t.category || 'Other';
            acc[cat] = (acc[cat] || 0) + Math.abs(t.amount);
            return acc;
        }, {} as Record<string, number>);

    const pieData = Object.entries(categoryBreakdown)
        .map(([name, value]) => ({ name, value: Math.round(value) }))
        .sort((a, b) => b.value - a.value);

    const totalIncome = transactions.filter(t => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
    const totalExpenses = transactions.filter(t => t.type === 'debit').reduce((s, t) => s + Math.abs(t.amount), 0);
    const netSavings = totalIncome - totalExpenses;

    // Daily spending trend
    const dailySpending = transactions
        .filter(t => t.type === 'debit')
        .reduce((acc, t) => {
            const day = t.date?.slice(0, 10) || 'unknown';
            acc[day] = (acc[day] || 0) + Math.abs(t.amount);
            return acc;
        }, {} as Record<string, number>);

    const trendData = Object.entries(dailySpending)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, amount]) => ({
            date: date.slice(5),
            amount: Math.round(amount)
        }));

    const cleanText = (text: string) => text.replace(/[*#_`]/g, '').replace(/(\r\n|\n|\r)/gm, "\n");

    return (
        <div className="space-y-6 animate-page-enter">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white">Finance Manager</h2>
                    <p className="text-sm text-slate-400 mt-1">Track spending, set budgets, and get AI insights</p>
                </div>
                <div className="flex items-center gap-3">
                    <input
                        type="month"
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white custom-date-icon focus:outline-none focus:border-indigo-500"
                    />
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.pdf"
                        onChange={handleUpload}
                        className="hidden"
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadLoading}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                        {uploadLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        Upload Statement
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800 pb-1">
                {(['overview', 'transactions', 'budget'] as const).map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors capitalize ${activeTab === tab
                            ? 'text-white bg-slate-800/80 border-b-2 border-indigo-500'
                            : 'text-slate-400 hover:text-slate-200'
                            }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>

            {transactions.length === 0 && !loading ? (
                /* Empty state */
                <div className="glass-panel rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mb-4">
                        <FileSpreadsheet className="w-10 h-10 text-slate-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-300 mb-2">No transactions yet</h3>
                    <p className="text-sm text-slate-500 mb-6 max-w-md">
                        Upload your bank statement (PDF or CSV) to see your spending breakdown, trends, and AI-powered budget recommendations.
                    </p>
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-medium transition-colors"
                    >
                        <Upload className="w-4 h-4" />
                        Upload Your First Statement
                    </button>
                </div>
            ) : loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                </div>
            ) : activeTab === 'overview' ? (
                <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="glass-panel rounded-2xl p-5">
                            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                                <ArrowUpRight className="w-4 h-4 text-emerald-400" /> Income
                            </div>
                            <p className="stat-number text-2xl">₦{totalIncome.toLocaleString()}</p>
                        </div>
                        <div className="glass-panel rounded-2xl p-5">
                            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                                <ArrowDownRight className="w-4 h-4 text-red-400" /> Expenses
                            </div>
                            <p className="stat-number text-2xl">₦{totalExpenses.toLocaleString()}</p>
                        </div>
                        <div className="glass-panel rounded-2xl p-5">
                            <div className="flex items-center gap-2 text-slate-400 text-sm mb-2">
                                <Wallet className="w-4 h-4 text-indigo-400" /> Net Savings
                            </div>
                            <p className={`stat-number text-2xl ${netSavings >= 0 ? '' : 'text-red-400'}`}>
                                ₦{netSavings.toLocaleString()}
                            </p>
                        </div>
                    </div>

                    {/* Charts Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Spending by Category (Pie) */}
                        <div className="glass-panel rounded-2xl p-6">
                            <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                                <PieChartIcon className="w-4 h-4" /> Spending by Category
                            </h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        dataKey="value"
                                        nameKey="name"
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={100}
                                        innerRadius={50}
                                        paddingAngle={2}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        labelLine={false}
                                    >
                                        {pieData.map((entry, i) => (
                                            <Cell
                                                key={i}
                                                fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS['Other']}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                                        labelStyle={{ color: '#e2e8f0' }}
                                        formatter={(value: number) => `₦${value.toLocaleString()}`}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Spending Trend (Area) */}
                        <div className="glass-panel rounded-2xl p-6">
                            <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                                <TrendingDown className="w-4 h-4" /> Daily Spending Trend
                            </h3>
                            <div className="overflow-x-auto custom-scrollbar">
                                <div style={{ minWidth: '600px', height: '280px' }}>
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={trendData}>
                                            <defs>
                                                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                            <XAxis dataKey="date" stroke="#64748b" tick={{ fontSize: 11 }} />
                                            <YAxis stroke="#64748b" tick={{ fontSize: 11 }} tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                                            <Tooltip
                                                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                                                formatter={(value: number) => `₦${value.toLocaleString()}`}
                                            />
                                            <Area type="monotone" dataKey="amount" stroke="#6366f1" fill="url(#spendGradient)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* AI Analysis Section */}
                    <div className="glass-panel rounded-2xl p-6">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <h3 className="text-sm font-semibold text-slate-400 flex items-center gap-2">
                                <Sparkles className="w-4 h-4 text-indigo-400" /> AI Budget Analysis
                            </h3>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    placeholder="Savings goal (₦)"
                                    value={savingsGoal}
                                    onChange={(e) => setSavingsGoal(e.target.value)}
                                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white w-40 focus:outline-none focus:border-indigo-500"
                                />
                                <button
                                    onClick={handleAnalyze}
                                    disabled={aiLoading || isAILocked}
                                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${isAILocked
                                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                        }`}
                                >
                                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    {isAILocked ? 'Upgrade to Unlock' : 'Analyze'}
                                </button>
                            </div>
                        </div>

                        {aiAnalysis ? (
                            <div className="prose prose-invert prose-sm max-w-none whitespace-pre-line text-slate-300 leading-relaxed">
                                {cleanText(aiAnalysis)}
                            </div>
                        ) : (
                            <p className="text-sm text-slate-500 italic">
                                {isAILocked
                                    ? 'AI analysis requires a Pro or Premium plan.'
                                    : 'Click "Analyze" to get AI-powered budget recommendations based on your spending patterns.'}
                            </p>
                        )}
                    </div>
                </>
            ) : activeTab === 'transactions' ? (
                /* Transactions Table */
                <div className="glass-panel rounded-2xl p-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-slate-800">
                                    <th className="text-left py-3 px-3 text-slate-400 font-medium">Date</th>
                                    <th className="text-left py-3 px-3 text-slate-400 font-medium">Description</th>
                                    <th className="text-left py-3 px-3 text-slate-400 font-medium">Category</th>
                                    <th className="text-right py-3 px-3 text-slate-400 font-medium">Amount</th>
                                    <th className="text-right py-3 px-3 text-slate-400 font-medium">Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((t, i) => (
                                    <tr key={t.id || i} className="border-b border-slate-800/50 hover:bg-slate-900/50 transition-colors">
                                        <td className="py-3 px-3 text-slate-300">{t.date?.slice(0, 10)}</td>
                                        <td className="py-3 px-3 text-white max-w-[200px] truncate">{t.description}</td>
                                        <td className="py-3 px-3">
                                            <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-300">
                                                {t.category || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td className={`py-3 px-3 text-right font-medium ${t.type === 'credit' ? 'text-emerald-400' : 'text-red-400'
                                            }`}>
                                            {t.type === 'credit' ? '+' : '-'}₦{Math.abs(t.amount).toLocaleString()}
                                        </td>
                                        <td className="py-3 px-3 text-right text-slate-400">
                                            ₦{t.balance?.toLocaleString() || '—'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Budget Tab */
                <div className="glass-panel rounded-2xl p-6">
                    <h3 className="text-sm font-semibold text-slate-400 mb-4 flex items-center gap-2">
                        <BarChart3 className="w-4 h-4" /> Budget vs Actual
                    </h3>
                    {pieData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart
                                data={pieData.slice(0, 8)}
                                layout="vertical"
                                margin={{ left: 80 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                                <XAxis type="number" stroke="#64748b" tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                                <YAxis type="category" dataKey="name" stroke="#64748b" tick={{ fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px' }}
                                    formatter={(value: number) => `₦${value.toLocaleString()}`}
                                />
                                <Bar dataKey="value" name="Spent" radius={[0, 6, 6, 0]}>
                                    {pieData.slice(0, 8).map((entry, i) => (
                                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS['Other']} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <p className="text-sm text-slate-500 italic text-center py-8">
                            Upload a statement to see budget breakdown.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default FinanceManager;
