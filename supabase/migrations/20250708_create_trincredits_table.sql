-- Create TriniCredits transactions table
-- Run this SQL directly in your Supabase SQL Editor

-- Create the trincredits_transactions table
CREATE TABLE IF NOT EXISTS public.trincredits_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('deposit', 'withdrawal', 'transfer', 'reward', 'refund')),
  amount DECIMAL(10,2) NOT NULL,
  balance_before DECIMAL(10,2) NOT NULL,
  balance_after DECIMAL(10,2) NOT NULL,
  description TEXT,
  reference_id TEXT, -- For linking to external transaction IDs
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.trincredits_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own transactions" ON public.trincredits_transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" ON public.trincredits_transactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own transactions" ON public.trincredits_transactions
  FOR UPDATE USING (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_trincredits_transactions_user_id ON public.trincredits_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_trincredits_transactions_type ON public.trincredits_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_trincredits_transactions_created_at ON public.trincredits_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_trincredits_transactions_status ON public.trincredits_transactions(status);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_trincredits_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_trincredits_transactions_updated_at_trigger
  BEFORE UPDATE ON public.trincredits_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_trincredits_transactions_updated_at();

-- Add comment to explain the table
COMMENT ON TABLE public.trincredits_transactions IS 'Stores all TriniCredits transactions including deposits, withdrawals, transfers, rewards, and refunds';

-- Verify the table was created
SELECT 'TriniCredits transactions table created successfully!' as status; 