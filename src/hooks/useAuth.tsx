import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
// import { sessionManager } from '@/lib/sessionManager';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signUp: (email: string, password: string, username: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();

  const checkAdminStatus = async (userId: string) => {
    try {
      // Use a timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Admin check timeout')), 2000)
      );
      
      const queryPromise = supabase
        .from('profiles')
        .select('is_admin')
        .eq('user_id', userId)
        .single();
      
      const { data, error } = await Promise.race([queryPromise, timeoutPromise]) as any;
      
      if (!error && data) {
        setIsAdmin(data.is_admin || false);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      // Silently fail and default to false
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    // Set a shorter timeout to prevent infinite loading (3 seconds)
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Check admin status when user changes (non-blocking)
        if (session?.user) {
          checkAdminStatus(session.user.id).catch(() => {
            // Silently handle admin check errors
            setIsAdmin(false);
          });
        } else {
          setIsAdmin(false);
        }
        
        clearTimeout(loadingTimeout);
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      // Check admin status for existing session (non-blocking)
      if (session?.user) {
        checkAdminStatus(session.user.id).catch(() => {
          // Silently handle admin check errors
          setIsAdmin(false);
        });
      } else {
        setIsAdmin(false);
      }
      
      clearTimeout(loadingTimeout);
      setLoading(false);
    }).catch(() => {
      clearTimeout(loadingTimeout);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      clearTimeout(loadingTimeout);
    };
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
      // Add timeout to prevent hanging
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const res = await fetch('https://theronm18.sg-host.com/wp-json/jwt-auth/v1/token', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ username: email, password }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (res.ok) {
        const data = await res.json();
        
        if (data.token) {
          localStorage.setItem('wp_jwt_token', data.token);
          localStorage.setItem('wp_jwt_validated', 'true');
          localStorage.setItem('wp_jwt_validation_time', Date.now().toString());
          console.log('WordPress JWT token stored successfully');
          return true; // JWT validation successful
        }
      }
      
      // Clear tokens on failure
      localStorage.removeItem('wp_jwt_token');
      localStorage.removeItem('wp_jwt_validated');
      localStorage.removeItem('wp_jwt_validation_time');
      console.warn('WordPress JWT token fetch failed');
      return false; // JWT validation failed
      
    } catch (err) {
      console.error('WordPress JWT token fetch error:', err);
      localStorage.removeItem('wp_jwt_token');
      localStorage.removeItem('wp_jwt_validated');
      localStorage.removeItem('wp_jwt_validation_time');
      return false; // JWT validation failed
    }
  }



  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (!error) {
      // Fetch and store the WordPress JWT token after successful Supabase login
      try {
        const jwtSuccess = await fetchWpJwtToken(email, password);
        if (!jwtSuccess) {
          console.warn('WordPress JWT token could not be obtained, wallet features may not work');
        } else {
          // AUTO-SYNC: Sync balance to WordPress after successful login
          try {
            const { fixWordPressBalance, getTrincreditsBalance } = await import('@/lib/trinepayApi');
            // Get the user ID from the session that was just created
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
              const syncResult = await fixWordPressBalance(session.user.id);
              console.log('Auto-synced data to WordPress after login:', syncResult);
            }
          } catch (syncError) {
            console.warn('Auto-sync after login failed:', syncError);
            // Don't fail login if sync fails
          }
        }
      } catch (err) {
        console.error('JWT token fetch failed:', err);
        // Clear any existing tokens on failure
        localStorage.removeItem('wp_jwt_token');
        localStorage.removeItem('wp_jwt_validated');
        localStorage.removeItem('wp_jwt_validation_time');
      }
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
      localStorage.removeItem('wp_jwt_validated');
      localStorage.removeItem('wp_jwt_validation_time');
      setUser(null);
      setSession(null);
      if (error) {
        toast({
          title: "Signed out",
          description: "You have been signed out (session was already missing).",
          className: "bg-green-600 text-white border-green-700"
        });
      } else {
        toast({
          description: "You have been signed out successfully.",
          className: "bg-green-600 text-white border-green-700",
          duration: 3000
        });
      }
    } catch (error) {
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
    isAdmin,
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