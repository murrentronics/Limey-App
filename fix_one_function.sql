-- Fix the function signature issue

-- 1. Check the exact signature of existing functions
SELECT 
    routine_name,
    routine_type,
    pg_get_function_identity_arguments(p.oid) as function_signature
FROM information_schema.routines r
JOIN pg_proc p ON p.proname = r.routine_name
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE r.routine_schema = 'public' 
AND r.routine_name IN ('fully_delete_user', 'update_profile')
AND n.nspname = 'public'
ORDER BY routine_name;

-- 2. Drop all versions of these functions (using CASCADE to handle dependencies)
DROP FUNCTION IF EXISTS fully_delete_user CASCADE;
DROP FUNCTION IF EXISTS update_profile CASCADE;

-- 3. Create a simple, safe update_profile function
CREATE OR REPLACE FUNCTION update_profile(
    target_user_id UUID,
    new_display_name TEXT DEFAULT NULL,
    new_username TEXT DEFAULT NULL,
    new_bio TEXT DEFAULT NULL,
    new_avatar_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Only update the profiles table (not auth.users)
    UPDATE public.profiles 
    SET 
        display_name = COALESCE(new_display_name, display_name),
        username = COALESCE(new_username, username),
        bio = COALESCE(new_bio, bio),
        avatar_url = COALESCE(new_avatar_url, avatar_url),
        updated_at = NOW()
    WHERE user_id = target_user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions
GRANT EXECUTE ON FUNCTION update_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- 5. Verify functions are fixed
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('fully_delete_user', 'update_profile')
ORDER BY routine_name;