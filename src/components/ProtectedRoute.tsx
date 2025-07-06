import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    console.log("ProtectedRoute - loading:", loading, "user:", !!user, "user email:", user?.email);
    if (!loading && !user) {
      console.log("Redirecting to welcome page");
      navigate('/welcome');
    }
  }, [user, loading, navigate]);

  if (loading) {
    console.log("ProtectedRoute - showing loading spinner");
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    console.log("ProtectedRoute - no user, returning null");
    return null;
  }

  console.log("ProtectedRoute - rendering children");
  return <>{children}</>;
};

export default ProtectedRoute;