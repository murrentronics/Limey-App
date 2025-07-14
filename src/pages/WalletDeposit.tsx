import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { depositToApp, getWalletStatus, recordTrincreditsTransaction, getTrincreditsBalance, getUserLimits } from "@/lib/ttpaypalApi";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function WalletDeposit() {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [ttPaypalEmail, setTTPaypalEmail] = useState<string | null>(null);
  const [ttPaypalUsername, setTTPaypalUsername] = useState<string | null>(null);
  const [triniCredits, setTriniCredits] = useState<number>(0);
  const [limits, setLimits] = useState<{
    per_transaction_limit: number;
    max_wallet_balance: number;
    max_monthly_transactions: number;
    user_role: string;
  }>({
    per_transaction_limit: 5000,
    max_wallet_balance: 20000,
    max_monthly_transactions: 20000,
    user_role: 'customer'
  });
  const [walletLinked, setWalletLinked] = useState<boolean | null>(null);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const fetchBalance = async () => {
    if (user?.id) {
      try {
        const balance = await getTrincreditsBalance(user.id);
        setTriniCredits(balance);
      } catch (err) {
        console.error('Error fetching balance:', err);
        setTriniCredits(0);
      }
    }
  };

  const fetchLimits = async () => {
    try {
      const limitsRes = await getUserLimits();
      if (limitsRes) {
        setLimits({
          per_transaction_limit: limitsRes.per_transaction_limit || 5000,
          max_wallet_balance: limitsRes.max_wallet_balance || 20000,
          max_monthly_transactions: limitsRes.max_monthly_transactions || 20000,
          user_role: limitsRes.user_role || 'customer'
        });
      }
    } catch (err) {
      console.error('Error fetching limits:', err);
      // Use default limits if fetch fails
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get wallet status from TTPayPal
        const walletRes = await getWalletStatus();
        if (typeof walletRes.linked === 'boolean') {
          setWalletLinked(walletRes.linked);
        } else {
          setWalletLinked(false);
        }
        setWalletBalance(typeof walletRes.balance === 'number' ? walletRes.balance : null);
        setTTPaypalEmail(walletRes.email || null);
        setTTPaypalUsername(walletRes.username || null);

        // Fetch fresh limits from TTPayPal
        await fetchLimits();

        // Fetch balance from transactions table
        if (user?.id) {
          await fetchBalance();
        }
      } catch (err) {
        setWalletLinked(false);
        console.error('Error fetching data:', err);
        setWalletBalance(null);
        setTTPaypalEmail(null);
        setTTPaypalUsername(null);
        setTriniCredits(0);
      }
    };
    fetchData();
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const amountValue = parseFloat(amount);

    // Validate amount
    if (isNaN(amountValue)) {
      setError("Please enter a valid amount");
      setLoading(false);
      return;
    }

    // Enforce minimum deposit of $100
    if (amountValue < 100) {
      setError("Minimum deposit is TT$100");
      setLoading(false);
      return;
    }

    // Enforce maximum deposit of $25,000
    if (amountValue > 25000) {
      setError("Maximum deposit is TT$25,000");
      setLoading(false);
      return;
    }

    // Check against user's per-transaction limit
    if (amountValue > limits.per_transaction_limit) {
      setError(`Maximum per transaction for your account type (${limits.user_role}) is TT$${limits.per_transaction_limit.toLocaleString()}`);
      setLoading(false);
      return;
    }

    if (walletBalance !== null && amountValue > walletBalance) {
      setError("Insufficient TTPayPal wallet balance");
      setLoading(false);
      return;
    }

    try {
      // 1. Process deposit through TTPayPal
      const depositResult = await depositToApp({ amount: amountValue });
      
      // 2. Record transaction in Supabase and update TriniCredits balance
      if (user?.id) {
        await recordTrincreditsTransaction({
          userId: user.id,
          transactionType: 'deposit',
          amount: amountValue,
          description: `Deposit to Limey App`,
          referenceId: depositResult.transaction_id || depositResult.id
        });

        // 3. Refresh the balance from transactions table
        await fetchBalance();
      }

      setSuccess("Deposit successful!");
      setAmount(""); // Clear the form
    } catch (err: any) {
      setError(err.message || "Failed to deposit");
    } finally {
      setLoading(false);
    }
  };

  if (walletLinked === false) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-black/90 p-6 rounded-lg w-full max-w-xs border border-white/10 mt-20 text-center text-white">
          <div className="mb-4">Your account is not linked to TTPayPal.</div>
          <Button onClick={() => navigate('/link-account')}>Link TTPayPal Account</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <span
            className="text-2xl font-black text-white tracking-wider logo-text-glow"
            style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              fontWeight: '900',
              letterSpacing: '0.15em',
              filter: 'drop-shadow(0 0 8px hsl(120, 100%, 50%))'
            }}
          >
            Deposit
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate('/profile')}>
            ← Back
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-black/90 p-6 rounded-lg w-full max-w-xs border border-white/10 mt-20">
        <div className="text-center text-white text-sm mb-4">
          {ttPaypalEmail && (
            <div className="mb-1">TTPayPal Email: <span className="font-semibold">{ttPaypalEmail}</span></div>
          )}
          {ttPaypalUsername && (
            <div className="mb-2">TTPayPal Username: <span className="font-semibold">{ttPaypalUsername}</span></div>
          )}
          {walletBalance !== null && (
            <div className="text-green-400 font-semibold mb-2">
              TTPayPal Wallet Balance: TT${walletBalance.toFixed(2)}
            </div>
          )}
          {triniCredits !== null && (
            <div style={{ marginBottom: '1rem' }}>Available in Limey: TT${triniCredits.toFixed(2)}</div>
          )}
          <div className="text-xs text-gray-400">
            Max per transaction: TT${limits.per_transaction_limit.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">
            Max wallet balance: TT${limits.max_wallet_balance.toLocaleString()}
          </div>
          <div className="text-xs text-gray-400">
            Monthly limit: TT${limits.max_monthly_transactions.toLocaleString()}
          </div>
        </div>
        <input
          className="w-full mb-4 p-2 rounded"
          style={{ background: 'white', color: 'black', textAlign: 'center', fontWeight: 500 }}
          type="number"
          min="100"
          max="25000"
          step="0.01"
          placeholder="Amount (TT$100 - TT$25,000)"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          required
        />
        {error && <div className="text-red-400 mb-2 text-center">{error}</div>}
        {success && <div className="text-green-400 mb-2 text-center">{success}</div>}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "Processing..." : "Deposit"}
        </Button>
        <Button type="button" className="w-full mt-2" variant="ghost" onClick={() => navigate('/profile')}>
          Exit
        </Button>
      </form>
    </div>
  );
} 