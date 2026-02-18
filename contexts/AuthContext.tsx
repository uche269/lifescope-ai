import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface UserPlanInfo {
  effectivePlan: 'free' | 'pro' | 'premium';
  aiCallsRemaining: number;
  aiCallsLimit: number;
  trialActive: boolean;
  trialDaysLeft: number;
  is_admin: boolean;
}

interface AuthContextType {
  user: any | null;
  planInfo: UserPlanInfo | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithMagicLink: (email: string) => Promise<{ error: any }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  planInfo: null,
  loading: true,
  signOut: async () => { },
  signInWithGoogle: async () => ({ error: null }),
  signInWithMagicLink: async () => ({ error: null }),
  refreshUser: async () => { }
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [planInfo, setPlanInfo] = useState<UserPlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUser = async (session: any | null) => {
    const currentUser = session?.user;
    if (currentUser) {
      setUser(currentUser);
      // Extract plan info from the user object
      setPlanInfo({
        effectivePlan: currentUser.effectivePlan || 'free',
        aiCallsRemaining: currentUser.aiCallsRemaining ?? 0,
        aiCallsLimit: currentUser.aiCallsLimit ?? 0,
        trialActive: currentUser.trialActive ?? false,
        trialDaysLeft: currentUser.trialDaysLeft ?? 0,
        is_admin: currentUser.is_admin ?? false
      });
    } else {
      setUser(null);
      setPlanInfo(null);
    }
    setLoading(false);
  };

  const refreshUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await checkUser(session);
  };

  useEffect(() => {
    // Check active sessions
    supabase.auth.getSession().then(({ data: { session } }) => {
      checkUser(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      checkUser(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setPlanInfo(null);
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    return { error };
  };

  const signInWithMagicLink = async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, planInfo, loading, signOut, signInWithGoogle, signInWithMagicLink, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);