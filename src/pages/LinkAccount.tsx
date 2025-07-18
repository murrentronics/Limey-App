import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { linkWallet as linkTTPaypalWallet, getUserLimits } from "@/lib/ttpaypalApi";
import { wpLogin, storeWpToken, clearWpToken } from "@/lib/jwtAuth";
import { useAuth } from "@/hooks/useAuth";
import { linkWallet as linkSupabaseWallet, getLinkedWallet } from "@/integrations/supabase/client";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LinkAccount() {
  const [wpEmail, setWpEmail] = useState("");
  const [wpPassword, setWpPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [alreadyLinked, setAlreadyLinked] = useState(false);
  const [linkedEmail, setLinkedEmail] = useState("");

  useEffect(() => {
    const checkWalletLink = async () => {
      if (user?.id) {
        const { data } = await getLinkedWallet(user.id);
        if (
          data &&
          typeof data === 'object' &&
          !Array.isArray(data) &&
          !('code' in (data as object)) &&
          typeof (data as any).wallet_email === 'string' &&
          Boolean((data as any).wallet_email)
        ) {
          setAlreadyLinked(true);
          setLinkedEmail((data as any).wallet_email);
        } else {
          setAlreadyLinked(false);
          setLinkedEmail("");
        }
      } else {
        setAlreadyLinked(false);
        setLinkedEmail("");
      }
    };
    checkWalletLink();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (user && user.email !== wpEmail) {
        setError("The email address must match your Limey account email address.");
        setLoading(false);
        return;
      }
      
      // 1. Login to WordPress, get JWT
      const wpRes = await wpLogin(wpEmail, wpPassword);
      storeWpToken(wpRes.token);

      // 2. Call wallet link API (requires passcode)
      await linkTTPaypalWallet({ email: wpEmail, password: wpPassword, passcode: "" });

      // 3. Insert wallet link into Supabase wallet_links table
      if (user?.id) {
        const { error: walletLinkError } = await linkSupabaseWallet(user.id, wpEmail);
        if (walletLinkError) {
          if (walletLinkError.code === '23505' || (walletLinkError.message && walletLinkError.message.includes('duplicate key')) ) {
            setError('This wallet email is already linked to another account.');
            setLoading(false);
            return;
          } else {
            setError(walletLinkError.message || 'Failed to link wallet in database');
            setLoading(false);
            return;
          }
        }
      }

      toast({
        title: "Wallet linked successfully!",
        description: "You can now deposit or withdraw.",
      });
      setTimeout(() => {
        navigate("/profile");
      }, 3000);
    } catch (err: any) {
      // Show user-friendly error message
      if (err.message.includes('authentication') || 
          err.message.includes('Invalid') || 
          err.message.includes('credentials') ||
          err.message.includes('Unknown email address') ||
          err.message.includes('Unknown email')) {
        setError("Invalid email address or password");
      } else {
        setError(err.message || "Failed to link wallet");
      }
      clearWpToken();
    } finally {
      setLoading(false);
    }
  };

  if (alreadyLinked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-black/90 p-6 rounded-lg w-full max-w-xs border border-white/10 text-center text-white">
          <h2 className="text-lg font-bold mb-4">Wallet Already Linked</h2>
          <div className="mb-4">Your account is already linked to TTPayPal with email:</div>
          <div className="mb-4 font-semibold">{linkedEmail}</div>
          <Button className="w-full" onClick={() => navigate('/profile')}>Back to Profile</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-black/90 p-6 rounded-lg w-full max-w-xs border border-white/10">
        <h2 className="text-lg font-bold text-white mb-4 text-center">Link TTPayPal Account</h2>
        <Input
          className="w-full mb-4 p-2 rounded bg-white/10 text-white"
          type="email"
          placeholder="TTPayPal Email Address"
          value={wpEmail}
          onChange={e => setWpEmail(e.target.value)}
          required
        />
        <Input
          className="w-full mb-4 p-2 rounded bg-white/10 text-white"
          type="password"
          placeholder="TTPayPal Password"
          value={wpPassword}
          onChange={e => setWpPassword(e.target.value)}
          required
        />
        {error && <div className="text-red-400 mb-2 text-center">{error}</div>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Linking..." : "Link Account"}
        </Button>
        <Button type="button" className="w-full mt-2" variant="ghost" onClick={() => navigate('/profile')}>
          Cancel
        </Button>
      </form>
    </div>
  );
} 