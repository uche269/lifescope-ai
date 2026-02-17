import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<{ error: any }>;
  signInWithMagicLink: (email: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => { },
  signInWithGoogle: async () => ({ error: null }),
  signInWithMagicLink: async () => ({ error: null })
});

const ALLOWED_EMAIL = 'uchechukwunnorom2004@gmail.com';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const checkUser = async (session: Session | null) => {
    const currentUser = session?.user;
    if (currentUser) {
      // Backend now handles whitelist check, so we trust the session.
      setUser(currentUser);
    } else {
      setUser(null);
    }
    setLoading(false);
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
    if (email !== ALLOWED_EMAIL) {
      return { error: { message: "Access Denied: This email is not authorized." } };
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin
      }
    });
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, loading, signOut, signInWithGoogle, signInWithMagicLink }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);