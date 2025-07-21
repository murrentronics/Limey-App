-- Fix functions that are trying to access auth.users without permission

-- 1. Drop the problematic functions that access auth.users
DROP FUNCTION IF EXISTS fully_delete_user(uuid);
DROP FUNCTION IF EXISTS update_profile(uuid, text, text);

-- 2. Create a safer version of update_profile that only updates public.profiles
CREATE OR REPLACE FUNCTION update_profile(
    user_id UUID,
    new_name TEXT DEFAULT NULL,
    new_username TEXT DEFAULT NULL,
    new_bio TEXT DEFAULT NULL,
    new_avatar_url TEXT DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    -- Only update the profiles table (not auth.users)
    UPDATE public.profiles 
    SET 
        display_name = COALESCE(new_name, display_name),
        username = COALESCE(new_username, username),
        bio = COALESCE(new_bio, bio),
        avatar_url = COALESCE(new_avatar_url, avatar_url),
        updated_at = NOW()
    WHERE user_id = update_profile.user_id;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create a safer version of user deletion that doesn't touch auth.users
CREATE OR REPLACE FUNCTION delete_user_data(user_id_to_delete UUID)
RETURNS BOOLEAN AS $$
BEGIN
    -- Set search_path for security
    PERFORM set_config('search_path', 'public', true);
    
    -- Delete user data from public tables only
    DELETE FROM user_sessions WHERE user_id = user_id_to_delete;
    DELETE FROM video_views WHERE viewer_id = user_id_to_delete OR creator_id = user_id_to_delete;
    DELETE FROM video_likes WHERE user_id = user_id_to_delete;
    DELETE FROM videos WHERE user_id = user_id_to_delete;
    DELETE FROM profiles WHERE user_id = user_id_to_delete;
    
    -- Note: We don't delete from auth.users as that requires special permissions
    -- Users should be deleted through Supabase Auth API instead
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION update_profile(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_data(UUID) TO authenticated;

-- 5. Verify the problematic functions are gone
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('fully_delete_user', 'update_profile')
ORDER BY routine_name;