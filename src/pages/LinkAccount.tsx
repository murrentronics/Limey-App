import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { linkWallet as linkTTPaypalWallet, getUserLimits } from "@/lib/ttpaypalApi";
import { wpLogin, storeWpToken, clearWpToken } from "@/lib/jwtAuth";
import { useAuth } from "@/hooks/useAuth";
import { linkWallet as linkSupabaseWallet, getLinkedWallet } from "@/integrations/supabase/client";
import { useWalletLinkStatus } from "@/hooks/useWalletLinkStatus";
import { isJwtValidated, getJwtValidationInfo } from "@/utils/jwtValidation";

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
  const { loading: statusLoading, linked, refresh } = useWalletLinkStatus(user?.id);
  const [alreadyLinked, setAlreadyLinked] = useState(false);
  const [linkedEmail, setLinkedEmail] = useState("");
  const [jwtValidated, setJwtValidated] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  useEffect(() => {
    const checkWalletLink = async () => {
      if (user?.id) {
        const { data } = await getLinkedWallet(user.id);
        if (data) {
          setAlreadyLinked(true);
          setLinkedEmail(''); // No wallet_email column
        } else {
          setAlreadyLinked(false);
          setLinkedEmail("");
        }
      }
    };
    
    // Check JWT validation status
    const checkJwtValidation = () => {
      const validated = isJwtValidated();
      setJwtValidated(validated);
      setShowPasswordForm(!validated);
      
      // Debug info
      console.log('JWT Validation Info:', getJwtValidationInfo());
      console.log('JWT Validated:', validated);
    };
    
    checkWalletLink();
    checkJwtValidation();
  }, [user]);

  const handleQuickLink = async () => {
    if (!jwtValidated) {
      setError("Authentication required. Please enter your TTPayPal credentials.");
      setShowPasswordForm(true);
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (linked) {
        setError("You are already linked.");
        setLoading(false);
        return;
      }

      // Use stored JWT token for quick linking
      const storedToken = localStorage.getItem('wp_jwt_token');
      if (!storedToken) {
        setError("Authentication expired. Please enter your credentials.");
        setShowPasswordForm(true);
        setLoading(false);
        return;
      }

      // 2. Call wallet link API using stored credentials (no password needed)
      await linkTTPaypalWallet({ email: user?.email || '', password: '', passcode: "" });

      // 3. Insert wallet link into Supabase wallet_links table
      if (user?.id) {
        const { error: walletLinkError } = await linkSupabaseWallet(user.id);
        if (walletLinkError) {
          setError(walletLinkError.message || 'Failed to link wallet in database');
          setLoading(false);
          return;
        }
      }

      toast({
        title: "Wallet linked successfully!",
        description: "You can now deposit or withdraw.",
      });
      refresh();
      setTimeout(() => {
        navigate("/wallet");
      }, 3000);
    } catch (err: any) {
      setError("Failed to link wallet. Please try manual linking.");
      setShowPasswordForm(true);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      // Ensure TTPayPal email matches Limey user email
      if (user?.email && wpEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
        setError("The TTPayPal email must match your Limey account email.");
        setLoading(false);
        return;
      }
      if (linked) {
        setError("You are already linked.");
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
        const { error: walletLinkError } = await linkSupabaseWallet(user.id);
        if (walletLinkError) {
          setError(walletLinkError.message || 'Failed to link wallet in database');
          setLoading(false);
          return;
        }
      }

      toast({
        title: "Wallet linked successfully!",
        description: "You can now deposit or withdraw.",
      });
      refresh();
      setTimeout(() => {
        navigate("/wallet");
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
    }
    setLoading(false);
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
      <div className="bg-black/90 p-6 rounded-lg w-full max-w-xs border border-white/10">
        <h2 className="text-lg font-bold text-white mb-4 text-center">Link TTPayPal Account</h2>
        
        {/* Quick Link Option (when JWT is validated) */}
        {jwtValidated && !showPasswordForm && (
          <div className="text-center">
            <div className="mb-4 p-3 bg-green-900/20 border border-green-500/20 rounded-lg">
              <div className="text-green-400 text-sm mb-2">✓ Authentication Verified</div>
              <div className="text-white/70 text-xs">
                Your TTPayPal credentials were verified during login
              </div>
            </div>
            
            <div className="mb-4 text-white/80 text-sm">
              Link to: <span className="font-semibold">{user?.email}</span>
            </div>
            
            {error && <div className="text-red-400 mb-4 text-center text-sm">{error}</div>}
            
            <Button 
              onClick={handleQuickLink} 
              className="w-full mb-3 bg-green-600 hover:bg-green-700" 
              disabled={loading}
            >
              {loading ? "Linking..." : "Link Wallet"}
            </Button>
            
            <Button 
              type="button" 
              variant="outline" 
              className="w-full mb-2 text-white/70 border-white/20 hover:bg-white/10" 
              onClick={() => setShowPasswordForm(true)}
              disabled={loading}
            >
              Use Different Credentials
            </Button>
          </div>
        )}

        {/* Manual Form (when JWT not validated or user chooses manual) */}
        {(!jwtValidated || showPasswordForm) && (
          <form onSubmit={handleSubmit}>
            {!jwtValidated && (
              <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-500/20 rounded-lg">
                <div className="text-yellow-400 text-sm mb-1">⚠ Authentication Required</div>
                <div className="text-white/70 text-xs">
                  Please verify your TTPayPal credentials to link your wallet
                </div>
              </div>
            )}
            
            <Input
              className="w-full mb-4 p-2 rounded bg-white/10 text-white placeholder-white/50"
              type="email"
              placeholder="TTPayPal Email Address"
              value={wpEmail}
              onChange={e => setWpEmail(e.target.value)}
              required
            />
            <Input
              className="w-full mb-4 p-2 rounded bg-white/10 text-white placeholder-white/50"
              type="password"
              placeholder="TTPayPal Password"
              value={wpPassword}
              onChange={e => setWpPassword(e.target.value)}
              required
            />
            {error && <div className="text-red-400 mb-4 text-center text-sm">{error}</div>}
            <Button type="submit" className="w-full mb-3" disabled={loading}>
              {loading ? "Linking..." : "Link Account"}
            </Button>
            
            {jwtValidated && showPasswordForm && (
              <Button 
                type="button" 
                variant="outline" 
                className="w-full mb-2 text-white/70 border-white/20 hover:bg-white/10" 
                onClick={() => setShowPasswordForm(false)}
                disabled={loading}
              >
                Back to Quick Link
              </Button>
            )}
          </form>
        )}

        <Button 
          type="button" 
          className="w-full mt-2" 
          variant="ghost" 
          onClick={() => navigate('/profile')}
          disabled={loading}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
} 