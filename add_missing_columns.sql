-- Check what columns exist in auth.users table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'auth'
ORDER BY ordinal_position;

-- Add creator_id column to auth.users if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND table_schema = 'auth' 
                   AND column_name = 'creator_id') THEN
        ALTER TABLE auth.users ADD COLUMN creator_id UUID;
        RAISE NOTICE '✅ Added creator_id column to auth.users';
    ELSE
        RAISE NOTICE '✅ creator_id column already exists in auth.users';
    END IF;
END $$;

-- Show updated auth.users structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users' 
AND table_schema = 'auth'
ORDER BY ordinal_position;