async function getWpToken() {
  const token = localStorage.getItem('wp_jwt_token');
  const validated = localStorage.getItem('wp_jwt_validated');
  const validationTime = localStorage.getItem('wp_jwt_validation_time');
  
  // Check if token is still valid (24 hours)
  if (token && validated === 'true' && validationTime) {
    const tokenAge = Date.now() - parseInt(validationTime);
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    if (tokenAge > maxAge) {
      // Token expired, try to refresh it
      console.log('WordPress token expired, attempting to refresh...');
      const refreshed = await refreshWpToken();
      if (refreshed) {
        return localStorage.getItem('wp_jwt_token');
      } else {
        localStorage.removeItem('wp_jwt_token');
        localStorage.removeItem('wp_jwt_validated');
        localStorage.removeItem('wp_jwt_validation_time');
        return null;
      }
    }
    
    return token;
  }
  
  return null;
}

async function refreshWpToken(): Promise<boolean> {
  try {
    // Get current Supabase user
    const { supabase } = await import('@/integrations/supabase/client');
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user?.email) {
      console.error('No Supabase user found for token refresh');
      return false;
    }

    // Try to refresh the WordPress token using the stored credentials
    const storedPassword = sessionStorage.getItem('temp_password');
    if (!storedPassword) {
      console.error('No stored password for token refresh');
      return false;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch("https://theronm18.sg-host.com/wp-json/jwt-auth/v1/token", {
      method: "POST",
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ username: user.email, password: storedPassword }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      
      if (data.token) {
        localStorage.setItem('wp_jwt_token', data.token);
        localStorage.setItem('wp_jwt_validated', 'true');
        localStorage.setItem('wp_jwt_validation_time', Date.now().toString());
        console.log('WordPress JWT token refreshed successfully');
        return true;
      }
    }

    console.error('WordPress token refresh failed');
    return false;
  } catch (error) {
    console.error('WordPress token refresh error:', error);
    return false;
  }
}

export async function getWalletStatus() {
  const token = await getWpToken();
  if (!token) {
    throw new Error('Not authenticated with TrinEPay. Please sign in again to refresh your session.');
  }
  
  try {
    const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/status", {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
    });
    
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('wp_jwt_token');
        localStorage.removeItem('wp_jwt_validated');
        localStorage.removeItem('wp_jwt_validation_time');
        throw new Error('Authentication expired. Please sign in again.');
      }
      throw new Error("Failed to fetch wallet status");
    }
    
    return await res.json();
  } catch (error) {
    console.error('Wallet status error:', error);
    throw error;
  }
}



export async function getUserLimits() {
  const token = await getWpToken();
  if (!token) {
    throw new Error('Not authenticated with TrinEPay. Please sign in again to refresh your session.');
  }
  
  try {
    const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/user-limits", {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
    });
    
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('wp_jwt_token');
        localStorage.removeItem('wp_jwt_validated');
        localStorage.removeItem('wp_jwt_validation_time');
        throw new Error('Authentication expired. Please sign in again.');
      }
      throw new Error("Failed to fetch user limits");
    }
    
    return await res.json();
  } catch (error) {
    console.error('User limits error:', error);
    throw error;
  }
}

export async function linkWallet({ email, password, passcode }: { email: string; password: string; passcode: string }) {
  const token = await getWpToken();
  if (!token) {
    throw new Error('Not authenticated with TrinEPay. Please sign in again to refresh your session.');
  }
  
  try {
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
      try { 
        const data = await res.json(); 
        msg = data.message || data.error || msg; 
      } catch {}
      
      // If unauthorized, clear the token
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('wp_jwt_token');
        localStorage.removeItem('wp_jwt_validated');
        localStorage.removeItem('wp_jwt_validation_time');
        msg = 'Authentication expired. Please sign in again.';
      }
      
      throw new Error(msg);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Wallet link error:', error);
    throw error;
  }
}

export async function depositToApp({ amount }: { amount: number }) {
  const token = await getWpToken();
  if (!token) {
    throw new Error('Not authenticated with TrinEPay. Please sign in again to refresh your session.');
  }
  
  try {
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
      try { 
        const data = await res.json(); 
        msg = data.message || data.error || msg; 
      } catch {}
      
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('wp_jwt_token');
        localStorage.removeItem('wp_jwt_validated');
        localStorage.removeItem('wp_jwt_validation_time');
        msg = 'Authentication expired. Please sign in again.';
      }
      
      throw new Error(msg);
    }
    
    const result = await res.json();
    
    // Auto-sync balance after successful deposit
    try {
      // Get current balance from Supabase and sync to WordPress
      const { supabase } = await import('@/integrations/supabase/client');
      const currentUser = JSON.parse(localStorage.getItem('sb-supabase-auth-token') || '{}')?.user;
      if (currentUser?.id) {
        const newBalance = await getTrincreditsBalance(currentUser.id);
        await syncTriniCreditToWordPress(newBalance);
      }
    } catch (syncError) {
      console.warn('Auto-sync after deposit failed:', syncError);
      // Don't fail the deposit if sync fails
    }
    
    return result;
  } catch (error) {
    console.error('Deposit error:', error);
    throw error;
  }
}

export async function withdrawToWallet({ amount }: { amount: number }) {
  const token = await getWpToken();
  if (!token) {
    throw new Error('Not authenticated with TrinEPay. Please sign in again to refresh your session.');
  }
  
  try {
    const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/withdraw", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ amount }),
    });
    
    if (!res.ok) {
      let msg = "Failed to withdraw";
      try { 
        const data = await res.json(); 
        msg = data.message || data.error || msg; 
      } catch { }
      
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('wp_jwt_token');
        localStorage.removeItem('wp_jwt_validated');
        localStorage.removeItem('wp_jwt_validation_time');
        msg = 'Authentication expired. Please sign in again.';
      }
      
      throw new Error(msg);
    }
    
    const result = await res.json();
    
    // Auto-sync balance after successful withdrawal
    try {
      // Get current balance from Supabase and sync to WordPress
      const { supabase } = await import('@/integrations/supabase/client');
      const currentUser = JSON.parse(localStorage.getItem('sb-supabase-auth-token') || '{}')?.user;
      if (currentUser?.id) {
        const newBalance = await getTrincreditsBalance(currentUser.id);
        await syncTriniCreditToWordPress(newBalance);
      }
    } catch (syncError) {
      console.warn('Auto-sync after withdrawal failed:', syncError);
      // Don't fail the withdrawal if sync fails
    }
    
    return result;
  } catch (error) {
    console.error('Withdraw error:', error);
    throw error;
  }
}

export async function syncBalanceToWordPress(correctBalance: number) {
  const token = await getWpToken();
  if (!token) {
    throw new Error('Not authenticated with TrinEPay. Please sign in again to refresh your session.');
  }
  
  try {
    const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/sync-balance", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ balance: correctBalance }),
    });
    
    if (!res.ok) {
      let msg = "Failed to sync balance";
      try { 
        const data = await res.json(); 
        msg = data.message || data.error || msg; 
      } catch {}
      throw new Error(msg);
    }
    
    return await res.json();
  } catch (error) {
    console.error('Balance sync error:', error);
    throw error;
  }
}

export async function unlinkWallet() {
  const token = await getWpToken();
  if (!token) {
    throw new Error('Not authenticated with TrinEPay. Please sign in again to refresh your session.');
  }
  
  try {
    const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/unlink", {
      method: "POST",
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
    });
    
    if (res.ok) {
      localStorage.removeItem('wp_jwt_token');
      localStorage.removeItem('wp_jwt_validated');
      localStorage.removeItem('wp_jwt_validation_time');
      return await res.json();
    } else if (res.status === 404) {
      console.log('TrinEPay unlink endpoint not found, handling locally');
      localStorage.removeItem('wp_jwt_token');
      localStorage.removeItem('wp_jwt_validated');
      localStorage.removeItem('wp_jwt_validation_time');
      return { success: true, message: 'Wallet unlinked locally' };
    } else {
      let msg = "Failed to unlink wallet";
      try { 
        const data = await res.json(); 
        msg = data.message || data.error || msg; 
      } catch {}
      
      if (res.status === 401 || res.status === 403) {
        localStorage.removeItem('wp_jwt_token');
        localStorage.removeItem('wp_jwt_validated');
        localStorage.removeItem('wp_jwt_validation_time');
        msg = 'Authentication expired. Please sign in again.';
      }
      
      throw new Error(msg);
    }
  } catch (error) {
    console.log('Error calling TrinEPay unlink endpoint, handling locally:', error);
    localStorage.removeItem('wp_jwt_token');
    localStorage.removeItem('wp_jwt_validated');
    localStorage.removeItem('wp_jwt_validation_time');
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

    // CRITICAL: Also sync the balance to WordPress trinicredit_balance
    const syncResult = await syncTriniCreditToWordPress(newBalance);
    if (!syncResult.success) {
      console.warn('Failed to sync balance to WordPress:', syncResult.message);
      // Don't fail the transaction if WordPress sync fails
    }

    return transaction;
  } catch (error) {
    console.error('Error recording transaction:', error);
    throw new Error('Failed to record transaction');
  }
}

async function syncTriniCreditToWordPress(balance: number) {
  try {
    const token = await getWpToken();
    if (!token) {
      console.warn('No WordPress token available for sync - skipping sync');
      return { success: false, message: 'No token available' };
    }
    
    const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/sync-trinicredit", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify({ balance: balance }),
    });
    
    if (!res.ok) {
      console.warn(`WordPress sync failed with status: ${res.status}`);
      return { success: false, message: `Sync failed: ${res.status}` };
    }
    
    return await res.json();
  } catch (error) {
    console.warn('WordPress TriniCredit sync error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

async function syncUserLimitsToWordPress(limits: any) {
  try {
    const token = await getWpToken();
    if (!token) {
      console.warn('No WordPress token available for limits sync - skipping sync');
      return { success: false, message: 'No token available' };
    }
    
    const res = await fetch("https://theronm18.sg-host.com/wp-json/ttpaypal/v1/sync-user-limits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      },
      body: JSON.stringify(limits),
    });
    
    if (!res.ok) {
      console.warn(`WordPress limits sync failed with status: ${res.status}`);
      return { success: false, message: `Limits sync failed: ${res.status}` };
    }
    
    const result = await res.json();
    console.log('Successfully synced user limits to WordPress:', result);
    return result;
  } catch (error) {
    console.warn('WordPress user limits sync error:', error);
    return { success: false, message: error instanceof Error ? error.message : 'Unknown error' };
  }
}

export async function deductTrincredits(userId: string, amount: number): Promise<{ success: boolean; error?: string }> {
  try {
    const currentBalance = await getTrincreditsBalance(userId);
    
    if (currentBalance < amount) {
      return { 
        success: false, 
        error: `Insufficient balance. You have TT${currentBalance.toFixed(2)} but need TT${amount.toFixed(2)}` 
      };
    }

    await recordTrincreditsTransaction({
      userId,
      transactionType: 'withdrawal',
      amount,
      description: `Debit for Boost`,
      referenceId: `boost_${Date.now()}`
    });

    // Auto-sync balance after deduction
    try {
      const newBalance = await getTrincreditsBalance(userId);
      await syncTriniCreditToWordPress(newBalance);
    } catch (syncError) {
      console.warn('Auto-sync after deduction failed:', syncError);
      // Don't fail the deduction if sync fails
    }

    return { success: true };
  } catch (error) {
    console.error('Error deducting balance:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to deduct balance' 
    };
  }
}

export async function fixWordPressBalance(userId: string) {
  try {
    // Get the correct balance from Supabase
    const correctBalance = await getTrincreditsBalance(userId);
    console.log('Got balance from Supabase:', correctBalance);
    
    // Get user limits from WordPress/TTPayPal
    let userLimits = null;
    try {
      userLimits = await getUserLimits();
      console.log('Got user limits from WordPress:', userLimits);
    } catch (limitsError) {
      console.warn('Failed to get user limits:', limitsError);
    }
    
    // Sync balance to WordPress
    const balanceSyncResult = await syncTriniCreditToWordPress(correctBalance);
    console.log('Balance sync result:', balanceSyncResult);
    
    // Sync user limits to WordPress (if limits exist)
    let limitsSyncResult = { success: true, message: 'No limits to sync' };
    if (userLimits) {
      limitsSyncResult = await syncUserLimitsToWordPress(userLimits);
      console.log('Limits sync result:', limitsSyncResult);
      
      // Also store limits in Supabase profiles table
      await syncUserLimitsToSupabase(userId, userLimits);
    } else {
      console.warn('No user limits available to sync');
    }
    
    return { 
      success: balanceSyncResult.success && limitsSyncResult.success, 
      balance: correctBalance,
      limits: userLimits,
      syncMessage: `Balance: ${balanceSyncResult.message}, Limits: ${limitsSyncResult.message}` 
    };
  } catch (error) {
    console.error('Error fixing WordPress balance and limits:', error);
    throw error;
  }
}

async function syncUserLimitsToSupabase(userId: string, limits: any) {
  // Disabled - ttpaypal_limits column doesn't exist in Supabase
  console.log('Supabase limits sync disabled - using WordPress as source of truth');
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