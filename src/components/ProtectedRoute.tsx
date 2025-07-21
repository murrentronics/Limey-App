import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!loading && user) {
      // Fetch profile to check deactivated status
      supabase
        .from('profiles')
        .select('deactivated')
        .eq('user_id', user.id)
        .single()
        .then(({ data }) => {
          if (data?.deactivated) {
            navigate('/deactivated', { replace: true });
          } else {
            setCheckingProfile(false);
          }
        });
    } else if (!loading && !user) {
      navigate('/welcome');
    }
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