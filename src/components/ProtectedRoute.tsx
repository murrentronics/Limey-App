import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const profileCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (profileCheckTimeoutRef.current) {
      clearTimeout(profileCheckTimeoutRef.current);
    }

    if (!loading && user) {
      // Set a shorter timeout to prevent infinite loading (2 seconds)
      const timeout = setTimeout(() => {
        setCheckingProfile(false);
      }, 2000);
      profileCheckTimeoutRef.current = timeout;

      // Fetch profile to check deactivated status with proper error handling
      supabase
        .from('profiles')
        .select('deactivated')
        .eq('user_id', user.id)
        .single()
        .then(({ data, error }) => {
          // Clear the timeout since we got a response
          if (profileCheckTimeoutRef.current) {
            clearTimeout(profileCheckTimeoutRef.current);
            profileCheckTimeoutRef.current = null;
          }

          if (error) {
            // If we can't check the profile, allow access
            setCheckingProfile(false);
          } else if (data?.deactivated) {
            navigate('/deactivated', { replace: true });
          } else {
            setCheckingProfile(false);
          }
        })
        .catch(() => {
          // Clear the timeout since we got an error
          if (profileCheckTimeoutRef.current) {
            clearTimeout(profileCheckTimeoutRef.current);
            profileCheckTimeoutRef.current = null;
          }

          // If there's an error, allow access
          setCheckingProfile(false);
        });
    } else if (!loading && !user) {
      navigate('/welcome');
    }

    // Cleanup function
    return () => {
      if (profileCheckTimeoutRef.current) {
        clearTimeout(profileCheckTimeoutRef.current);
      }
    };
  }, [user, loading, navigate]);

  if (loading || checkingProfile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;