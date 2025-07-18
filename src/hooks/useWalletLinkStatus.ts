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
      const { data } = await getLinkedWallet(userId);
      setLinked(!!data);
    } catch (err: any) {
      setError(err.message || "Failed to fetch wallet link status");
      setLinked(false);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) refresh();
  }, [refresh, userId]);

  return { loading, linked, error, refresh, setLinked };
} 