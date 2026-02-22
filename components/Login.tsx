import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BrainCircuit, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, User, Phone, Key } from 'lucide-react';

const Login: React.FC = () => {
    const { signInWithGoogle, signInWithEmail, registerWithEmail } = useAuth();
    const [isLogin, setIsLogin] = useState(true);
    const [isResetting, setIsResetting] = useState(false);
    const [resetStep, setResetStep] = useState<'request' | 'verify'>('request');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Form State
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (isLogin) {
                const { error } = await signInWithEmail(email, password);
                if (error) throw error;
            } else {
                const { error, message } = await registerWithEmail({ email, password, fullName, phone });
                if (error) throw error;
                if (message) {
                    setSuccessMessage(message);
                    setIsLogin(true); // Switch to login view
                    // Clear form
                    setEmail('');
                    setPassword('');
                    setFullName('');
                    setPhone('');
                }
            }
        } catch (err: any) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccessMessage(null);

        try {
            if (resetStep === 'request') {
                const res = await fetch('/api/auth/request-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                setSuccessMessage(data.message);
                setResetStep('verify');
            } else {
                const res = await fetch('/api/auth/verify-reset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, otp, newPassword })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                setSuccessMessage(data.message);
                setIsResetting(false);
                setIsLogin(true);
                setOtp('');
                setNewPassword('');
                setPassword('');
            }
        } catch (err: any) {
            setError(err.message || 'Password reset failed');
        } finally {
            setLoading(false);
        }
    };

    // Handle incoming verification token from URL
    useEffect(() => {
        const verifyEmailToken = async () => {
            const params = new URLSearchParams(window.location.search);
            const token = params.get('verify');
            if (token) {
                setLoading(true);
                try {
                    const res = await fetch('/api/auth/verify', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ token })
                    });
                    const data = await res.json();

                    if (!res.ok) {
                        setError(data.error || 'Verification failed');
                    } else {
                        setSuccessMessage(data.message || 'Email verified! Please log in.');
                    }
                } catch (err) {
                    setError('Network error during verification');
                } finally {
                    setLoading(false);
                    // Clear the token from the URL bar visually without reloading
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }
        };
        verifyEmailToken();
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-900/15 rounded-full blur-[100px] animate-pulse" style={{ animationDuration: '4s' }}></div>
            <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[120px] animate-pulse" style={{ animationDuration: '6s' }}></div>

            <div className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-md border-t border-white/10 shadow-2xl shadow-indigo-500/5 relative z-10 animate-page-enter">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(99,102,241,0.5)]">
                        <BrainCircuit className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold glow-text mb-2">LifeScope AI</h1>
                    <p className="text-slate-400">Personal Intelligence & Goal Tracking</p>
                </div>

                {isResetting ? (
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-white mb-2">Reset Password</h2>
                        <p className="text-sm text-slate-400">
                            {resetStep === 'request'
                                ? "Enter your email and we'll send you a 6-digit reset code."
                                : "Check your email for the code and enter a new password below."}
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Tabs */}
                        <div className="flex bg-slate-900/50 p-1 rounded-xl mb-6 border border-slate-800">
                            <button
                                onClick={() => setIsLogin(true)}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${isLogin ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Sign In
                            </button>
                            <button
                                onClick={() => setIsLogin(false)}
                                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${!isLogin ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                            >
                                Create Account
                            </button>
                        </div>
                    </>
                )}

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 flex items-start gap-3 text-left animate-shake">
                        <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-red-300">{error}</p>
                    </div>
                )}

                {successMessage && (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-6 flex items-start gap-3 text-left animate-fade-in">
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-emerald-300">{successMessage}</p>
                    </div>
                )}

                {!isResetting && (
                    <>
                        <button
                            onClick={signInWithGoogle}
                            className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] mb-6"
                        >
                            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                            {isLogin ? 'Sign in with Google' : 'Sign up with Google'}
                        </button>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-slate-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#0f172a] px-2 text-slate-500">Or continue with email</span>
                            </div>
                        </div>
                    </>
                )}

                {isResetting ? (
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                            <input
                                type="email"
                                required
                                disabled={resetStep === 'verify'}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email Address"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all disabled:opacity-50"
                            />
                        </div>

                        {resetStep === 'verify' && (
                            <>
                                <div className="relative">
                                    <Key className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                                    <input
                                        type="text"
                                        required
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        placeholder="6-Digit Reset Code"
                                        maxLength={6}
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all font-mono tracking-widest"
                                    />
                                </div>
                                <div className="relative">
                                    <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                                    <input
                                        type="password"
                                        required
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        placeholder="New Password"
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transform hover:scale-[1.02]"
                        >
                            {loading ? 'Processing...' : (resetStep === 'request' ? 'Send Reset Code' : 'Set New Password')}
                        </button>

                        <button
                            type="button"
                            onClick={() => {
                                setIsResetting(false);
                                setResetStep('request');
                                setError(null);
                                setSuccessMessage(null);
                            }}
                            className="w-full text-slate-400 hover:text-white text-sm mt-4 transition-colors"
                        >
                            Back to log in
                        </button>
                    </form>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {!isLogin && (
                            <>
                                <div className="relative">
                                    <User className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                                    <input
                                        type="text"
                                        required
                                        value={fullName}
                                        onChange={(e) => setFullName(e.target.value)}
                                        placeholder="Full Name"
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                                    />
                                </div>
                                <div className="relative">
                                    <Phone className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                                    <input
                                        type="tel"
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value)}
                                        placeholder="Phone Number (Optional)"
                                        className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                                    />
                                </div>
                            </>
                        )}

                        <div className="relative">
                            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email Address"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                            />
                        </div>

                        <div className="relative">
                            <Key className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Password"
                                className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"
                            />
                        </div>

                        {isLogin && (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsResetting(true);
                                        setError(null);
                                        setSuccessMessage(null);
                                    }}
                                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(99,102,241,0.2)] hover:shadow-[0_0_30px_rgba(99,102,241,0.4)] transform hover:scale-[1.02]"
                        >
                            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Create Account')}
                            {!loading && <ArrowRight className="w-4 h-4" />}
                        </button>
                    </form>
                )}

                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-6">
                    <Lock className="w-3 h-3" />
                    <span>Secure Encryption · Free 7-day trial</span>
                </div>
            </div>
        </div>
    );
};

export default Login;