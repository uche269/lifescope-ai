import React, { useState, useEffect } from 'react';
import {
    CheckCircle2, ShieldCheck, User, Palette,
    Sun, Moon, LogOut, Trash2, Sparkles, Bell, Mail, Save, Loader2
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

const Settings: React.FC = () => {
    const { user, planInfo, signOut } = useAuth();
    const { theme, setTheme } = useTheme();

    // Active section
    const [activeSection, setActiveSection] = useState<'profile' | 'appearance' | 'notifications' | 'account'>('profile');

    // Notification preferences
    const [notifications, setNotifications] = useState({
        goalReminders: true,
        trialExpiry: true,
        weeklyDigest: false,
        aiInsights: true
    });

    // Delete confirmation
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [testEmailLoading, setTestEmailLoading] = useState(false);
    const [testEmailSuccess, setTestEmailSuccess] = useState<boolean | null>(null);
    const [deleteInput, setDeleteInput] = useState('');
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [saved, setSaved] = useState(false);
    const [upgradeLoading, setUpgradeLoading] = useState(false);

    useEffect(() => {
        const savedNotifs = localStorage.getItem('ls_notifications');
        if (savedNotifs) {
            try { setNotifications(JSON.parse(savedNotifs)); } catch { }
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('ls_notifications', JSON.stringify(notifications));
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    const handleMigrate = async () => {
        if (!confirm("This will attempt to recover data linked to previous versions of your account. Continue?")) return;
        try {
            const res = await api.post('auth/migrate-legacy-data', {});
            alert(`Migration Complete!\nRecovered:\n` + JSON.stringify(res.migrated, null, 2));
            window.location.reload();
        } catch (e: any) {
            alert("Migration failed: " + e.message);
        }
    };

    const handleTestEmail = async () => {
        setTestEmailLoading(true);
        setTestEmailSuccess(null);
        try {
            const res = await api.post('/auth/test-email');
            if (res.data.success) {
                setTestEmailSuccess(true);
                setTimeout(() => setTestEmailSuccess(null), 5000);
            } else {
                setTestEmailSuccess(false);
            }
        } catch (err) {
            console.error(err);
            setTestEmailSuccess(false);
        } finally {
            setTestEmailLoading(false);
        }
    };

    const handleDeleteAccount = async () => {
        setDeleteLoading(true);
        try {
            await api.delete('auth/me', '');
            await signOut(); // Force logout and wipe context
        } catch (e: any) {
            alert("Delete failed: " + e.message);
            setDeleteLoading(false);
        }
    };

    const handlePurchase = async (planId: string, amount: number) => {
        setUpgradeLoading(true);
        try {
            // Amount is in Naira. Adjust based on your pricing. 
            const res = await api.post('/payment/initialize', { planId, amount });
            if (res.data.checkoutUrl) {
                window.location.href = res.data.checkoutUrl; // Redirect to Paystack
            } else {
                alert("Failed to initiate payment checkout.");
            }
        } catch (e: any) {
            console.error(e);
            alert("Checkout Error: " + (e.response?.data?.error || e.message));
        } finally {
            setUpgradeLoading(false);
        }
    };

    const sections = [
        { id: 'profile' as const, label: 'Profile', icon: User },
        { id: 'appearance' as const, label: 'Appearance', icon: Palette },
        { id: 'notifications' as const, label: 'Notifications', icon: Bell },
        { id: 'account' as const, label: 'Account', icon: ShieldCheck },
    ];

    return (
        <div className="space-y-6 animate-page-enter">
            <header>
                <h2 className="text-2xl font-bold text-white mb-1">Settings</h2>
                <p className="text-slate-400 text-sm">Manage your account, appearance, and preferences.</p>
            </header>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Settings Sidebar */}
                <div className="lg:w-56 flex lg:flex-col gap-1 overflow-x-auto pb-2 lg:pb-0">
                    {sections.map(s => (
                        <button
                            key={s.id}
                            onClick={() => setActiveSection(s.id)}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all whitespace-nowrap ${activeSection === s.id
                                ? 'bg-indigo-600 text-white'
                                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                                }`}
                        >
                            <s.icon className="w-4 h-4 flex-shrink-0" />
                            {s.label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 max-w-2xl">

                    {/* ======================== PROFILE ======================== */}
                    {activeSection === 'profile' && (
                        <div className="glass-panel rounded-2xl p-8 space-y-6">
                            <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
                                <div className="p-3 bg-indigo-500/10 rounded-xl">
                                    <User className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Profile</h3>
                                    <p className="text-xs text-slate-500">Your account details</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-2xl font-bold text-white">
                                    {user?.user_metadata?.full_name?.[0] || user?.email?.[0]?.toUpperCase() || '?'}
                                </div>
                                <div>
                                    <p className="text-lg font-semibold text-white">
                                        {user?.user_metadata?.full_name || 'LifeScope User'}
                                    </p>
                                    <p className="text-sm text-slate-400">{user?.email || 'No email'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-slate-900 rounded-xl p-4">
                                    <p className="text-xs text-slate-500 mb-1">Plan</p>
                                    <p className="text-sm font-semibold text-white capitalize">
                                        {planInfo?.effectivePlan || 'Free'} Plan
                                    </p>
                                </div>
                                <div className="bg-slate-900 rounded-xl p-4">
                                    <div className="flex justify-between items-center mb-1">
                                        <p className="text-xs text-slate-500">AI Weekly Quota</p>
                                        {((planInfo as any)?.topupCredits || 0) > 0 && (
                                            <span className="text-xs font-bold text-emerald-400 font-mono">+{((planInfo as any)?.topupCredits)} Top-up remaining</span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-slate-800 rounded-full h-2">
                                            <div
                                                className="bg-indigo-500 rounded-full h-2 transition-all"
                                                style={{
                                                    width: `${Math.min(100, Math.max(0, (planInfo?.aiCallsLimit || 10) - ((planInfo?.aiCallsRemaining || 0) - ((planInfo as any)?.topupCredits || 0))) / (planInfo?.aiCallsLimit || 10) * 100)}%`
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs text-slate-400">
                                            Weekly: {Math.max(0, ((planInfo?.aiCallsRemaining || 0) - ((planInfo as any)?.topupCredits || 0)))}/{planInfo?.aiCallsLimit || 20}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* --- PLAN COMPARISON TABLE --- */}
                            <div className="mt-8">
                                <h4 className="text-white font-bold mb-4">Choose Your Plan</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                                    {/* Free Tier */}
                                    <div className={`rounded-xl p-5 border ${planInfo?.effectivePlan === 'free' ? 'bg-slate-800/80 border-indigo-500/50 relative' : 'bg-slate-900 border-slate-700'}`}>
                                        {planInfo?.effectivePlan === 'free' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">CURRENT</div>}
                                        <p className="text-sm font-bold text-white">Free</p>
                                        <p className="text-2xl font-black text-white my-2">₦0<span className="text-xs text-slate-500 font-normal">/mo</span></p>
                                        <ul className="text-xs text-slate-400 space-y-2 mb-4">
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-400" /> 20 AI Credits / wk</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-400" /> Standard AI Model</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-400" /> Basic Tracking</li>
                                        </ul>
                                    </div>

                                    {/* Premium Tier */}
                                    <div className={`rounded-xl p-5 border ${planInfo?.effectivePlan === 'premium' ? 'bg-indigo-900/40 border-indigo-400 relative' : 'bg-slate-900 border-slate-700'}`}>
                                        {planInfo?.effectivePlan === 'premium' && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">CURRENT</div>}
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-white">Premium</p>
                                            <Sparkles className="w-4 h-4 text-indigo-400" />
                                        </div>
                                        <p className="text-2xl font-black text-white my-2">₦5,000<span className="text-xs text-slate-500 font-normal">/mo</span></p>
                                        <ul className="text-xs text-slate-400 space-y-2 mb-4">
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-400" /> 200 AI Credits / wk</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-400" /> Higher Quality Model</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-indigo-400" /> Deep Health Insights</li>
                                        </ul>
                                        {planInfo?.effectivePlan !== 'premium' && planInfo?.effectivePlan !== 'pro' && planInfo?.effectivePlan !== 'admin' && (
                                            <button
                                                onClick={() => handlePurchase('premium', 5000)}
                                                disabled={upgradeLoading}
                                                className="w-full text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 py-2 rounded-lg transition-colors"
                                            >
                                                {upgradeLoading ? 'Processing...' : 'Upgrade Premium'}
                                            </button>
                                        )}
                                    </div>

                                    {/* Pro Tier */}
                                    <div className={`rounded-xl p-5 border relative overflow-hidden ${planInfo?.effectivePlan === 'pro' || planInfo?.effectivePlan === 'admin' ? 'bg-purple-900/40 border-purple-400' : 'bg-slate-900 border-slate-700'}`}>
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-gradient-to-br from-purple-500/20 to-transparent blur-xl" />
                                        {(planInfo?.effectivePlan === 'pro' || planInfo?.effectivePlan === 'admin') && <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">CURRENT</div>}
                                        <div className="flex justify-between items-start">
                                            <p className="text-sm font-bold text-white">Pro</p>
                                            <Sparkles className="w-4 h-4 text-purple-400" />
                                        </div>
                                        <p className="text-2xl font-black text-white my-2">₦10,000<span className="text-xs text-slate-500 font-normal">/mo</span></p>
                                        <ul className="text-xs text-slate-400 space-y-2 mb-4">
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-purple-400" /> 500 AI Credits / wk</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-purple-400" /> Latest Reasoning Engine</li>
                                            <li className="flex items-center gap-2"><CheckCircle2 className="w-3 h-3 text-purple-400" /> Perfect Generated Charts</li>
                                        </ul>
                                        {planInfo?.effectivePlan !== 'pro' && planInfo?.effectivePlan !== 'admin' && (
                                            <button
                                                onClick={() => handlePurchase('pro', 10000)}
                                                disabled={upgradeLoading}
                                                className="w-full text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 py-2 rounded-lg transition-colors"
                                            >
                                                {upgradeLoading ? 'Processing...' : 'Upgrade Pro'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Topup Card Moved Below */}
                                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-4 flex items-center justify-between gap-4 mt-4">
                                    <div>
                                        <p className="text-sm font-bold text-white mb-1">Buy Extra AI Top-Up</p>
                                        <p className="text-xs text-slate-400">
                                            Need a quick boost? Get 500 Non-Expiring AI Credits. Only consumed after your weekly limit ends.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => handlePurchase('topup', 2000)}
                                        disabled={upgradeLoading}
                                        className="shrink-0 text-xs font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 px-4 py-2 rounded-lg transition-colors"
                                    >
                                        {upgradeLoading ? '...' : 'Buy Pack (₦2,000)'}
                                    </button>
                                </div>
                            </div>


                            <div className="bg-slate-900/50 rounded-xl p-4 text-xs text-slate-500">
                                <p>Member since {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'recently'}</p>
                                <p className="mt-1">LifeScope is currently free during our feedback phase. Enjoy all features!</p>
                            </div>
                        </div>
                    )}

                    {/* ======================== APPEARANCE ======================== */}
                    {activeSection === 'appearance' && (
                        <div className="glass-panel rounded-2xl p-8 space-y-6">
                            <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
                                <div className="p-3 bg-indigo-500/10 rounded-xl">
                                    <Palette className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Appearance</h3>
                                    <p className="text-xs text-slate-500">Customize how LifeScope looks</p>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-4">Theme</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Dark Theme Card */}
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`relative rounded-xl p-4 border-2 transition-all ${theme === 'dark'
                                            ? 'border-indigo-500 bg-indigo-500/10'
                                            : 'border-slate-700 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 bg-slate-950 rounded-lg flex items-center justify-center border border-slate-700">
                                                <Moon className="w-5 h-5 text-indigo-400" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-semibold text-white">Dark</p>
                                                <p className="text-xs text-slate-500">Easy on the eyes</p>
                                            </div>
                                        </div>
                                        {/* Mini preview */}
                                        <div className="bg-slate-950 rounded-lg p-2 space-y-1.5">
                                            <div className="h-2 bg-slate-800 rounded w-3/4" />
                                            <div className="h-2 bg-slate-800 rounded w-1/2" />
                                            <div className="h-2 bg-indigo-600 rounded w-1/3" />
                                        </div>
                                        {theme === 'dark' && (
                                            <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-indigo-400" />
                                        )}
                                    </button>

                                    {/* Light Theme Card */}
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`relative rounded-xl p-4 border-2 transition-all ${theme === 'light'
                                            ? 'border-indigo-500 bg-indigo-500/10'
                                            : 'border-slate-700 hover:border-slate-600'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-3">
                                            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center border border-gray-200">
                                                <Sun className="w-5 h-5 text-amber-500" />
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm font-semibold text-white">Light</p>
                                                <p className="text-xs text-slate-500">Clean and bright</p>
                                            </div>
                                        </div>
                                        {/* Mini preview */}
                                        <div className="bg-gray-100 rounded-lg p-2 space-y-1.5">
                                            <div className="h-2 bg-gray-300 rounded w-3/4" />
                                            <div className="h-2 bg-gray-300 rounded w-1/2" />
                                            <div className="h-2 bg-indigo-500 rounded w-1/3" />
                                        </div>
                                        {theme === 'light' && (
                                            <CheckCircle2 className="absolute top-3 right-3 w-5 h-5 text-indigo-400" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}


                    {/* ======================== NOTIFICATIONS ======================== */}
                    {activeSection === 'notifications' && (
                        <div className="glass-panel rounded-2xl p-8 space-y-6">
                            <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
                                <div className="p-3 bg-indigo-500/10 rounded-xl">
                                    <Bell className="w-6 h-6 text-indigo-400" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-white">Notifications</h3>
                                    <p className="text-xs text-slate-500">Control which alerts and reminders you receive</p>
                                </div>
                            </div>

                            {[
                                { key: 'goalReminders' as const, label: 'Goal Reminders', desc: 'Get notified when goal deadlines approach', icon: Bell, comingSoon: false },
                                { key: 'trialExpiry' as const, label: 'Trial & Plan Alerts', desc: 'Notifications about trial expiry and plan changes', icon: ShieldCheck, comingSoon: false },
                                { key: 'weeklyDigest' as const, label: 'Weekly Digest Email', desc: 'Receive a weekly summary of your progress via email', icon: Mail, comingSoon: true },
                                { key: 'aiInsights' as const, label: 'AI Insights', desc: 'Proactive health and finance suggestions powered by AI', icon: Sparkles, comingSoon: true }
                            ].map(notif => (
                                <div key={notif.key} className="flex items-center justify-between py-3">
                                    <div className="flex items-center gap-3">
                                        <notif.icon className="w-5 h-5 text-slate-400" />
                                        <div>
                                            <p className="text-sm font-medium text-white flex items-center gap-2">
                                                {notif.label}
                                                {notif.comingSoon && (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400 rounded-full font-semibold">Coming Soon</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-slate-500">{notif.desc}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => !notif.comingSoon && setNotifications(prev => ({ ...prev, [notif.key]: !prev[notif.key] }))}
                                        className={`relative w-12 h-7 rounded-full transition-colors ${notif.comingSoon ? 'opacity-40 cursor-not-allowed' : ''} ${notifications[notif.key]
                                            ? 'bg-indigo-600'
                                            : 'bg-slate-700'
                                            }`}
                                    >
                                        <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${notifications[notif.key]
                                            ? 'translate-x-6'
                                            : 'translate-x-1'
                                            }`} />
                                    </button>
                                </div>
                            ))}

                            <button
                                onClick={handleSave}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
                            >
                                {saved ? (
                                    <><CheckCircle2 className="w-5 h-5" /> Saved</>
                                ) : (
                                    <><Save className="w-5 h-5" /> Save Preferences</>
                                )}
                            </button>
                        </div>
                    )}

                    {/* ======================== ACCOUNT ======================== */}
                    {activeSection === 'account' && (
                        <div className="space-y-6">
                            <div className="glass-panel rounded-2xl p-8 space-y-6">
                                <div className="flex items-center gap-3 pb-6 border-b border-slate-800">
                                    <div className="p-3 bg-indigo-500/10 rounded-xl">
                                        <ShieldCheck className="w-6 h-6 text-indigo-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-white">Account</h3>
                                        <p className="text-xs text-slate-500">Manage your account and session</p>
                                    </div>
                                </div>

                                {/* Data Security & Privacy */}
                                <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-5">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-emerald-500/20 rounded-lg shrink-0">
                                            <ShieldCheck className="w-5 h-5 text-emerald-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white mb-1">Your Data is Private & Secure</p>
                                            <p className="text-xs text-slate-400 leading-relaxed">
                                                LifeScope operates on a private, encrypted Hostinger Virtual Private Server (VPS).
                                                You own 100% of your data. We do not sell or share your personal information with third-party advertisers,
                                                and AI usage is securely isolated to protect your identity.
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Export Data */}
                                <div className="bg-slate-900 rounded-xl p-5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-white">Export Your Data</p>
                                            <p className="text-xs text-slate-500 mt-1 max-w-sm">
                                                Download a complete copy of all your LifeScope data — goals, health logs, finance records,
                                                and chat history — as a JSON file for your personal records.
                                            </p>
                                        </div>
                                        <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-medium transition-colors">
                                            Export
                                        </button>
                                    </div>
                                </div>


                                {/* Legacy Migration */}
                                <div className="bg-slate-900 rounded-xl p-5 border border-indigo-500/30">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm font-medium text-white flex items-center gap-2">
                                                <Sparkles className="w-4 h-4 text-indigo-400" />
                                                Recover Legacy Data
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1 max-w-sm">
                                                If you originally used LifeScope before our migration to a new database, this will
                                                attempt to recover your old goals, activities, and health data from the previous system.
                                                You only need to use this once after the migration.
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleMigrate}
                                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            Recover Data
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Danger Zone */}
                            <div className="glass-panel rounded-2xl p-8 border-red-500/20">
                                <h4 className="text-sm font-bold text-red-400 mb-4">Danger Zone</h4>
                                <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-5">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-sm font-medium text-white">Delete Account</p>
                                            <p className="text-xs text-slate-500 mt-1">
                                                Permanently delete your account and all associated data. This action cannot be undone.
                                            </p>
                                        </div>
                                        {!showDeleteConfirm ? (
                                            <button
                                                onClick={() => setShowDeleteConfirm(true)}
                                                className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                                            >
                                                <Trash2 className="w-4 h-4" /> Delete
                                            </button>
                                        ) : (
                                            <div className="flex flex-col gap-2 items-end">
                                                <input
                                                    type="text"
                                                    placeholder="Type DELETE to confirm"
                                                    value={deleteInput}
                                                    onChange={e => setDeleteInput(e.target.value)}
                                                    className="bg-slate-900 border border-red-500/30 rounded-lg px-3 py-2 text-sm text-white w-48 focus:outline-none"
                                                />
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => { setShowDeleteConfirm(false); setDeleteInput(''); }}
                                                        className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        disabled={deleteInput !== 'DELETE' || deleteLoading}
                                                        onClick={handleDeleteAccount}
                                                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-30 text-white rounded-lg text-xs font-medium transition-colors"
                                                    >
                                                        {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div >
        </div >
    );
};

export default Settings;