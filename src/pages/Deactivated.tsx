import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const Deactivated = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [reactivating, setReactivating] = useState(false);

  const handleReactivate = async () => {
    if (!user) return;
    setReactivating(true);
    await supabase.from('profiles').update({ deactivated: false }).eq('user_id', user.id);
    setReactivating(false);
    navigate('/');
  };

  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background">
      <div className="max-w-md w-full bg-card rounded-lg shadow-lg p-8 flex flex-col items-center">
        <h2 className="text-2xl font-bold mb-4 text-primary">Account Deactivated</h2>
        <p className="text-muted-foreground mb-8 text-center">Your account is currently deactivated. To use Limey, please reactivate your account below.</p>
        <Button onClick={handleReactivate} disabled={reactivating} className="w-full mb-4">
          {reactivating ? 'Reactivating...' : 'Reactivate Account'}
        </Button>
        <Button onClick={signOut} variant="outline" className="w-full">
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default Deactivated; 