import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    console.log("Setting up auth state listener");
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state change:", event, "Session:", !!session, "User:", session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("Initial session check:", !!session, "User:", session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, username: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          username,
          display_name: username
        }
      }
    });

    if (error) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Check your email",
        description: "We sent you a confirmation link to complete your sign up.",
        className: "bg-green-600 text-white border-green-700"
      });
    }

    return { error };
  };

  // Add this function to fetch and store the WordPress JWT token
  async function fetchWpJwtToken(email: string, password: string) {
    try {
      const res = await fetch('https://ttpaypal.com/wp-json/jwt-auth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('wp_jwt_token', data.token);
        console.log('WordPress JWT token set:', data.token);
      } else {
        localStorage.removeItem('wp_jwt_token');
        console.error('No WordPress JWT token received:', data);
      }
    } catch (err) {
      localStorage.removeItem('wp_jwt_token');
      console.error('Error fetching WordPress JWT token:', err);
    }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error) {
      // Fetch and store the WordPress JWT token after successful Supabase login
      await fetchWpJwtToken(email, password);
    }

    if (error) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive"
      });
    }

    return { error };
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      localStorage.removeItem('wp_jwt_token');
      if (error) {
        console.error('Sign out error:', error);
        toast({
          title: "Sign out failed",
          description: error.message,
          variant: "destructive"
        });
      } else {
        // Clear local state even if server signout fails
        setUser(null);
        setSession(null);
        toast({
          title: "Signed out successfully",
          description: "You have been signed out",
          className: "bg-green-600 text-white border-green-700"
        });
      }
    } catch (error) {
      console.error('Sign out exception:', error);
      // Clear local state even if there's an error
      setUser(null);
      setSession(null);
      toast({
        title: "Signed out",
        description: "You have been signed out (local session cleared)",
        className: "bg-green-600 text-white border-green-700"
      });
    }
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};