-- Fix search_path security issue for update_trincredits_transactions_updated_at function
-- This resolves the "Function Search Path Mutable" security warning

-- Drop and recreate the function with proper search_path security
DROP FUNCTION IF EXISTS update_trincredits_transactions_updated_at() CASCADE;

-- Create the function with proper search_path setting
CREATE OR REPLACE FUNCTION update_trincredits_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    -- Update the updated_at column to current timestamp
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger if the table exists
DO $$
BEGIN
    -- Check if trincredits_transactions table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'trincredits_transactions' AND table_schema = 'public') THEN
        -- Drop existing trigger if it exists
        DROP TRIGGER IF EXISTS update_trincredits_transactions_updated_at_trigger ON trincredits_transactions;
        
        -- Create the trigger
        CREATE TRIGGER update_trincredits_transactions_updated_at_trigger
            BEFORE UPDATE ON trincredits_transactions
            FOR EACH ROW
            EXECUTE FUNCTION update_trincredits_transactions_updated_at();
            
        RAISE NOTICE 'Success: Fixed update_trincredits_transactions_updated_at function and recreated trigger';
    ELSE
        RAISE NOTICE 'Info: trincredits_transactions table does not exist, function created but no trigger added';
    END IF;
END $$;

-- Verification
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'update_trincredits_transactions_updated_at' AND routine_schema = 'public') THEN
        RAISE NOTICE 'Success: update_trincredits_transactions_updated_at function exists with proper search_path';
    ELSE
        RAISE NOTICE 'Error: update_trincredits_transactions_updated_at function not found';
    END IF;
END $$;