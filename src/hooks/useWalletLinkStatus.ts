import { useState, useCallback, useEffect } from "react";
import { getLinkedWallet } from "@/integrations/supabase/client";

export function useWalletLinkStatus(userId) {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: walletError } = await getLinkedWallet(userId);
      
      if (walletError) {
        console.error('Wallet link status error:', walletError);
        // If it's a 406, PGRST116, or table access error, assume not linked
        if (walletError.code === 'PGRST116' || 
            walletError.message?.includes('406') ||
            walletError.message?.includes('Not Acceptable') ||
            walletError.status === 406) {
          console.log('Wallet links table access issue, assuming not linked');
          setLinked(false);
          setError(null); // Don't show error to user for table access issues
        } else {
          setError(walletError.message || "Failed to fetch wallet link status");
          setLinked(false);
        }
      } else {
        setLinked(!!data);
      }
    } catch (err: any) {
      console.error('Exception in wallet link status:', err);
      // For any exception, assume not linked and don't show error
      setLinked(false);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) refresh();
  }, [refresh, userId]);

  return { loading, linked, error, refresh, setLinked };
} 