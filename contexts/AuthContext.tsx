import React, { createContext, useContext, useEffect, useState } from 'react';

// Always use relative path — frontend and backend are co-hosted on the same server
const API_URL = '/api';

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
  signInWithGoogle: () => void;
  signInWithEmail: (email: string, password: string) => Promise<{ error: any }>;
  registerWithEmail: (data: any) => Promise<{ error: any, message?: string }>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  planInfo: null,
  loading: true,
  signOut: async () => { },
  signInWithGoogle: () => { },
  signInWithEmail: async () => ({ error: null }),
  registerWithEmail: async () => ({ error: null }),
  refreshUser: async () => { }
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [planInfo, setPlanInfo] = useState<UserPlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUser = async () => {
    try {
      const res = await fetch(`${API_URL}/auth/me`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        const u = data.user;
        setUser(u);
        // Plan info is embedded in the user object from /auth/me
        if (u) {
          setPlanInfo({
            effectivePlan: u.effectivePlan || 'free',
            aiCallsRemaining: u.aiCallsRemaining ?? 0,
            aiCallsLimit: u.aiCallsLimit ?? 10,
            trialActive: u.trialActive ?? false,
            trialDaysLeft: u.trialDaysLeft ?? 0,
            is_admin: u.is_admin ?? false
          });
        }
      } else {
        setUser(null);
        setPlanInfo(null);
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setUser(null);
      setPlanInfo(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  const refreshUser = async () => {
    await checkUser();
  };

  const signOut = async () => {
    try {
      await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' });
      setUser(null);
      setPlanInfo(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const signInWithGoogle = () => {
    // Redirect to backend Google Auth
    window.location.href = `${API_URL}/auth/google`;
  };

  const signInWithEmail = async (email: string, password: string) => {
    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        return { error: { message: data.error || 'Login failed' } };
      }

      setUser(data.user);
      // Refresh to get plan info
      await checkUser();
      return { error: null };
    } catch (error: any) {
      return { error: { message: error.message || 'Network error' } };
    }
  };

  const registerWithEmail = async (formData: any) => {
    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await res.json();

      if (!res.ok) {
        return { error: { message: data.error || 'Registration failed' } };
      }

      // Do NOT set user or auto-login. Expect them to verify email.
      return { error: null, message: data.message };
    } catch (error: any) {
      return { error: { message: error.message || 'Network error' } };
    }
  };

  return (
    <AuthContext.Provider value={{ user, planInfo, loading, signOut, signInWithGoogle, signInWithEmail, registerWithEmail, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);