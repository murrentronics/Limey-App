-- Debug why record_video_view is returning false

-- 1. Check if we're authenticated in SQL context
SELECT 
    auth.uid() as current_user_id,
    CASE 
        WHEN auth.uid() IS NULL THEN 'Anonymous (SQL context)'
        ELSE 'Authenticated'
    END as auth_status;

-- 2. Get a real video and its creator
SELECT 
    id as video_id,
    title,
    user_id as creator_id,
    'This is the video we will test with' as note
FROM videos 
LIMIT 1;

-- 3. Test the function step by step with a specific video
DO $$
DECLARE
    test_video_id UUID;
    test_creator_id UUID;
    current_user_id UUID;
    result BOOLEAN;
BEGIN
    -- Get a test video
    SELECT id, user_id INTO test_video_id, test_creator_id
    FROM videos 
    LIMIT 1;
    
    -- Get current user
    current_user_id := auth.uid();
    
    RAISE NOTICE 'Testing with video: %', test_video_id;
    RAISE NOTICE 'Video creator: %', test_creator_id;
    RAISE NOTICE 'Current user: %', current_user_id;
    
    -- Test if video exists check works
    IF test_creator_id IS NOT NULL THEN
        RAISE NOTICE '✅ Video exists and has creator';
    ELSE
        RAISE NOTICE '❌ Video not found or no creator';
    END IF;
    
    -- Test the actual function
    SELECT record_video_view(test_video_id) INTO result;
    RAISE NOTICE 'Function result: %', result;
    
    -- Check if any views were actually inserted
    RAISE NOTICE 'Total views in table: %', (SELECT COUNT(*) FROM video_views);
    RAISE NOTICE 'Views for this video: %', (SELECT COUNT(*) FROM video_views WHERE video_id = test_video_id);
END $$;

-- 4. Check video_views table structure and constraints
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'video_views'
ORDER BY ordinal_position;

-- 5. Check if there are any constraints that might be failing
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_name = 'video_views'
AND tc.table_schema = 'public';