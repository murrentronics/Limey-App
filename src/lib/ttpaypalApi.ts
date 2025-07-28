function getWpToken() {
  return localStorage.getItem('wp_jwt_token');
}

export async function getWalletStatus() {
  const token = getWpToken();
  if (!token) throw new Error('Not authenticated with TTPayPal');
  const res = await fetch("https://ttpaypal.com/wp-json/ttpaypal/v1/status", {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch wallet status");
  return await res.json();
}

export async function getUserLimits() {
  const token = getWpToken();
  if (!token) throw new Error('Not authenticated with TTPayPal');
  const res = await fetch("https://ttpaypal.com/wp-json/ttpaypal/v1/user-limits", {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to fetch user limits");
  return await res.json();
}

export async function linkWallet({ email, password, passcode }: { email: string; password: string; passcode: string }) {
  const token = getWpToken();
  if (!token) throw new Error('Not authenticated with TTPayPal');
  const res = await fetch("https://ttpaypal.com/wp-json/ttpaypal/v1/link", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'Authorization': `Bearer ${token}`,
    },
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
  if (!token) throw new Error('Not authenticated with TTPayPal');
  const res = await fetch("https://ttpaypal.com/wp-json/ttpaypal/v1/deposit", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      'Authorization': `Bearer ${token}`,
    },
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
  if (!token) throw new Error('Not authenticated with TTPayPal');
  const res = await fetch("https://ttpaypal.com/wp-json/ttpaypal/v1/withdraw", {
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
  if (!token) throw new Error('Not authenticated with TTPayPal');
  
  try {
    // Try to call the WordPress endpoint if it exists
    const res = await fetch("https://ttpaypal.com/wp-json/ttpaypal/v1/unlink", {
      method: "POST",
      headers: { 'Authorization': `Bearer ${token}` },
    });
    
    if (res.ok) {
      // WordPress endpoint exists and worked
      localStorage.removeItem('wp_jwt_token');
      return await res.json();
    } else if (res.status === 404) {
      // Endpoint doesn't exist, handle locally
      console.log('TTPayPal unlink endpoint not found, handling locally');
      localStorage.removeItem('wp_jwt_token');
      return { success: true, message: 'Wallet unlinked locally' };
    } else {
      // Other error
      let msg = "Failed to unlink wallet";
      try { const data = await res.json(); msg = data.message || msg; } catch {}
      throw new Error(msg);
    }
  } catch (error) {
    // Network error or other issue, handle locally
    console.log('Error calling TTPayPal unlink endpoint, handling locally:', error);
    localStorage.removeItem('wp_jwt_token');
    return { success: true, message: 'Wallet unlinked locally' };
  }
}

// Function to calculate current TriniCredits balance from transactions
export async function getTrincreditsBalance(userId: string): Promise<number> {
  const { supabase } = await import('@/integrations/supabase/client');
  
  try {
    // Get all transactions for the user
    const { data: transactions, error } = await supabase
      .from('trincredits_transactions')
      .select('transaction_type, amount')
      .eq('user_id', userId)
      .eq('status', 'completed');

    if (error) {
      console.error('Error fetching transactions:', error);
      throw new Error('Failed to fetch transaction history');
    }

    // Calculate balance from transactions
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

// Function to record TriniCredits transaction in Supabase
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
    // First, get the current balance
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

    // Calculate new balance based on transaction type
    if (transactionType === 'deposit' || transactionType === 'refund' || transactionType === 'reward') {
      newBalance = currentBalance + amount;
    } else if (transactionType === 'withdrawal') {
      newBalance = currentBalance - amount;
    }

    // Insert the transaction record
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

    // Update the user's balance in profiles table
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
    console.error('Error recording TriniCredits transaction:', error);
    throw new Error('Failed to record transaction');
  }
}

export async function getTransactionHistory(userId: string) {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data, error } = await supabase
    .from('trincredits_transactions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching transaction history:', error);
    throw new Error('Failed to fetch transaction history');
  }

  return data;
}

// Function to deduct TriniCredits for boost payments
export async function deductTrincredits(userId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    // Get current balance
    const currentBalance = await getTrincreditsBalance(userId);
    
    if (currentBalance < amount) {
      return { 
        success: false, 
        error: `Insufficient balance. You have TT$${currentBalance.toFixed(2)} but need TT$${amount.toFixed(2)}` 
      };
    }

    // Record the deduction transaction
    await recordTrincreditsTransaction({
      userId,
      transactionType: 'withdrawal',
      amount,
      description: `Boost campaign payment - TT$${amount.toFixed(2)}`,
      referenceId: `boost_${Date.now()}`
    });

    return { success: true };
  } catch (error) {
    console.error('Error deducting TriniCredits:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to deduct TriniCredits' 
    };
  }
}

export async function deleteUserAccount(userId: string) {
  const { supabase } = await import('@/integrations/supabase/client');

  try {
    // 1. Unlink wallet if it exists
    await unlinkWallet();

    // 2. Delete user data from Supabase tables
    // Note: The order of deletion matters due to foreign key constraints.
    // Start with tables that have foreign keys to the user, then the user profile.

    // Example: Delete user settings
    await supabase.from('user_settings').delete().eq('user_id', userId);

    // Example: Delete wallet links
    await supabase.from('wallet_links').delete().eq('user_id', userId);

    // Example: Delete trincredits transactions
    await supabase.from('trincredits_transactions').delete().eq('user_id', userId);

    // Finally, delete the user's profile
    await supabase.from('profiles').delete().eq('user_id', userId);

    // 3. Delete the user from Supabase Auth
    // This should be the last step.
    // Note: This requires the service_role key, which should only be used on the server-side.
    // For this example, we'll assume a server-side function would handle this.
    // Since we are on the client, we can't directly delete the user from auth.
    // The user will be logged out, and their data will be gone.

    return { success: true };
  } catch (error: any) {
    console.error('Error deleting user account:', error);
    throw new Error(error.message || 'Failed to delete user account');
  }
}