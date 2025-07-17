import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getLinkedWallet, supabase } from "@/integrations/supabase/client";
import { unlinkWallet } from "@/lib/ttpaypalApi";

export default function WalletModal({ open, onClose }: { open: boolean; onClose: () => void; }) {
  const [linked, setLinked] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (open && user) {
      setLoading(true);
      getLinkedWallet(user.id)
        .then(({ data }) => {
          setLinked(!!(data && data.wallet_email));
        })
        .finally(() => setLoading(false));
    }
  }, [open, user]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
      <div className="bg-black rounded-lg p-6 w-full max-w-xs shadow-lg border border-white/10">
        <h2 className="text-lg font-bold text-white mb-4 text-center">Wallet</h2>
        {loading ? (
          <div className="text-center text-white">Loading...</div>
        ) : linked ? (
          <div className="flex flex-col gap-3">
            <Button onClick={() => { onClose(); navigate('/wallet'); }} className="w-full">
              Go To Wallet
            </Button>
            <Button
              onClick={async () => {
                await unlinkWallet();
                setLinked(false);
              }}
              className="w-full"
              variant="destructive"
            >
              Unlink Wallet
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <Button onClick={() => { onClose(); navigate('/wallet/link'); }} className="w-full">
              Link TTPayPal Wallet
            </Button>
          </div>
        )}
        <Button onClick={onClose} className="w-full mt-4" variant="ghost">
          Cancel
        </Button>
      </div>
    </div>
  );
}