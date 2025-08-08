import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  depositToApp,
  getWalletStatus,
  recordTrincreditsTransaction,
  getTrincreditsBalance,
  getUserLimits,
  withdrawToWallet,
  fixWordPressBalance,
} from "@/lib/trinepayApi";
import { useAuth } from "@/hooks/useAuth";
import { supabase, getLinkedWallet } from "@/integrations/supabase/client";
import { useWalletLinkStatus } from "@/hooks/useWalletLinkStatus";

export default function Wallet() {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletBal, setWalletBal] = useState<number>(0);
  const [trinepayBalance, setTrinepayBalance] = useState<number>(0);
  const [limits, setLimits] = useState<{
    per_transaction_limit: number;
    max_wallet_balance: number;
    max_monthly_transactions: number;
    user_role: string;
    current_month_usage?: number;
    remaining_monthly_allowance?: number;
    trinepay_wallet_balance?: number;
  }>({
    per_transaction_limit: 5000,
    max_wallet_balance: 20000,
    max_monthly_transactions: 20000,
    user_role: "customer",
  });
  const [walletLinked, setWalletLinked] = useState<boolean | null>(null);
  const [linkedWalletEmail, setLinkedWalletEmail] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [fixing, setFixing] = useState(false);
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { loading: statusLoading, linked, refresh } = useWalletLinkStatus(user?.id);

  const fetchWalletData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await getLinkedWallet(user.id);
      if (data && data.wallet_email) {
        setWalletLinked(true);
        setLinkedWalletEmail(data.wallet_email);
      } else {
        setWalletLinked(false);
      }

      const balance = await getTrincreditsBalance(user.id);
      setWalletBal(balance);

      // AUTO-SYNC: Always sync balance to WordPress when wallet loads
      try {
        const syncResult = await fixWordPressBalance(user.id);
        // Use the limits from the sync result if available
        if (syncResult.limits) {
          setLimits(syncResult.limits);
          // Set TrinEPay balance from limits
          if (syncResult.limits.trinepay_wallet_balance !== undefined) {
            setTrinepayBalance(syncResult.limits.trinepay_wallet_balance);
          }
        } else {
          // Fallback to fetching limits separately
          const limitsRes = await getUserLimits();
          if (limitsRes) {
            setLimits(limitsRes);

            // Set TrinEPay balance from limits
            if (limitsRes.trinepay_wallet_balance !== undefined) {
              setTrinepayBalance(limitsRes.trinepay_wallet_balance);
            }
          }
        }
      } catch (syncError) {
        console.warn('Auto-sync failed on wallet load:', syncError);
        // Don't fail wallet loading if sync fails

        // Try to get limits anyway
        try {
          const limitsRes = await getUserLimits();
          if (limitsRes) {
            setLimits(limitsRes);
            // Set TrinEPay balance from limits
            if (limitsRes.trinepay_wallet_balance !== undefined) {
              setTrinepayBalance(limitsRes.trinepay_wallet_balance);
            }
          }
        } catch (limitsError) {
          console.warn('Failed to get limits after sync failure:', limitsError);
        }
      }

      const { data: transactionsData, error: transactionsError } = await supabase
        .from("trincredits_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (transactionsError) {
        console.error("Error fetching transactions:", transactionsError);
      } else {
        setTransactions(transactionsData);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWalletData();
  }, [user]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const amountValue = parseFloat(amount);

    if (isNaN(amountValue) || amountValue <= 0) {
      setError("Please enter a valid amount");
      setLoading(false);
      return;
    }

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyTransactions = transactions
      .filter(tx => {
        const txDate = new Date(tx.created_at);
        return tx.transaction_type === 'withdrawal' &&
          txDate.getMonth() === currentMonth &&
          txDate.getFullYear() === currentYear;
      });

    const monthlyWithdrawals = monthlyTransactions.reduce((acc, tx) => acc + tx.amount, 0);



    // Use the ACTUAL remaining monthly allowance from TrinEPay/WordPress
    const remainingMonthlyAllowance = limits.remaining_monthly_allowance || (limits.max_monthly_transactions - monthlyWithdrawals);
    const currentMonthUsage = limits.current_month_usage || monthlyWithdrawals;

    // Check if TrinEPay balance is negative
    if (trinepayBalance < 0) {
      setError(`Your TrinEPay balance is negative (TT${trinepayBalance.toLocaleString()}). Please contact support to resolve this issue before making any transactions.`);
      setLoading(false);
      return;
    }

    // STRONGER CHECK: Block if remaining allowance is 0 or less
    if (!remainingMonthlyAllowance || remainingMonthlyAllowance <= 0) {
      setError(`DEPOSIT BLOCKED: You have reached your monthly debit transaction limit of TT${limits.max_monthly_transactions.toLocaleString()}. You have used TT${currentMonthUsage.toLocaleString()} this month. Please try again next month.`);
      setLoading(false);
      return;
    }

    // FIRST: Check per-transaction limit (this takes priority)
    if (amountValue > limits.per_transaction_limit) {
      setError(`Maximum per transaction for your TrinEPay account type is TT${limits.per_transaction_limit.toLocaleString()}`);
      setLoading(false);
      return;
    }

    // SECOND: Check if monthly limit is already exceeded
    if (currentMonthUsage >= limits.max_monthly_transactions) {
      setError(`DEPOSIT BLOCKED: You have exceeded your monthly debit transaction limit of TT${limits.max_monthly_transactions.toLocaleString()}. You have used TT${currentMonthUsage.toLocaleString()} this month. Please try again next month.`);
      setLoading(false);
      return;
    }

    // THIRD: Check if transaction would exceed monthly limit
    if (currentMonthUsage + amountValue > limits.max_monthly_transactions) {
      const actualRemaining = Math.max(0, limits.max_monthly_transactions - currentMonthUsage);
      setError(`DEPOSIT BLOCKED: This transaction would exceed your monthly debit transaction limit. You can only deposit up to TT${actualRemaining.toLocaleString()} more this month.`);
      setLoading(false);
      return;
    }

    if (walletBal + amountValue > limits.max_wallet_balance) {
      setError(`This transaction would exceed your maximum wallet balance of TT${limits.max_wallet_balance.toLocaleString()}`);
      setLoading(false);
      return;
    }



    try {
      const depositResult = await depositToApp({ amount: amountValue });
      await recordTrincreditsTransaction({
        userId: user!.id,
        transactionType: "deposit",
        amount: amountValue,
        description: `Deposit from TrinEPay`,
        referenceId: depositResult.transaction_id || depositResult.id,
      });
      setSuccess("Deposit Successful!");
      setAmount("");
      fetchWalletData();
    } catch (err: any) {
      let errorMessage = err.message || "Failed to deposit";

      // If it's a wallet balance error, show the actual TrinEPay balance
      if (errorMessage.includes("Not enough balance") || errorMessage.includes("insufficient")) {
        const needed = amountValue - trinepayBalance;
        errorMessage = `Insufficient TrinEPay balance. You have TT${trinepayBalance.toLocaleString()} but need TT${amountValue.toLocaleString()}. You need TT${needed.toLocaleString()} more.`;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    const amountValue = parseFloat(amount);

    if (isNaN(amountValue) || amountValue <= 0) {
      setError("Please enter a valid amount");
      setLoading(false);
      return;
    }

    if (amountValue > walletBal) {
      setError("Insufficient TriniCredits");
      setLoading(false);
      return;
    }

    if (amountValue > limits.per_transaction_limit) {
      setError(`Maximum per transaction for your TrinEPay account type is TT${limits.per_transaction_limit.toLocaleString()}`);
      setLoading(false);
      return;
    }



    try {
      const withdrawResult = await withdrawToWallet({ amount: amountValue });
      await recordTrincreditsTransaction({
        userId: user!.id,
        transactionType: "withdrawal",
        amount: amountValue,
        description: `Withdrawal to TrinEPay`,
        referenceId: withdrawResult.transaction_id || withdrawResult.id,
      });
      setSuccess("Withdrawal successful!");
      setAmount("");
      fetchWalletData();
    } catch (err: any) {
      setError(err.message || "Failed to withdraw");
    } finally {
      setLoading(false);
    }
  };

  const handleFixBalance = async () => {
    if (!user) return;
    setFixing(true);
    setError(null);
    setSuccess(null);

    try {
      const result = await fixWordPressBalance(user.id);
      setSuccess(`Balance fixed! Synced TT$${result.balance.toFixed(2)} to WordPress server.`);
      await fetchWalletData();
    } catch (err: any) {
      setError(`Fix failed: ${err.message}. The sync endpoint may not exist on the server yet.`);
    } finally {
      setFixing(false);
    }
  };

  if (statusLoading) {
    return <div className="min-h-screen bg-black flex items-center justify-center text-white">Loading...</div>;
  }
  if (!linked) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="bg-black/90 p-6 rounded-lg w-full max-w-xs border border-white/10 mt-20 text-center text-white">
          <div className="mb-4">Your account is not linked to TrinEPay.</div>
          <Button onClick={() => navigate("/wallet/link")}>Link TrinEPay Account</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/20 backdrop-blur-md border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <span className="text-2xl font-black text-white tracking-wider logo-text-glow">
            Wallet
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigate("/profile")}>
            ← Back
          </Button>
        </div>
      </div>

      <div className="pt-20 p-4">
        <div className="bg-black/90 p-6 rounded-lg w-full max-w-md mx-auto border border-white/10">
          <div className="text-center mb-4">
            <div className="text-lg">Available in Limey</div>
            <div className="text-3xl font-bold">
              TT${walletBal.toFixed(2)}
            </div>
            {linkedWalletEmail && (
              <div className="text-sm text-gray-400 mt-1">
                TrinEPay Email: {linkedWalletEmail}
              </div>
            )}
            <div className="text-xs text-gray-400 mt-2">
              Max per transaction: TT${limits.per_transaction_limit.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">
              Max TrinEPay balance: TT${limits.max_wallet_balance.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">
              Monthly limit: TT${limits.max_monthly_transactions.toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">
              Remaining deposit limit: TT${(limits.remaining_monthly_allowance || 0).toLocaleString()}
            </div>
            <div className="text-xs text-gray-400">
              TrinEPay balance: TT${trinepayBalance.toLocaleString()}
            </div>
          </div>

          <Tabs defaultValue="deposit" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="deposit">Deposit</TabsTrigger>
              <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
            </TabsList>
            <TabsContent value="deposit">
              <form onSubmit={handleDeposit} className="space-y-4 mt-4">
                <input
                  className="w-full p-2 rounded bg-white text-black text-center font-semibold"
                  type="number"
                  min="10"
                  max="25000"
                  step="0.01"
                  placeholder="Amount (TT$10 - TT$25,000)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Processing..." : "Deposit"}
                </Button>
              </form>
            </TabsContent>
            <TabsContent value="withdraw">
              <form onSubmit={handleWithdraw} className="space-y-4 mt-4">
                <input
                  className="w-full p-2 rounded bg-white text-black text-center font-semibold"
                  type="number"
                  min="10"
                  max="25000"
                  step="0.01"
                  placeholder="Amount (TT$10 - TT$25,000)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Processing..." : "Withdraw"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
          {error && (
            <div className="text-red-400 mt-2 text-center">{error}</div>
          )}
          {success && (
            <div className="text-green-400 mt-2 text-center">{success}</div>
          )}


        </div>

        <div className="mt-8">
          <h2 className="text-xl font-bold mb-4 text-center">
            Transaction History
          </h2>
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="bg-black/90 p-4 rounded-lg border border-white/10 flex justify-between items-center"
              >
                <div>
                  <div className="font-semibold">
                    {tx.description || tx.transaction_type}
                  </div>
                  <div className="text-sm text-gray-400">
                    {new Date(tx.created_at).toLocaleString()}
                  </div>
                </div>
                <div
                  className={`font-bold ${tx.transaction_type === "deposit"
                    ? "text-green-400"
                    : "text-red-400"
                    }`}
                >
                  {tx.transaction_type === "deposit" ? "+" : "-"}TT$
                  {tx.amount.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}