import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { BrainCircuit, Lock, Mail, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

const Login: React.FC = () => {
  const { signInWithGoogle, signInWithMagicLink } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('uchechukwunnorom2004@gmail.com');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
      setError(null);
      const { error } = await signInWithGoogle();
      if (error) {
          // Check for specific provider error
          if (error.message?.includes('provider is not enabled')) {
              setError("Google Login is disabled in Supabase. Please enable it in the Dashboard or use Email Login below.");
          } else {
              setError(error.message);
          }
      }
  };

  const handleMagicLink = async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      setError(null);
      const { error } = await signInWithMagicLink(email);
      if (error) {
          setError(error.message);
      } else {
          setMagicLinkSent(true);
      }
      setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4 relative overflow-hidden">
       {/* Background Effects */}
       <div className="absolute top-[-10%] left-[20%] w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[100px]"></div>
       <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-blue-900/10 rounded-full blur-[120px]"></div>

      <div className="glass-panel p-8 md:p-12 rounded-3xl w-full max-w-md text-center border-t border-white/10 shadow-2xl relative z-10">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_20px_rgba(79,70,229,0.5)]">
            <BrainCircuit className="text-white w-8 h-8" />
        </div>
        
        <h1 className="text-3xl font-bold text-white mb-3">LifeScope AI</h1>
        <p className="text-slate-400 mb-8">Personal Intelligence & Goal Tracking</p>

        {error && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-6 flex items-start gap-3 text-left">
                <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <p className="text-sm text-red-300">{error}</p>
            </div>
        )}

        {magicLinkSent ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-6 text-center animate-in fade-in zoom-in duration-300">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                <h3 className="text-white font-bold mb-2">Check your inbox</h3>
                <p className="text-slate-400 text-sm">We sent a magic login link to <br/><span className="text-indigo-400">{email}</span></p>
                <button onClick={() => setMagicLinkSent(false)} className="mt-4 text-xs text-slate-500 hover:text-white">Try different email</button>
            </div>
        ) : (
            <div className="space-y-4">
                <button 
                    onClick={handleGoogleLogin}
                    className="w-full bg-white hover:bg-slate-100 text-slate-900 font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02]"
                >
                    <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                    Sign in with Google
                </button>

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-800"></div>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#0f172a] px-2 text-slate-500">Or continue with email</span>
                    </div>
                </div>

                <form onSubmit={handleMagicLink} className="space-y-3">
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="Authorized Email Only"
                            className="w-full bg-slate-900/50 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
                        />
                    </div>
                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all"
                    >
                        {loading ? 'Sending...' : 'Send Magic Link'}
                        {!loading && <ArrowRight className="w-4 h-4" />}
                    </button>
                </form>
                
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-6">
                    <Lock className="w-3 h-3" />
                    <span>Restricted Access: Authorized Personnel Only</span>
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default Login;