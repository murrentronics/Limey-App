-- Drop all versions of problematic functions

-- 1. List all update_profile functions to see what we're dealing with
SELECT 
    p.proname,
    pg_get_function_identity_arguments(p.oid) as arguments,
    pg_get_function_result(p.oid) as return_type
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'update_profile';

-- 2. Drop all possible versions of update_profile function
DROP FUNCTION IF EXISTS update_profile(uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS update_profile(uuid, text) CASCADE;
DROP FUNCTION IF EXISTS update_profile(text, text) CASCADE;
DROP FUNCTION IF EXISTS update_profile(uuid, text, text, text) CASCADE;
DROP FUNCTION IF EXISTS update_profile(uuid, text, text, text, text) CASCADE;

-- 3. Drop fully_delete_user function
DROP FUNCTION IF EXISTS fully_delete_user(uuid) CASCADE;
DROP FUNCTION IF EXISTS fully_delete_user() CASCADE;

-- 4. Verify all problematic functions are gone
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('fully_delete_user', 'update_profile')
ORDER BY routine_name;

-- 5. Now create a simple safe function if needed (optional)
-- Uncomment if you need a profile update function:
/*
CREATE OR REPLACE FUNCTION safe_update_profile(
    target_user_id UUID,
    new_display_name TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles 
    SET 
        display_name = COALESCE(new_display_name, display_name),
        updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION safe_update_profile(UUID, TEXT) TO authenticated;
*/