import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { linkWallet as linkTrinEPayWallet } from "@/lib/trinepayApi";
import { useAuth } from "@/hooks/useAuth";
import { linkWallet as linkSupabaseWallet, getLinkedWallet } from "@/integrations/supabase/client";
import { useWalletLinkStatus } from "@/hooks/useWalletLinkStatus";
import { isJwtValidated, getJwtValidationInfo } from "@/utils/jwtValidation";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function LinkAccount() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { loading: statusLoading, linked, refresh } = useWalletLinkStatus(user?.id);
  const [alreadyLinked, setAlreadyLinked] = useState(false);
  const [linkedEmail, setLinkedEmail] = useState("");
  const [jwtValidated, setJwtValidated] = useState(false);
  const [linkingSuccess, setLinkingSuccess] = useState(false);
  const linkingInProgress = useRef(false);

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
      const storedToken = localStorage.getItem('wp_jwt_token');
      
      setJwtValidated(validated);
      
      // Debug info
      console.log('=== JWT Validation Debug ===');
      console.log('JWT Validation Info:', getJwtValidationInfo());
      console.log('JWT Validated:', validated);
      console.log('Stored Token Present:', !!storedToken);
      console.log('Token Length:', storedToken?.length || 0);
      console.log('Raw validation value:', localStorage.getItem('wp_jwt_validated'));
      console.log('Validation time:', localStorage.getItem('wp_jwt_validation_time'));
      console.log('=== End Debug ===');
    };
    
    checkWalletLink();
    checkJwtValidation();

    // Cleanup function to reset ref on unmount
    return () => {
      linkingInProgress.current = false;
    };
  }, [user]);

  const handleQuickLink = async () => {
    if (!jwtValidated) {
      setError("Authentication required. Please log out and log back in.");
      return;
    }

    if (loading || linkingSuccess || linkingInProgress.current) {
      console.log('Link already in progress or completed, ignoring click');
      return;
    }

    linkingInProgress.current = true;
    setLoading(true);
    setError("");

    try {
      console.log('Starting quick link process...');
      
      // Check if wallet is already linked
      if (linked) {
        console.log('Wallet already linked, redirecting to wallet page');
        setLinkingSuccess(true);
        toast({
          title: "Wallet already linked!",
          description: "Redirecting to wallet...",
        });
        linkingInProgress.current = false;
        navigate("/wallet");
        return;
      }

      console.log('JWT validation passed - checking token availability...');

      // Check if we have the JWT token
      const storedToken = localStorage.getItem('wp_jwt_token');
      
      if (!storedToken) {
        // JWT validation passed but token is missing (likely due to wallet unlinking)
        // Since we can't get a fresh token without the password, ask user to re-login
        console.log('Token missing but validation passed - user needs to re-login for fresh token');
        setError("Since your wallet was unlinked, for security purposes you will need to sign out and sign in again before relinking your account.");
        linkingInProgress.current = false;
        setLoading(false);
        return;
      }

      console.log('Token available - attempting TrinEPay wallet link...');

      // Now try to link the wallet
      try {
        await linkTrinEPayWallet({ 
          email: user?.email || '', 
          password: '', // Empty since we're using JWT token
          passcode: "" 
        });
        console.log('TrinEPay wallet link successful');
      } catch (trinEPayError: any) {
        console.error('TrinEPay wallet link failed:', trinEPayError);
        
        // If linking fails due to authentication, ask user to re-login
        if (trinEPayError.message?.includes('authentication') || 
            trinEPayError.message?.includes('Not authenticated') ||
            trinEPayError.message?.includes('credentials')) {
          setError("Authentication session expired. Please log out and log back in to refresh your authentication.");
        } else {
          setError(`Wallet linking failed: ${trinEPayError.message || 'Unknown error'}`);
        }
        linkingInProgress.current = false;
        setLoading(false);
        return;
      }

      // Insert wallet link into Supabase wallet_links table
      if (user?.id) {
        console.log('Inserting wallet link into Supabase for user:', user.id);
        try {
          const { error: walletLinkError } = await linkSupabaseWallet(user.id);
          if (walletLinkError) {
            console.error('Supabase wallet link error:', walletLinkError);
            
            // If it's a 406 error, continue anyway since TrinEPay linking succeeded
            if (walletLinkError.status === 406 || walletLinkError.message?.includes('406')) {
              console.log('Ignoring 406 error, TrinEPay linking was successful');
            } else {
              setError(`Database error: ${walletLinkError.message || 'Failed to link wallet in database'}`);
              linkingInProgress.current = false;
              setLoading(false);
              return;
            }
          }
          console.log('Supabase wallet link completed');
        } catch (supabaseError: any) {
          console.error('Supabase wallet link exception:', supabaseError);
          
          // If it's a 406 error, continue anyway since TrinEPay linking succeeded
          if (supabaseError.status === 406 || supabaseError.message?.includes('406')) {
            console.log('Ignoring 406 exception, TrinEPay linking was successful');
          } else {
            setError(`Database error: ${supabaseError.message || 'Failed to link wallet in database'}`);
            linkingInProgress.current = false;
            setLoading(false);
            return;
          }
        }
      }

      console.log('Wallet linking completed successfully');
      setLinkingSuccess(true);
      
      // Check token status before and after refresh
      console.log('Token before refresh:', !!localStorage.getItem('wp_jwt_token'));
      
      toast({
        title: "Wallet linked successfully!",
        description: "Redirecting to wallet...",
      });
      
      // Refresh wallet status
      refresh();
      
      // Check token status after refresh
      console.log('Token after refresh:', !!localStorage.getItem('wp_jwt_token'));
      
      // Navigate immediately to prevent user from clicking again
      navigate("/wallet");
    } catch (err: any) {
      console.error('Quick link error:', err);
      setError(`Failed to link wallet: ${err.message || 'Unknown error'}`);
    } finally {
      linkingInProgress.current = false;
      setLoading(false);
    }
  };



  if (alreadyLinked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-black/90 p-6 rounded-lg w-full max-w-xs border border-white/10 text-center text-white">
          <h2 className="text-lg font-bold mb-4">Wallet Already Linked</h2>
          <div className="mb-4">Your account is already linked to TrinEPay with email:</div>
          <div className="mb-4 font-semibold">{linkedEmail}</div>
          <Button className="w-full" onClick={() => navigate('/profile')}>Back to Profile</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="bg-black/90 p-6 rounded-lg w-full max-w-xs border border-white/10">
        <h2 className="text-lg font-bold text-white mb-4 text-center">Link TrinEPay Account</h2>
        
        {/* Debug Info */}
        <div className="mb-4 p-2 bg-gray-800 rounded text-xs text-gray-300">
          <div>JWT Validated: {jwtValidated ? '✅ Yes' : '❌ No'}</div>
          <div>User Email: {user?.email || 'None'}</div>
          <div>Already Linked: {alreadyLinked ? 'Yes' : 'No'}</div>
          <div>Status Loading: {statusLoading ? 'Yes' : 'No'}</div>
        </div>
        
        {/* Quick Link Option (when JWT is validated) */}
        {jwtValidated && (
          <div className="text-center">
            <div className="mb-4 p-3 bg-green-900/20 border border-green-500/20 rounded-lg">
              <div className="text-green-400 text-sm mb-2">✓ Authentication Verified</div>
              <div className="text-white/70 text-xs">
                Your TrinEPay credentials were verified during login
              </div>
            </div>
            
            <div className="mb-4 text-white/80 text-sm">
              Link to: <span className="font-semibold">{user?.email}</span>
            </div>
            
            {error && <div className="text-red-400 mb-4 text-center text-sm">{error}</div>}
            
            {error.includes("Since your wallet was unlinked") ? (
              <Button 
                onClick={async () => {
                  await signOut();
                  navigate('/login');
                }} 
                className="w-full mb-3 bg-yellow-600 hover:bg-yellow-700" 
                disabled={loading}
              >
                Log Out & Log Back In
              </Button>
            ) : (
              <Button 
                onClick={handleQuickLink} 
                className="w-full mb-3 bg-green-600 hover:bg-green-700" 
                disabled={loading || linkingSuccess}
              >
                {linkingSuccess ? "Success! Redirecting..." : loading ? "Linking..." : "Link Wallet"}
              </Button>
            )}
          </div>
        )}

        {/* Account Mismatch Message (when JWT not validated) */}
        {!jwtValidated && (
          <div className="text-center">
            <div className="mb-4 p-4 bg-red-900/20 border border-red-500/20 rounded-lg">
              <div className="text-red-400 text-lg mb-3">🔒 Authentication Required</div>
              <div className="text-white/90 text-sm mb-3 leading-relaxed">
                To link your wallet securely, your Limey and TrinEPay accounts must have matching credentials. If they don't match yet, or if you haven't logged in recently:
              </div>
              <div className="text-left text-white/80 text-sm space-y-2 mb-4">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 font-bold">1.</span>
                  <span>Update your Limey <strong>OR</strong> TrinEPay account so both have the same email and password</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 font-bold">2.</span>
                  <span>Log out of Limey completely</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 font-bold">3.</span>
                  <span>Log back in with the matching credentials</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400 font-bold">4.</span>
                  <span>Return here to link your wallet</span>
                </div>
              </div>
              <div className="text-white/60 text-xs italic">
                This ensures secure wallet linking and prevents authentication issues.
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={() => navigate('/settings')} 
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Update Limey Account
              </Button>
              
              <Button 
                onClick={() => window.open('https://theronm18.sg-host.com/manage-account/edit-account/', '_blank')} 
                variant="outline"
                className="w-full border-white/20 text-white hover:bg-white/10"
              >
                Update TrinEPay Account
              </Button>

              <Button 
                onClick={async () => {
                  await signOut();
                  navigate('/login');
                }} 
                variant="outline"
                className="w-full border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10"
              >
                Log Out & Log Back In
              </Button>
            </div>
          </div>
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