-- Add TTPayPal limits field to profiles table
-- This stores user role-based transaction limits fetched from TTPayPal wallet app

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS ttpaypal_limits JSONB DEFAULT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN public.profiles.ttpaypal_limits IS 'Stores TTPayPal user role-based transaction limits including per_transaction_limit, max_wallet_balance, max_monthly_transactions, and user_role';

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_ttpaypal_limits ON public.profiles USING GIN (ttpaypal_limits);

-- Update the types file will be needed to include this new field 