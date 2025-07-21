-- Debug the profile page video query issue

-- 1. Check if profiles table exists and its structure
SELECT 
    column_name, 
    data_type, 
    is_nullable, 
    column_default
FROM information_schema.columns 
WHERE table_name = 'profiles' AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check if there are profiles for users
SELECT 
    COUNT(*) as total_profiles,
    COUNT(CASE WHEN username IS NOT NULL THEN 1 END) as profiles_with_username,
    COUNT(CASE WHEN avatar_url IS NOT NULL THEN 1 END) as profiles_with_avatar
FROM profiles;

-- 3. Check the relationship between videos and profiles
SELECT 
    v.id as video_id,
    v.title,
    v.user_id as video_user_id,
    p.user_id as profile_user_id,
    p.username,
    p.avatar_url,
    CASE 
        WHEN p.user_id IS NOT NULL THEN '✅ Has Profile'
        ELSE '❌ Missing Profile'
    END as profile_status
FROM videos v
LEFT JOIN profiles p ON v.user_id = p.user_id
LIMIT 5;

-- 4. Test the exact query that Profile.tsx is trying to make
SELECT 
    v.*,
    p.username,
    p.avatar_url
FROM videos v
LEFT JOIN profiles p ON v.user_id = p.user_id
WHERE v.user_id = '8dfaa427-3bef-4e3b-996c-aa4349683fed'
ORDER BY v.created_at DESC;

-- 5. Check if the user exists in profiles table
SELECT 
    user_id,
    username,
    avatar_url,
    display_name
FROM profiles 
WHERE user_id = '8dfaa427-3bef-4e3b-996c-aa4349683fed';

-- 6. Check RLS policies on profiles table
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'profiles';