-- Diagnose why the function isn't working at all

-- 1. Check if video_views table has RLS enabled and what policies exist
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'video_views';

-- 2. Check RLS policies on video_views
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'video_views'
ORDER BY cmd;

-- 3. Try a direct insert bypassing the function
DO $$
DECLARE
    test_video_id UUID;
    test_creator_id UUID;
    random_viewer UUID;
BEGIN
    -- Get test data
    SELECT id, user_id INTO test_video_id, test_creator_id FROM videos LIMIT 1;
    random_viewer := gen_random_uuid();
    
    RAISE NOTICE 'Attempting direct insert...';
    RAISE NOTICE 'Video: %, Creator: %, Viewer: %', test_video_id, test_creator_id, random_viewer;
    
    -- Try direct insert
    INSERT INTO video_views (video_id, viewer_id, creator_id, viewed_at)
    VALUES (test_video_id, random_viewer, test_creator_id, NOW());
    
    RAISE NOTICE '✅ Direct insert successful!';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ Direct insert failed: %', SQLERRM;
    RAISE NOTICE 'Error state: %', SQLSTATE;
END $$;

-- 4. Check if the direct insert worked
SELECT 
    COUNT(*) as total_views,
    video_id,
    viewer_id,
    creator_id,
    viewed_at
FROM video_views
GROUP BY video_id, viewer_id, creator_id, viewed_at;

-- 5. If direct insert worked, there might be an issue with the function execution context
-- Let's try calling the function in a different way
SELECT 
    'Testing function call...' as status,
    record_video_view((SELECT id FROM videos LIMIT 1)) as result;

-- 6. Check table permissions
SELECT 
    grantee,
    privilege_type
FROM information_schema.role_table_grants 
WHERE table_name = 'video_views'
AND table_schema = 'public';