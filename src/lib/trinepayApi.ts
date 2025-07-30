function getWpToken() {
  return localStorage.getItem('wp_jwt_token');
}

export async function getWalletStatus() {
  const token = getWpToken();
  if (!token) throw new Error('Not authenticated with TrinEPay');
  const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/status", {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch wallet status");
  return await res.json();
}

export async function getUserLimits() {
  const token = getWpToken();
  if (!token) throw new Error('Not authenticated with TrinEPay');
  const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/user-limits", {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch user limits");
  return await res.json();
}

export async function linkWallet({ email, password, passcode }: { email: string; password: string; passcode: string }) {
  const token = getWpToken();
  if (!token) throw new Error('Not authenticated with TrinEPay');
  const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    },
    mode: 'cors',
    credentials: 'omit',
    body: JSON.stringify({ email, password, passcode }),
  });
  if (!res.ok) {
    let msg = "Failed to link wallet";
    try { const data = await res.json(); msg = data.message || msg; } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function depositToApp({ amount }: { amount: number }) {
  const token = getWpToken();
  if (!token) throw new Error('Not authenticated with TrinEPay');
  const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/deposit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json'
    },
    mode: 'cors',
    credentials: 'omit',
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    let msg = "Failed to deposit";
    try { const data = await res.json(); msg = data.message || msg; } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function withdrawToWallet({ amount }: { amount: number }) {
  const token = getWpToken();
  if (!token) throw new Error('Not authenticated with TrinEPay');
  const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/withdraw", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) {
    let msg = "Failed to withdraw";
    try { const data = await res.json(); msg = data.message || msg; } catch {}
    throw new Error(msg);
  }
  return await res.json();
}

export async function unlinkWallet() {
  const token = getWpToken();
  if (!token) throw new Error('Not authenticated with TrinEPay');
  
  try {
    const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/unlink", {
      method: "POST",
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (res.ok) {
      localStorage.removeItem('wp_jwt_token');
      return await res.json();
    } else if (res.status === 404) {
      console.log('TrinEPay unlink endpoint not found, handling locally');
      localStorage.removeItem('wp_jwt_token');
      return { success: true, message: 'Wallet unlinked locally' };
    } else {
      let msg = "Failed to unlink wallet";
      try { const data = await res.json(); msg = data.message || msg; } catch {}
      throw new Error(msg);
    }
  } catch (error) {
    console.log('Error calling TrinEPay unlink endpoint, handling locally:', error);
    localStorage.removeItem('wp_jwt_token');
    return { success: true, message: 'Wallet unlinked locally' };
  }
}

export async function getTrincreditsBalance(userId: string): Promise<number> {
  const { supabase } = await import('@/integrations/supabase/client');
  
  try {
    const { data: transactions, error } = await supabase
      .from('trincredits_transactions')
      .select('transaction_type, amount')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching transactions:', error);
      throw new Error('Failed to fetch transaction history');
    }

    let balance = 0;
    transactions?.forEach(transaction => {
      if (transaction.transaction_type === 'deposit' || transaction.transaction_type === 'refund' || transaction.transaction_type === 'reward') {
        balance += transaction.amount;
      } else if (transaction.transaction_type === 'withdrawal') {
        balance -= transaction.amount;
      }
    });

    return balance;
  } catch (error) {
    console.error('Error calculating balance:', error);
    throw new Error('Failed to calculate balance');
  }
}

export async function recordTrincreditsTransaction({
  userId,
  transactionType,
  amount,
  description,
  referenceId
}: {
  userId: string;
  transactionType: 'deposit' | 'withdrawal' | 'transfer' | 'reward' | 'refund';
  amount: number;
  description?: string;
  referenceId?: string;
}) {
  const { supabase } = await import('@/integrations/supabase/client');
  
  try {
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('trini_credits')
      .eq('user_id', userId)
      .single();

    if (profileError) {
      console.error('Error fetching current balance:', profileError);
      throw new Error('Failed to fetch current balance');
    }

    const currentBalance = profile.trini_credits || 0;
    let newBalance = currentBalance;

    if (transactionType === 'deposit' || transactionType === 'refund' || transactionType === 'reward') {
      newBalance = currentBalance + amount;
    } else if (transactionType === 'withdrawal') {
      newBalance = currentBalance - amount;
    }

    const { data: transaction, error: transactionError } = await supabase
      .from('trincredits_transactions')
      .insert({
        user_id: userId,
        transaction_type: transactionType,
        amount: amount,
        balance_before: currentBalance,
        balance_after: newBalance,
        description: description,
        reference_id: referenceId,
        status: 'completed'
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Error inserting transaction:', transactionError);
      throw new Error('Failed to record transaction');
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ trini_credits: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      throw new Error('Failed to update balance');
    }

    return transaction;
  } catch (error) {
    console.error('Error recording transaction:', error);
    throw new Error('Failed to record transaction');
  }
}

export async function deductTrincredits(userId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const currentBalance = await getTrincreditsBalance(userId);
    
    if (currentBalance < amount) {
      return { 
        success: false, 
        error: `Insufficient balance. You have TT$${currentBalance.toFixed(2)} but need TT$${amount.toFixed(2)}` 
      };
    }

    await recordTrincreditsTransaction({
      userId,
      transactionType: 'withdrawal',
      amount,
      description: `Debit for Boost`,
      referenceId: `boost_${Date.now()}`
    });

    return { success: true };
  } catch (error) {
    console.error('Error deducting balance:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to deduct balance' 
    };
  }
}

export async function deleteUserAccount(userId: string) {
  const { supabase } = await import('@/integrations/supabase/client');

  try {
    await unlinkWallet();
    await supabase.from('user_settings').delete().eq('user_id', userId);
    await supabase.from('wallet_links').delete().eq('user_id', userId);
    await supabase.from('trincredits_transactions').delete().eq('user_id', userId);
    await supabase.from('profiles').delete().eq('user_id', userId);

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user account:', error);
    throw new Error(error.message || 'Failed to delete user account');
  }
}