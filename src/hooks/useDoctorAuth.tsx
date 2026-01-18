import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { doctorSupabase } from '@/integrations/supabase/doctorClient';

interface DoctorAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const DoctorAuthContext = createContext<DoctorAuthContextType | undefined>(undefined);

export function DoctorAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = doctorSupabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    doctorSupabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await doctorSupabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: 'doctor',
        },
      },
    });
    
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await doctorSupabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await doctorSupabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  return (
    <DoctorAuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
    </DoctorAuthContext.Provider>
  );
}

export function useDoctorAuth() {
  const context = useContext(DoctorAuthContext);
  if (context === undefined) {
    throw new Error('useDoctorAuth must be used within a DoctorAuthProvider');
  }
  return context;
}
