-- Check profiles and authentication setup

-- 1. Check if profiles exist for the users
SELECT 
    u.id as user_id,
    u.email,
    p.user_id as profile_user_id,
    p.username,
    p.display_name,
    CASE 
        WHEN p.user_id IS NOT NULL THEN '✅ Has Profile'
        ELSE '❌ Missing Profile'
    END as profile_status
FROM auth.users u
LEFT JOIN profiles p ON u.id = p.user_id
ORDER BY u.created_at DESC;

-- 2. Check RLS policies on videos table that might be blocking inserts
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'videos'
AND cmd = 'INSERT';

-- 3. Test if we can insert a video with a specific user ID
INSERT INTO videos (
    id,
    title,
    description,
    video_url,
    user_id,
    view_count,
    like_count
) VALUES (
    gen_random_uuid(),
    'Test Video Manual',
    'Test Description Manual',
    'https://example.com/test-manual.mp4',
    'e9128418-78b9-4143-8530-04030f73e990', -- Using first user ID
    0,
    0
);

-- 4. Check if the insert worked
SELECT 
    COUNT(*) as total_videos,
    title,
    user_id
FROM videos 
WHERE title LIKE 'Test Video%'
GROUP BY title, user_id;