import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getWalletStatus, unlinkWallet, getTrincreditsBalance } from "@/lib/ttpaypalApi";
import { supabase } from "@/integrations/supabase/client";
import { getLinkedWallet } from '@/integrations/supabase/client';

export default function WalletModal({ open, onClose, refreshKey }: { open: boolean; onClose: () => void; refreshKey?: number }) {
  const [loading, setLoading] = useState(true);
  const [linked, setLinked] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkedElsewhere, setLinkedElsewhere] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      setError(null);
      // Get wallet link status from Supabase and TriniCredits balance
      Promise.all([
        getLinkedWallet(user.id),
        getTrincreditsBalance(user.id)
      ])
        .then(([walletRes, triniCreditsBalance]) => {
          setLinked(!!(walletRes.data && walletRes.data.wallet_email));
          setBalance(triniCreditsBalance);
          setLinkedElsewhere(false); // Not needed with Supabase-only logic
        })
        .catch((err) => {
          setError(err.message || 'Failed to fetch wallet status');
        })
        .finally(() => setLoading(false));
    }
  }, [open, user, refreshKey]);

  const handleUnlink = async () => {
    setUnlinking(true);
    setError(null);
    try {
      // Unlink from TTPayPal
      await unlinkWallet();
      
      // No need to update Supabase profile, ttpaypal_limits column does not exist
      
      // Update local state
      setLinked(false);
      setBalance(null);
      setLinkedElsewhere(false);
      setUnlinking(false);
      
      // Close the modal
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to unlink wallet');
      setUnlinking(false);
    }
  };

  if (!open) return null;

  // Replace WordPress with TTPayPal in error messages
  const displayError = error?.replace(/WordPress/gi, 'TTPayPal');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="bg-black rounded-lg p-6 w-full max-w-xs shadow-lg border border-white/10">
        <h2 className="text-lg font-bold text-white mb-4 text-center">TTPayPal Wallet</h2>
        {loading ? (
          <div className="text-center text-white">Loading...</div>
        ) : linked ? (
          <>
            {linkedElsewhere && (
              <div className="text-center text-red-400 font-semibold mb-2">
                This wallet is already linked to another Limey account.
              </div>
            )}
            {balance !== null && (
              <div className="text-center text-green-400 font-semibold mb-4">
                TriniCredits: TT${balance.toFixed(2)}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <Button onClick={() => { onClose(); navigate('/wallet/deposit'); }} className="w-full">
                Deposit
              </Button>
              <Button onClick={() => { onClose(); navigate('/wallet/withdraw'); }} className="w-full" variant="outline">
                Withdraw
              </Button>
            </div>
            <Button onClick={handleUnlink} className="w-full mt-4" variant="destructive" disabled={unlinking}>
              {unlinking ? 'Unlinking...' : 'Unlink Account'}
            </Button>
          </>
        ) : (
          <Button onClick={() => { onClose(); navigate('/wallet/link'); }} className="w-full">
            Link Account
          </Button>
        )}
        {displayError && <div className="text-red-400 text-center mt-2">{displayError}</div>}
        <Button onClick={onClose} className="w-full mt-4" variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
} 