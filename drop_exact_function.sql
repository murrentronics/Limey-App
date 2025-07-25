-- Drop the exact function signature that's causing issues
DROP FUNCTION IF EXISTS update_profile(p_user_id uuid, p_username text, p_display_name text, p_bio text, p_avatar_url text, p_location text) CASCADE;

-- Verify it's gone
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name = 'update_profile';

-- Also check if there are any other functions accessing auth.users
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_definition ILIKE '%auth.users%'
ORDER BY routine_name;