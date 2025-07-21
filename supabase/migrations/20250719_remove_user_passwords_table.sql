-- Remove user_passwords table if it exists
-- First, drop any triggers or functions associated with the table
DROP TRIGGER IF EXISTS user_passwords_trigger ON user_passwords;
DROP FUNCTION IF EXISTS user_passwords_function();

-- Drop any indexes on the user_passwords table
DROP INDEX IF EXISTS idx_user_passwords_user_id;

-- Drop the table with CASCADE to remove any dependent objects
DROP TABLE IF EXISTS user_passwords CASCADE;

-- Verify table removal
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_passwords' AND table_schema = 'public') THEN
        RAISE NOTICE 'Warning: user_passwords table still exists';
    ELSE
        RAISE NOTICE 'Success: user_passwords table has been removed';
    END IF;
END $$;